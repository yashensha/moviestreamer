import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import type { MediaItem, UserRatingItem, PersonItem } from '../types/movie';
import { useStreamStore } from '../store/useStreamStore';
import { multiSearchWithTMDB } from '../services/tmdb';
import { NetflixNavbar } from './NetflixNavbar';
import { SearchResults } from './SearchResults';
import { LetterboxdImportModal } from './LetterboxdImportModal';
import { AddWatchedModal } from './AddWatchedModal';
import { NetflixTallCard } from './NetflixTallCard';
import {
  Play,
  Star,
  Heart,
  Clock,
  Sparkles,
  User,
  RotateCcw,
  LogOut,
  LogIn,
  UploadCloud,
  PlusCircle,
  Film,
  ArrowUpDown,
  Sliders,
  ShieldAlert,
  Cpu,
  Bookmark,
  Compass,
  Clapperboard,
  Users,
  Tag,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { computeUnifiedInteractionMatrix } from '../services/interactionMatrix';
import { StarRatingModal } from './StarRatingModal';

interface ProfilePageProps {
  onOpenItem?: (item: MediaItem) => void;
  initialTab?: 'all' | 'watched' | 'watchlist' | 'liked' | 'history' | 'matrix';
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenItem, initialTab }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const watchHistory = useStreamStore((state) => state.watchHistory);
  const likedMedia = useStreamStore((state) => state.likedMedia);
  const dislikedMedia = useStreamStore((state) => state.dislikedMedia);
  const userRatings = useStreamStore((state) => state.userRatings);
  const watchlist = useStreamStore((state) => state.watchlist);
  const watchedList = useStreamStore((state) => state.watchedList) || [];
  const removeFromWatchlist = useStreamStore((state) => state.removeFromWatchlist);
  const removeFromHistory = useStreamStore((state) => state.removeFromHistory);
  const removeFromWatched = useStreamStore((state) => state.removeFromWatched);
  const clearHistory = useStreamStore((state) => state.clearHistory);
  const toggleLike = useStreamStore((state) => state.toggleLike);
  const isWatched = useStreamStore((state) => state.isWatched);
  const dismissedHistoryIds = useStreamStore((state) => state.dismissedHistoryIds) || [];
  const deletedWatchedIds = useStreamStore((state) => state.deletedWatchedIds) || [];

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const openLoginModal = useAuthStore((state) => state.openLoginModal);

  const queryTab = searchParams.get('tab') as 'all' | 'watched' | 'watchlist' | 'liked' | 'history' | 'matrix' | null;
  const resolvedInitialTab = initialTab || (location.pathname === '/my-list' ? 'watchlist' : queryTab || 'all');
  const [activeTab, setActiveTab] = useState<'all' | 'watched' | 'watchlist' | 'liked' | 'history' | 'matrix'>(resolvedInitialTab);
  const [ratingModalMedia, setRatingModalMedia] = useState<MediaItem | null>(null);

  // Sync tab if user navigates directly to /my-list
  useEffect(() => {
    if (location.pathname === '/my-list') {
      setActiveTab('watchlist');
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [location.pathname, initialTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [searchPeople, setSearchPeople] = useState<PersonItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search with debounce using tmdb-ts multiSearch
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchPeople([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const res = await multiSearchWithTMDB(searchQuery);
      setSearchResults(res.media);
      setSearchPeople(res.people);
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Compute Unified Interaction Matrix & BM25 normalized weights
  const tasteMatrix = useMemo(() => {
    return computeUnifiedInteractionMatrix(watchHistory, likedMedia, userRatings, dislikedMedia);
  }, [watchHistory, likedMedia, userRatings, dislikedMedia]);

  // Compute Top Subgenres & Thematic Clusters from 50,000+ MovieLens tags & TV taxonomy
  const [topSubgenres, setTopSubgenres] = useState<Array<{ name: string; score: number; cluster?: string }>>([]);

  useEffect(() => {
    let isCancelled = false;
    const resolveSubgenres = async () => {
      try {
        const { getMovieSubgenresMap, TAXONOMY_CLUSTERS } = await import('../services/subgenreService');
        const movieMap = await getMovieSubgenresMap();

        const subgenreScores: Record<string, { score: number; cluster?: string }> = {};

        for (const item of tasteMatrix.interactions) {
          if (item.isHardFiltered || item.normalizedWeight <= 0) continue;

          const tags = movieMap[String(item.id)] || [];
          for (const tag of tags) {
            let cluster: string | undefined = undefined;
            for (const [cName, cTags] of Object.entries(TAXONOMY_CLUSTERS)) {
              if (cTags.includes(tag)) {
                cluster = cName;
                break;
              }
            }

            if (!subgenreScores[tag]) {
              subgenreScores[tag] = { score: 0, cluster };
            }
            subgenreScores[tag].score += item.normalizedWeight;
          }
        }

        const sorted = Object.entries(subgenreScores)
          .sort((a, b) => b[1].score - a[1].score)
          .slice(0, 8)
          .map(([name, data]) => ({
            name,
            score: Math.round(data.score * 10) / 10,
            cluster: data.cluster,
          }));

        if (!isCancelled) {
          setTopSubgenres(sorted);
        }
      } catch (e) {
        console.warn('Subgenre calculation in ProfilePage failed', e);
      }
    };

    resolveSubgenres();
    return () => {
      isCancelled = true;
    };
  }, [tasteMatrix]);

  // Modals & Drag-and-Drop
  const [isLetterboxdOpen, setIsLetterboxdOpen] = useState(false);
  const [isAddWatchedOpen, setIsAddWatchedOpen] = useState(false);
  const [isPageDragActive, setIsPageDragActive] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  const handlePageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isPageDragActive) setIsPageDragActive(true);
  };

  const handlePageDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsPageDragActive(false);
  };

  const handlePageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPageDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const f = e.dataTransfer.files[0];
      if (f.name.endsWith('.csv')) {
        setDroppedFile(f);
        setIsLetterboxdOpen(true);
      }
    }
  };

  // Watched List Filters & Sorting
  const [watchedFilter] = useState<'all' | 'rated' | 'letterboxd' | 'high'>('all');
  const [watchedSort, setWatchedSort] = useState<'recent' | 'rating' | 'year' | 'title'>('recent');

  // Matrix Affinity Tab (Genres vs Directors vs Actors)
  const [affinityTab, setAffinityTab] = useState<'genres' | 'directors' | 'actors'>('genres');

  // Watchlist Filters & Sorting
  const [watchlistFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [watchlistSort] = useState<'recent' | 'rating' | 'year' | 'title'>('recent');

  // Filtered & Sorted Watchlist items
  const filteredWatchlistItems = useMemo(() => {
    let list = [...watchlist];

    if (watchlistFilter !== 'all') {
      list = list.filter((item) => (item.media_type || 'movie') === watchlistFilter);
    }

    if (watchlistSort === 'rating') {
      list.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    } else if (watchlistSort === 'year') {
      list.sort((a, b) => {
        const yA = a.release_date ? parseInt(a.release_date.slice(0, 4), 10) || 0 : 0;
        const yB = b.release_date ? parseInt(b.release_date.slice(0, 4), 10) || 0 : 0;
        return yB - yA;
      });
    } else if (watchlistSort === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }, [watchlist, watchlistFilter, watchlistSort]);

  // Dynamic Cinema Archetype based on tags, directors, actors, and BM25 normalized weights
  const viewerArchetype = useMemo(() => {
    const topGenreNames = tasteMatrix.topGenres.map((g) => g.name.toLowerCase());
    const topTagNames = (tasteMatrix.topTags || []).map((t) => t.name.toLowerCase());
    const topDirectorNames = (tasteMatrix.topDirectors || []).map((d) => d.name.toLowerCase());
    const totalTitles = tasteMatrix.interactions.length;

    if (totalTitles === 0) {
      return {
        title: 'The Budding Cinephile',
        tagline: 'Your cinematic identity is just beginning to take shape.',
        icon: '🌱',
        vibe: 'Add titles to your watchlist, rate movies, or like favorites to uncover your Cinema Archetype.',
      };
    }

    // Sci-Fi / Cyberpunk / Speculative Fiction
    const isSciFi =
      topGenreNames.some((g) => g.includes('science fiction') || g.includes('sci-fi')) ||
      topTagNames.some((t) => t.includes('cyberpunk') || t.includes('space') || t.includes('artificial intelligence') || t.includes('time travel') || t.includes('time loop') || t.includes('dystopia')) ||
      topDirectorNames.some((d) => d.includes('villeneuve') || d.includes('nolan') || d.includes('kubrick') || d.includes('scott'));

    if (isSciFi) {
      return {
        title: 'The Midnight Sci-Fi Voyager',
        tagline: 'Drawn to deep space existentialism, non-linear time puzzles, and dystopian horizons.',
        icon: '🌌',
        vibe: 'Philosophical, speculative, and forward-looking.',
      };
    }

    // Neo-Noir / Psychological Crime / Heist
    const isNeoNoir =
      topGenreNames.some((g) => g.includes('crime') || g.includes('mystery') || g.includes('thriller')) ||
      topTagNames.some((t) => t.includes('neo-noir') || t.includes('psychological') || t.includes('heist') || t.includes('investigation') || t.includes('serial killer') || t.includes('mafia')) ||
      topDirectorNames.some((d) => d.includes('fincher') || d.includes('scorsese') || d.includes('gilligan') || d.includes('coen'));

    if (isNeoNoir) {
      return {
        title: 'The Neo-Noir Sleuth',
        tagline: 'Hooked on moral ambiguity, high-stakes heists, and atmospheric psychological tension.',
        icon: '🕵️',
        vibe: 'Cerebral, observant, and gritty.',
      };
    }

    // Anime / Animation
    const isAnime =
      topGenreNames.some((g) => g.includes('animation') || g.includes('anime')) ||
      topTagNames.some((t) => t.includes('anime') || t.includes('japan') || t.includes('studio ghibli') || t.includes('manga')) ||
      topDirectorNames.some((d) => d.includes('miyazaki') || d.includes('shinkai') || d.includes('kon'));

    if (isAnime) {
      return {
        title: 'The Anime Marathoner',
        tagline: 'Enamored with expressive animation, intricate worldbuilding, and legendary sagas.',
        icon: '⚡',
        vibe: 'Imaginative, passionate, and boundless.',
      };
    }

    // Criterion / Auteur / Classic
    const isCriterion =
      topGenreNames.some((g) => g.includes('drama') || g.includes('history') || g.includes('documentary')) ||
      topTagNames.some((t) => t.includes('philosophical') || t.includes('existentialism') || t.includes('art house') || t.includes('classic') || t.includes('surrealism') || t.includes('criterion')) ||
      topDirectorNames.some((d) => d.includes('bergman') || d.includes('kurosawa') || d.includes('hitchcock') || d.includes('tarkovsky') || d.includes('fellini'));

    if (isCriterion) {
      return {
        title: 'The Criterion Purist',
        tagline: 'Revering auteur craftsmanship, slow-burn character studies, and cinematic history.',
        icon: '🎞️',
        vibe: 'Reflective, discerning, and patient.',
      };
    }

    // High-Octane Action
    const isAction =
      topGenreNames.some((g) => g.includes('action') || g.includes('adventure')) ||
      topTagNames.some((t) => t.includes('martial arts') || t.includes('car chase') || t.includes('superhero') || t.includes('survival')) ||
      topDirectorNames.some((d) => d.includes('tarantino') || d.includes('stahelski') || d.includes('miller'));

    if (isAction) {
      return {
        title: 'The High-Octane Explorer',
        tagline: 'Thriving on pulse-pounding choreography, epic odysseys, and adrenaline rushes.',
        icon: '🔥',
        vibe: 'Bold, adventurous, and thrill-seeking.',
      };
    }

    return {
      title: 'The Eclectic Cinephile',
      tagline: 'Transcending conventional genre bounds with a wide, multifaceted appetite for cinema.',
      icon: '✨',
      vibe: 'Curious, versatile, and unpredictable.',
    };
  }, [tasteMatrix]);

  // Compute dominant genres from BM25 normalized taste matrix
  const dominantGenres = useMemo(() => {
    return tasteMatrix.topGenres.map((g) => g.name).slice(0, 4);
  }, [tasteMatrix]);

  // Rating lookup map for fast UI badges
  const ratingsMap = useMemo(() => {
    const map = new Map<number, UserRatingItem>();
    const deletedIds = new Set((deletedWatchedIds || []).map((d) => Number(d)));
    userRatings.forEach((r) => {
      if (!deletedIds.has(Number(r.id))) {
        map.set(r.id, r);
      }
    });
    return map;
  }, [userRatings, deletedWatchedIds]);

  // Filtered liked media excluding any deleted items
  const validLikedMedia = useMemo(() => {
    const deletedIds = new Set((deletedWatchedIds || []).map((d) => Number(d)));
    return (likedMedia || []).filter((l) => !deletedIds.has(Number(l.id)));
  }, [likedMedia, deletedWatchedIds]);

  // Combined watched titles (everything other than watchlist is watched)
  const allWatchedItems = useMemo(() => {
    const map = new Map<number, MediaItem>();
    const watchlistIds = new Set((watchlist || []).map((w) => Number(w.id)));
    const deletedIds = new Set((deletedWatchedIds || []).map((d) => Number(d)));

    const addItem = (item: any, typeFallback?: 'movie' | 'tv') => {
      const numId = Number(item.id);
      if (!numId || isNaN(numId)) return;
      if (watchlistIds.has(numId) || deletedIds.has(numId)) {
        return;
      }
      if (!map.has(numId)) {
        map.set(numId, {
          id: numId,
          title: item.title,
          overview: item.overview || '',
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path ?? null,
          media_type: item.media_type || item.type || typeFallback || 'movie',
          release_date: item.release_date || '',
          vote_average: item.vote_average ?? 8.0,
          genre_ids: item.genre_ids,
        });
      }
    };

    (watchedList || []).forEach((w) => addItem(w));
    (userRatings || []).forEach((r) => addItem(r, r.type));
    (likedMedia || []).forEach((l) => addItem(l));
    (dislikedMedia || []).forEach((d) => addItem(d));
    (watchHistory || []).forEach((h) => addItem(h, h.type));

    return Array.from(map.values());
  }, [watchedList, userRatings, likedMedia, dislikedMedia, watchHistory, watchlist, deletedWatchedIds]);

  // Filtered & Sorted Watched items
  const filteredWatchedItems = useMemo(() => {
    let list = [...allWatchedItems];

    if (watchedFilter === 'rated') {
      list = list.filter((item) => ratingsMap.has(item.id) && ratingsMap.get(item.id)?.rating);
    } else if (watchedFilter === 'letterboxd') {
      list = list.filter((item) => ratingsMap.get(item.id)?.source === 'letterboxd');
    } else if (watchedFilter === 'high') {
      list = list.filter((item) => {
        const r = ratingsMap.get(item.id)?.rating;
        return r && r >= 4.0;
      });
    }

    if (watchedSort === 'rating') {
      list.sort((a, b) => {
        const rA = ratingsMap.get(a.id)?.rating || a.vote_average || 0;
        const rB = ratingsMap.get(b.id)?.rating || b.vote_average || 0;
        return rB - rA;
      });
    } else if (watchedSort === 'year') {
      list.sort((a, b) => {
        const yA = a.release_date ? parseInt(a.release_date.slice(0, 4), 10) || 0 : 0;
        const yB = b.release_date ? parseInt(b.release_date.slice(0, 4), 10) || 0 : 0;
        return yB - yA;
      });
    } else if (watchedSort === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // 'recent'
      list.sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    return list;
  }, [allWatchedItems, watchedFilter, watchedSort, ratingsMap]);

  // Letterboxd import stats
  const letterboxdCount = useMemo(() => {
    return userRatings.filter((r) => r.source === 'letterboxd').length;
  }, [userRatings]);

  const handlePlayItem = (type: 'movie' | 'tv', id: number, season?: number, episode?: number) => {
    const url =
      type === 'tv' && season && episode
        ? `/tv/${id}?season=${season}&episode=${episode}`
        : `/${type}/${id}`;
    navigate(url);
  };

  const handleSelectItem = (item: MediaItem) => {
    if (onOpenItem) {
      onOpenItem(item);
    } else {
      const type = item.media_type || 'movie';
      handlePlayItem(type, item.id, item.season, item.episode);
    }
  };

  return (
    <div
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
      className="min-h-screen bg-black text-zinc-100 flex flex-col selection:bg-rose-600 selection:text-white relative"
    >
      {/* Full-Page Letterboxd Drag-and-Drop Overlay */}
      {isPageDragActive && (
        <div className="fixed inset-0 z-50 bg-black/90 border-4 border-dashed border-[#00E054] flex flex-col items-center justify-center p-8 backdrop-blur-md transition-all pointer-events-none">
          <UploadCloud className="w-16 h-16 text-[#00E054] animate-bounce mb-4" />
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">
            Drop Your Letterboxd CSV Here
          </h2>
          <p className="text-sm text-zinc-300 mt-2 font-mono text-center max-w-md">
            Release ratings.csv, watched.csv, or watchlist.csv to instantly seed your taste matrix and recommendation graph.
          </p>
          <div className="mt-4 px-3 py-1 bg-[#00E054]/20 border border-[#00E054]/60 text-[#00E054] text-xs font-mono">
            Direct Instant Import
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <NetflixNavbar
        activeTab="profile"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {searchQuery ? (
        <SearchResults
          query={searchQuery}
          results={searchResults}
          people={searchPeople}
          loading={isSearching}
          onSelect={handleSelectItem}
          onClear={() => setSearchQuery('')}
        />
      ) : (
        <main className="flex-grow max-w-7xl mx-auto w-full px-4 md:px-12 pt-28 pb-24 space-y-8">
          {/* Profile Header & Taste Card */}
          <div className="bg-[#181818] border border-zinc-800 p-6 md:p-8 rounded-none shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-48 w-80 h-80 bg-[#00E054]/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-5">
                {/* Netflix Red Avatar */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 rounded-none flex items-center justify-center text-white shadow-xl shadow-rose-950/40 border-2 border-white/20 flex-shrink-0 text-2xl font-black uppercase">
                  {user ? (user.name ? user.name[0] : user.email[0]) : <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {user ? (user.name || user.email.split('@')[0]) : 'My Profile'}
                    </h1>
                    {user ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 px-2.5 py-0.5 border border-emerald-800 rounded-none">
                        Member
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 px-2 py-0.5 border border-zinc-700 rounded-none">
                        Guest Session
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-400">
                    {user
                      ? `Signed in as ${user.email} • Synced to Cloudflare D1`
                      : 'Viewing as guest. Sign in to permanently save your history and sync across devices.'}
                  </p>
                  <div className="pt-1 flex items-center gap-3">
                    {user ? (
                      <button
                        onClick={() => logout()}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    ) : (
                      <button
                        onClick={openLoginModal}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#E50914] hover:bg-[#c90812] text-xs font-semibold text-white tracking-wide transition cursor-pointer shadow-md shadow-rose-950/30"
                      >
                        <LogIn className="w-3.5 h-3.5" /> Sign In / Register
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Badges */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 text-center rounded-none min-w-[85px]">
                  <span className="block text-xl font-bold text-white">{allWatchedItems.length}</span>
                  <span className="block text-[10px] uppercase font-bold text-zinc-500">Watched</span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 text-center rounded-none min-w-[85px]">
                  <span className="block text-xl font-bold text-[#00E054]">{ratingsMap.size}</span>
                  <span className="block text-[10px] uppercase font-bold text-zinc-500">Rated</span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 text-center rounded-none min-w-[85px]">
                  <span className="block text-xl font-bold text-rose-500">{validLikedMedia.length}</span>
                  <span className="block text-[10px] uppercase font-bold text-zinc-500">Liked</span>
                </div>
                {dominantGenres.length > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-none flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-rose-400" /> Top Taste
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      {dominantGenres.map((g) => (
                        <span key={g} className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 px-1.5 py-0.5 font-medium">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Taste Matrix Quick Actions Bar */}
            <div className="mt-6 pt-5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Letterboxd Import Action Button */}
                <button
                  onClick={() => setIsLetterboxdOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#00E054]/15 hover:bg-[#00E054]/25 border border-[#00E054]/50 text-[#00E054] text-xs font-bold transition cursor-pointer shadow-lg shadow-[#00E054]/10"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Import Letterboxd CSV</span>
                  {letterboxdCount > 0 && (
                    <span className="bg-[#00E054] text-black text-[10px] font-black px-1.5 py-0.2 rounded-none">
                      {letterboxdCount}
                    </span>
                  )}
                </button>

                {/* Add Watched Title Action Button */}
                <button
                  onClick={() => setIsAddWatchedOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-rose-950/40"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Watched Title</span>
                </button>
              </div>

              {(watchHistory.length > 0 || likedMedia.length > 0 || userRatings.length > 0) && (
                <button
                  onClick={() => {
                    if (window.confirm('Clear all session watch history, ratings, and likes?')) {
                      clearHistory();
                    }
                  }}
                  className="flex items-center gap-1.5 text-zinc-500 hover:text-rose-400 text-xs transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Taste Data</span>
                </button>
              )}
            </div>
          </div>

          {/* Letterboxd Seed Notice Banner (if user has no ratings yet) */}
          {userRatings.length === 0 && (
            <div className="bg-gradient-to-r from-[#00E054]/10 via-zinc-900/80 to-zinc-900 border border-[#00E054]/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-none bg-[#00E054]/20 border border-[#00E054]/50 flex items-center justify-center text-[#00E054] flex-shrink-0">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Seed Your Taste Matrix with Letterboxd
                    <span className="text-[10px] bg-[#00E054]/20 text-[#00E054] px-1.5 py-0.2 uppercase font-mono">
                      Fast Cold-Start
                    </span>
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Upload your <code className="text-zinc-300">ratings.csv</code> or <code className="text-zinc-300">watched.csv</code> export to instantly populate your watched library and power recommendations.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLetterboxdOpen(true)}
                className="px-4 py-2 bg-[#00E054] hover:bg-[#00c046] text-black text-xs font-black uppercase tracking-wider transition cursor-pointer flex-shrink-0"
              >
                Import CSV Now
              </button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer rounded-none border ${
                activeTab === 'all'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              Overview ({allWatchedItems.length + watchlist.length})
            </button>
            <button
              onClick={() => setActiveTab('watched')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer rounded-none border ${
                activeTab === 'watched'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Watched Titles ({allWatchedItems.length})
            </button>
            <button
              onClick={() => setActiveTab('watchlist')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer rounded-none border ${
                activeTab === 'watchlist'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Watchlist ({watchlist.length})
            </button>
            <button
              onClick={() => setActiveTab('liked')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer rounded-none border ${
                activeTab === 'liked'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              Liked Titles ({validLikedMedia.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer rounded-none border ${
                activeTab === 'history'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Continue Watching
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer rounded-none border ${
                activeTab === 'matrix'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Taste DNA & Discovery
            </button>
          </div>

          {/* Section: Watched Titles & Letterboxd Ratings */}
          {(activeTab === 'all' || activeTab === 'watched') && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">Watched Titles & Ratings</h2>
                </div>

                {/* Filter and Sort Bar */}
                {allWatchedItems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                

                    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-1 text-zinc-400">
                      <ArrowUpDown className="w-3 h-3" />
                      <select
                        value={watchedSort}
                        onChange={(e) => setWatchedSort(e.target.value as any)}
                        className="bg-transparent text-xs text-zinc-300 focus:outline-none cursor-pointer"
                      >
                        <option value="recent" className="bg-zinc-900">Recently Watched</option>
                        <option value="rating" className="bg-zinc-900">Highest Rating</option>
                        <option value="year" className="bg-zinc-900">Release Year</option>
                        <option value="title" className="bg-zinc-900">Title (A-Z)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {allWatchedItems.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/30 border border-dashed border-zinc-800 space-y-3">
                  <Film className="w-10 h-10 text-zinc-600 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-400">No watched titles in your library</p>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      Stream any title, click "+ Add Watched Title", or import your Letterboxd export CSV to instantly populate your watched library.
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      onClick={() => setIsLetterboxdOpen(true)}
                      className="px-3.5 py-1.5 bg-[#00E054]/20 border border-[#00E054]/40 text-[#00E054] text-xs font-bold transition cursor-pointer"
                    >
                      Import Letterboxd
                    </button>
                    <button
                      onClick={() => setIsAddWatchedOpen(true)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      + Add Watched Title
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 py-4">
                  {filteredWatchedItems.map((item) => {
                    const mediaType = item.media_type || 'movie';

                    return (
                      <NetflixTallCard
                        key={`${mediaType}-${item.id}`}
                        item={item}
                        className="w-full"
                        imageType="backdrop"
                        isWatchedCard={true}
                        onSelect={(selected) =>
                          onOpenItem
                            ? onOpenItem(selected)
                            : handlePlayItem(mediaType, item.id, item.season, item.episode)
                        }
                        onPlay={() => handlePlayItem(mediaType, item.id, item.season, item.episode)}
                        onRemove={() => removeFromWatched(item.id)}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Section: Saved Watchlist */}
          {(activeTab === 'all' || activeTab === 'watchlist') && (
            <section className="space-y-4 ">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 ">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">Saved Watchlist</h2>
                </div>

              
              </div>

              {filteredWatchlistItems.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/30 border border-dashed border-zinc-800 space-y-4">
                  <Bookmark className="w-10 h-10 text-zinc-600 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-400">
                      {watchlist.length === 0
                        ? 'Your Watchlist is empty'
                        : 'No titles match this filter'}
                    </p>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      {watchlist.length === 0
                        ? 'Click the bookmark icon on any card or detail page to save titles you plan to stream next.'
                        : 'Try switching the filter to "All" to view all saved titles.'}
                    </p>
                  </div>
                  {watchlist.length === 0 && (
                    <button
                      onClick={() => navigate('/')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#E50914] hover:bg-[#c90812] text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-rose-950/40"
                    >
                      <Compass className="w-4 h-4" />
                      <span>Explore Trending Titles</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 py-4">
                  {filteredWatchlistItems.map((item) => (
                    <NetflixTallCard
                      key={`watchlist-${item.id}`}
                      item={item}
                      className="w-full"
                      imageType="backdrop"
                      isWatchlistCard={true}
                      onSelect={(selected) =>
                        onOpenItem ? onOpenItem(selected) : handleSelectItem(selected)
                      }
                      onPlay={() => handleSelectItem(item)}
                      onRemove={() => removeFromWatchlist(item.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Section: Liked Shows & Movies */}
          {(activeTab === 'all' || activeTab === 'liked') && (
            <section className="space-y-4 ">
              <div className="flex items-center justify-between ">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>My Liked Titles</span>
                </h2>
              </div>

              {validLikedMedia.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/30 border border-dashed border-zinc-800 space-y-2">
                  <Heart className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-sm font-semibold text-zinc-400">No liked titles yet</p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Click the heart icon on any movie or series to like it and help tailor your recommendations.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 py-4">
                  {validLikedMedia.map((item) => (
                    <NetflixTallCard
                      key={`liked-${item.id}`}
                      item={item}
                      className="w-full"
                      imageType="backdrop"
                      isWatchedCard={true}
                      onSelect={(selected) =>
                        onOpenItem ? onOpenItem(selected) : handleSelectItem(selected)
                      }
                      onPlay={() => handleSelectItem(item)}
                      onRemove={() => toggleLike(item)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Section: Continue Watching */}
          {(activeTab === 'all' || activeTab === 'history') && (() => {
            const dismissedSet = new Set(dismissedHistoryIds);
            const continueWatchingItems = watchHistory.filter((i) => {
              if (dismissedSet.has(i.id)) return false;
              if (isWatched(i.id)) return false;
              return true;
            });

            if (continueWatchingItems.length === 0 && activeTab !== 'history') return null;

            return (
              <section className="space-y-4">
                <div className="flex items-center justify-between ">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>Continue Watching & Streaming Sessions</span>
                  </h2>
                </div>

                {continueWatchingItems.length === 0 ? (
                  <div className="p-8 text-center bg-zinc-900/30 border border-dashed border-zinc-800 space-y-2">
                    <p className="text-sm font-semibold text-zinc-400">No active streaming session</p>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      Any movie or series you stream will appear here so you can easily resume right where you left off.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 py-4">
                    {continueWatchingItems.slice(0, 12).map((item) => (
                      <NetflixTallCard
                        key={`continue-${item.type}-${item.id}`}
                        item={{
                          id: item.id,
                          title: item.title,
                          overview: item.overview || '',
                          poster_path: item.poster_path,
                          backdrop_path: item.backdrop_path ?? null,
                          release_date: item.release_date || '',
                          vote_average: item.vote_average ?? 8.0,
                          media_type: item.type || 'movie',
                          number_of_seasons: item.number_of_seasons,
                        }}
                        className="w-full"
                        imageType="backdrop"
                        onSelect={(selected) =>
                          onOpenItem ? onOpenItem(selected) : handleSelectItem(selected)
                        }
                        onPlay={() => handlePlayItem(item.type, item.id, item.season, item.episode)}
                        onRemove={() => removeFromHistory(item.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })()}


          {/* Section: Unified Interaction Matrix & Weighting Engine (Step 2) */}
          {(activeTab === 'all' || activeTab === 'matrix') && (
            <section className="space-y-6 pt-6 border-t border-zinc-800/80">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-rose-500" />
                    <span>Unified Interaction Matrix & BM25 Normalization</span>
                    <span className="text-xs bg-rose-600/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 uppercase tracking-wider font-mono">
                      Step 2 Engine
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Mathematical fusion of Letterboxd imports, in-app hearts, streaming dwell duration, and negative hard-filters.
                  </p>
                </div>

                {/* BM25 Dampener Factor Indicator */}
                <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-3 self-start md:self-auto">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      BM25 Dampening Factor
                    </div>
                    <div className="text-lg font-black text-rose-400 font-mono">
                      {tasteMatrix.bm25Dampener.toFixed(2)}×
                    </div>
                  </div>
                  <div className="h-8 w-px bg-zinc-800" />
                  <div className="text-left text-[11px] text-zinc-400">
                    <span className="font-bold text-zinc-200">
                      {tasteMatrix.itemCount > 500
                        ? 'Power Importer (Dampened)'
                        : tasteMatrix.itemCount > 100
                        ? 'Active Viewer'
                        : tasteMatrix.itemCount >= 25
                        ? 'Balanced Profile'
                        : 'Sparse / Cold-Start'}
                    </span>
                    <div className="text-[10px] text-zinc-500">
                      {tasteMatrix.itemCount} total titles in taste base
                    </div>
                  </div>
                </div>
              </div>

              {/* LB Conversion & Weighting Overview Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-zinc-900/90 border border-zinc-800">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ThumbsUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                      <span>≥ 4.0★ Converted to Liked</span>
                      <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.5 font-mono font-bold">
                        {userRatings.filter((r) => (r.rating || 0) >= 4.0).length} titles
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-tight">
                      Strong positive affinity (4.0–5.0 weight). Directly trains latent vectors & boosts matched auteurs/cast.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Star className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-sky-400 tracking-wider flex items-center gap-1.5">
                      <span>3.0★–3.9★ Unrated Engagement</span>
                      <span className="bg-sky-500/20 text-sky-300 text-[9px] px-1.5 py-0.5 font-mono font-bold">
                        {userRatings.filter((r) => (r.rating || 0) >= 3.0 && (r.rating || 0) < 4.0).length} titles
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-tight">
                      Neutral engagement (2.0–2.5 weight). Tracked as watched without positive or negative algorithm skew.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ThumbsDown className="w-4 h-4 text-rose-400" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider flex items-center gap-1.5">
                      <span>&lt; 3.0★ Converted to Disliked</span>
                      <span className="bg-rose-500/20 text-rose-300 text-[9px] px-1.5 py-0.5 font-mono font-bold">
                        {userRatings.filter((r) => (r.rating || 0) < 3.0).length} titles
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-tight">
                      Hard negative factor (0.0 weight). Fully excluded from home feed & penalizes associated tropes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Formula & Weight Tiers Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
                {/* 5.0★ Tier */}
                <div className="bg-[#181818] border border-zinc-800 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">5.0 Liked</span>
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {tasteMatrix.signalsCount.heart + tasteMatrix.signalsCount.letterboxd_5}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Letterboxd 5★ or In-App Heart
                  </div>
                </div>

                {/* 4.0★ Tier */}
                <div className="bg-[#181818] border border-zinc-800 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">4.0 Liked</span>
                    <Star className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {tasteMatrix.signalsCount.letterboxd_4}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Letterboxd 4★–4.5★ (Auto-Liked)
                  </div>
                </div>

                {/* 3.5★ Tier */}
                <div className="bg-[#181818] border border-zinc-800 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">3.5 Stream</span>
                    <Play className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {tasteMatrix.signalsCount.completed}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Completed Stream / Episode
                  </div>
                </div>

                {/* 2.5★ Tier */}
                <div className="bg-[#181818] border border-zinc-800 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">2.5 Neutral</span>
                    <Star className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {tasteMatrix.signalsCount.letterboxd_3}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Letterboxd 3★ (Unrated Watch)
                  </div>
                </div>

                {/* 2.0★ Tier */}
                <div className="bg-[#181818] border border-zinc-800 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">2.0 Dwell</span>
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {tasteMatrix.signalsCount.dwell_stream}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Stream Started (&gt;10m dwell)
                  </div>
                </div>

                {/* 1.5★ Tier */}
                <div className="bg-[#181818] border border-zinc-800 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">1.5 Intent</span>
                    <Film className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {tasteMatrix.signalsCount.watchlist}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Watchlist / Bookmarked Intent
                  </div>
                </div>

                {/* 0.0★ Hard Filter Tier */}
                <div className="bg-[#181818] border border-red-900/40 p-3 flex flex-col justify-between bg-gradient-to-b from-red-950/20 to-transparent">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">0.0 Disliked</span>
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                  <div className="mt-2 text-lg font-black text-rose-400">
                    {tasteMatrix.hardFilteredIds.length}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Letterboxd &lt;3★ (Hard Excluded)
                  </div>
                </div>
              </div>

              {/* Cinema Taste DNA & Genre Affinities */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cinema Taste DNA Capsule */}
                <div className="bg-[#181818] border border-zinc-800 p-6 space-y-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-rose-600/15 via-amber-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-xs uppercase tracking-widest font-black text-white">Your Cinema Taste DNA</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900/90 px-2 py-0.5 border border-zinc-800">
                      {tasteMatrix.interactions.length} Interactions
                    </span>
                  </div>

                  {/* Archetype Badge & Narrative */}
                  <div className="space-y-2">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-rose-400">
                      Viewer Archetype
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl" role="img" aria-label="archetype icon">
                        {viewerArchetype.icon}
                      </span>
                      <div>
                        <h4 className="text-lg font-black text-white tracking-tight">
                          {viewerArchetype.title}
                        </h4>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                          "{viewerArchetype.tagline}"
                        </p>
                      </div>
                    </div>
                    <div className="pt-1 text-[11px] text-zinc-500 italic">
                      Vibe: {viewerArchetype.vibe}
                    </div>
                  </div>

                  {/* Genre Spectrum Bar */}
                  {tasteMatrix.topGenres.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Genre Spectrum</span>
                        <span className="text-zinc-500 text-[10px]">BM25 Normalized</span>
                      </div>
                      <div className="w-full h-3 bg-zinc-900 rounded-none overflow-hidden flex border border-zinc-800">
                        {(() => {
                          const top4 = tasteMatrix.topGenres.slice(0, 4);
                          const totalTopScore = top4.reduce((acc, g) => acc + g.score, 0) || 1;
                          const colors = [
                            'bg-[#E50914]',
                            'bg-amber-500',
                            'bg-emerald-500',
                            'bg-sky-500',
                          ];
                          return top4.map((g, idx) => {
                            const pct = Math.round((g.score / totalTopScore) * 100);
                            return (
                              <div
                                key={g.id}
                                style={{ width: `${pct}%` }}
                                className={`${colors[idx % colors.length]} h-full transition-all duration-300`}
                                title={`${g.name}: ${pct}%`}
                              />
                            );
                          });
                        })()}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-400 pt-1">
                        {(() => {
                          const top4 = tasteMatrix.topGenres.slice(0, 4);
                          const totalTopScore = top4.reduce((acc, g) => acc + g.score, 0) || 1;
                          const dotColors = [
                            'bg-[#E50914]',
                            'bg-amber-500',
                            'bg-emerald-500',
                            'bg-sky-500',
                          ];
                          return top4.map((g, idx) => {
                            const pct = Math.round((g.score / totalTopScore) * 100);
                            return (
                              <div key={g.id} className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 ${dotColors[idx % dotColors.length]}`} />
                                <span className="font-medium text-zinc-300">{g.name}</span>
                                <span className="text-zinc-500">({pct}%)</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Signature Narrative Tropes */}
                  {topSubgenres.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                        Signature Narrative Tropes
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {topSubgenres.slice(0, 6).map((sub) => (
                          <span
                            key={sub.name}
                            className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300"
                          >
                            #{sub.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Auteurs & Directors (1.5x Multiplier) */}
                  {tasteMatrix.topDirectors && tasteMatrix.topDirectors.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 flex items-center gap-1.5">
                          <Clapperboard className="w-3.5 h-3.5" />
                          <span>Top Auteurs & Directors</span>
                        </span>
                        <span className="text-zinc-500 text-[10px] font-mono">1.5× Multiplier</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {tasteMatrix.topDirectors.slice(0, 4).map((d) => (
                          <div
                            key={d.name}
                            className="bg-zinc-900/90 border border-zinc-800/80 px-2.5 py-1.5 flex items-center justify-between"
                          >
                            <span className="text-xs font-semibold text-zinc-200 truncate" title={d.name}>
                              {d.name}
                            </span>
                            <span className="text-[10px] font-mono text-rose-400 font-bold ml-1 flex-shrink-0">
                              {d.score.toFixed(1)} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Actors & Stars (0.9x Multiplier) */}
                  {tasteMatrix.topActors && tasteMatrix.topActors.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          <span>Top Actors & Stars</span>
                        </span>
                        <span className="text-zinc-500 text-[10px] font-mono">0.9× Multiplier</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {tasteMatrix.topActors.slice(0, 4).map((a) => (
                          <div
                            key={a.name}
                            className="bg-zinc-900/90 border border-zinc-800/80 px-2.5 py-1.5 flex items-center justify-between"
                          >
                            <span className="text-xs font-semibold text-zinc-200 truncate" title={a.name}>
                              {a.name}
                            </span>
                            <span className="text-[10px] font-mono text-amber-400 font-bold ml-1 flex-shrink-0">
                              {a.score.toFixed(1)} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Thematic Series & Film Tags (1.2x Multiplier) */}
                  {tasteMatrix.topTags && tasteMatrix.topTags.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5" />
                          <span>Thematic Narrative Tags</span>
                        </span>
                        <span className="text-zinc-500 text-[10px] font-mono">1.2× Multiplier</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {tasteMatrix.topTags.slice(0, 8).map((t) => (
                          <span
                            key={t.name}
                            className="px-2 py-0.5 bg-emerald-950/30 border border-emerald-800/40 text-[11px] font-mono text-emerald-300 flex items-center gap-1"
                          >
                            <span>#{t.name}</span>
                            <span className="text-emerald-500 text-[9px]">({t.score.toFixed(1)})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Taste Metrics Summary */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/60 text-center">
                    <div className="bg-zinc-900/60 p-2 border border-zinc-800/80">
                      <div className="text-[9px] uppercase font-bold text-zinc-500">Letterboxd Avg</div>
                      <div className="text-white font-bold font-mono text-sm mt-0.5">
                        {userRatings.length > 0
                          ? `${(userRatings.reduce((acc, r) => acc + (r.rating || 0), 0) / userRatings.length).toFixed(1)}★`
                          : '—'}
                      </div>
                    </div>
                    <div className="bg-zinc-900/60 p-2 border border-zinc-800/80">
                      <div className="text-[9px] uppercase font-bold text-zinc-500">Catalog Watched</div>
                      <div className="text-white font-bold font-mono text-sm mt-0.5">
                        {watchedList.length + watchHistory.length}
                      </div>
                    </div>
                    <div className="bg-zinc-900/60 p-2 border border-zinc-800/80">
                      <div className="text-[9px] uppercase font-bold text-zinc-500">Dampener (BM25)</div>
                      <div className="text-emerald-400 font-bold font-mono text-sm mt-0.5">
                        {tasteMatrix.bm25Dampener.toFixed(2)}×
                      </div>
                    </div>
                  </div>
                </div>

                {/* Normalized Multi-Entity Affinities (Genres, Directors, Actors) */}
                <div className="bg-[#181818] border border-zinc-800 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-rose-400" />
                      <span>Multi-Entity Taste Weights</span>
                    </h3>
                    {/* Entity Tab Selector */}
                    <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5">
                      <button
                        onClick={() => setAffinityTab('genres')}
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase transition ${
                          affinityTab === 'genres'
                            ? 'bg-rose-600 text-white'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Genres ({tasteMatrix.topGenres.length})
                      </button>
                      <button
                        onClick={() => setAffinityTab('directors')}
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase transition ${
                          affinityTab === 'directors'
                            ? 'bg-rose-600 text-white'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Auteurs ({tasteMatrix.topDirectors.length})
                      </button>
                      <button
                        onClick={() => setAffinityTab('actors')}
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase transition ${
                          affinityTab === 'actors'
                            ? 'bg-rose-600 text-white'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Cast ({tasteMatrix.topActors.length})
                      </button>
                    </div>
                  </div>

                  {/* Tab 1: Genres */}
                  {affinityTab === 'genres' && (
                    <div className="space-y-3">
                      <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                        <span>Coarse Categories (BM25 Normalized)</span>
                        <span className="font-mono text-zinc-500 text-[10px]">1.0× Base</span>
                      </div>
                      {tasteMatrix.topGenres.length === 0 ? (
                        <div className="p-6 text-center text-zinc-500 text-xs">
                          No genre interactions registered yet. Rate movies or import Letterboxd to populate affinities.
                        </div>
                      ) : (
                        tasteMatrix.topGenres.slice(0, 5).map((genre) => {
                          const maxScore = tasteMatrix.topGenres[0]?.score || 1;
                          const pct = Math.min(100, Math.round((genre.score / maxScore) * 100));
                          return (
                            <div key={genre.id} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-zinc-200">{genre.name}</span>
                                <span className="font-mono text-zinc-400 text-[11px]">
                                  {genre.score.toFixed(1)} pts
                                </span>
                              </div>
                              <div className="w-full bg-zinc-900 h-2 border border-zinc-800 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-rose-600 to-amber-500 h-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Tab 2: Directors */}
                  {affinityTab === 'directors' && (
                    <div className="space-y-3">
                      <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                        <span>Auteur Directorial Affinity (Dislikes Penalized)</span>
                        <span className="font-mono text-rose-400 text-[10px] font-bold">1.5× Multiplier</span>
                      </div>
                      {tasteMatrix.topDirectors.length === 0 ? (
                        <div className="p-6 text-center text-zinc-500 text-xs">
                          No director affinities computed yet. Rate movies or import Letterboxd to extract auteurs.
                        </div>
                      ) : (
                        tasteMatrix.topDirectors.slice(0, 5).map((director) => {
                          const maxScore = tasteMatrix.topDirectors[0]?.score || 1;
                          const pct = Math.min(100, Math.round((director.score / maxScore) * 100));
                          return (
                            <div key={director.name} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                                  <Clapperboard className="w-3 h-3 text-rose-500" />
                                  <span>{director.name}</span>
                                </span>
                                <span className="font-mono text-rose-400 text-[11px] font-bold">
                                  {director.score.toFixed(1)} pts
                                </span>
                              </div>
                              <div className="w-full bg-zinc-900 h-2 border border-zinc-800 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-400 h-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Tab 3: Actors */}
                  {affinityTab === 'actors' && (
                    <div className="space-y-3">
                      <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                        <span>Lead Cast & Star Affinity (Dislikes Penalized)</span>
                        <span className="font-mono text-amber-400 text-[10px] font-bold">0.9× Multiplier</span>
                      </div>
                      {tasteMatrix.topActors.length === 0 ? (
                        <div className="p-6 text-center text-zinc-500 text-xs">
                          No actor affinities computed yet. Rate movies or import Letterboxd to extract talent.
                        </div>
                      ) : (
                        tasteMatrix.topActors.slice(0, 5).map((actor) => {
                          const maxScore = tasteMatrix.topActors[0]?.score || 1;
                          const pct = Math.min(100, Math.round((actor.score / maxScore) * 100));
                          return (
                            <div key={actor.name} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                                  <Users className="w-3 h-3 text-amber-400" />
                                  <span>{actor.name}</span>
                                </span>
                                <span className="font-mono text-amber-400 text-[11px] font-bold">
                                  {actor.score.toFixed(1)} pts
                                </span>
                              </div>
                              <div className="w-full bg-zinc-900 h-2 border border-zinc-800 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Universal Subgenres & Thematic Narrative Tropes */}
              <div className="bg-[#181818] border border-zinc-800 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      Discovered Subgenres & Narrative Tropes
                    </h3>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5">
                    50,928 Mapped Titles + TV Taxonomy
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  Moving beyond broad TMDB categories like "Action" or "Drama", our engine resolves fine-grained subgenres (Cyberpunk, Psychological Thriller, Neo-Noir, Heist, Time Loop) mapped across movies and series.
                </p>

                {topSubgenres.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500 text-xs">
                    No subgenres registered yet. Rate or like titles to unlock deep subgenre affinities.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {topSubgenres.map((sg) => (
                      <div
                        key={sg.name}
                        className="bg-zinc-900/80 border border-zinc-800 p-3 flex flex-col justify-between hover:border-zinc-700 transition"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-xs text-white capitalize truncate" title={sg.name}>
                            {sg.name}
                          </span>
                          <span className="font-mono text-zinc-400 text-[10px] font-bold flex-shrink-0">
                            {sg.score.toFixed(1)} pts
                          </span>
                        </div>
                        {sg.cluster ? (
                          <div className="mt-2 text-[9px] text-rose-400 font-mono uppercase tracking-wider truncate bg-rose-950/30 px-1.5 py-0.5 border border-rose-900/40 self-start">
                            {sg.cluster}
                          </div>
                        ) : (
                          <div className="mt-2 text-[9px] text-zinc-500 font-mono uppercase tracking-wider">
                            Thematic Trope
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Content Graph Seeds & Latent Semantic Representation */}
              <div className="bg-[#181818] border border-zinc-800 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-rose-500" />
                    <h3 className="text-sm font-bold text-white">
                      Learned Taste Vectors & Content Graph Seeds
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5">
                    128-D Latent Semantic Space Active
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  High-precision candidate generation extracts director, key cast, and thematic tags (like "time travel", "cyberpunk", "heist") from your top-weighted seeds to construct parallel candidate pools across TMDB recommendations and targeted discover queries.
                </p>

                {tasteMatrix.positiveSeeds.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500">
                    No positive seeds yet. Like titles or rate movies 3.5★–5.0★ to train your content graph.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {tasteMatrix.positiveSeeds.slice(0, 4).map((seed, idx) => (
                      <div
                        key={`seed-${seed.id}-${idx}`}
                        className="bg-zinc-900/80 border border-zinc-800 p-3 space-y-2 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-rose-400">
                              Seed #{idx + 1}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-amber-400">
                              {seed.normalizedWeight.toFixed(2)} pts
                            </span>
                          </div>
                          <h5 className="font-bold text-xs text-white truncate mt-1" title={seed.title}>
                            {seed.title}
                          </h5>
                          <div className="text-[10px] text-zinc-400 capitalize mt-0.5">
                            Signal: {seed.primarySignal.replace('_', ' ')}
                          </div>
                        </div>

                        <div className="text-[10px] text-zinc-500 font-mono pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                          <span>Graph Vector</span>
                          <span className="text-emerald-400 font-semibold">Active</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hard Filter Penalties (0.0 Weight) Table */}
              {tasteMatrix.hardFilteredIds.length > 0 && (
                <div className="bg-red-950/20 border border-red-900/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-500" />
                      <h4 className="text-sm font-bold text-rose-200">
                        Hard-Filtered Disliked Titles ({tasteMatrix.hardFilteredIds.length})
                      </h4>
                    </div>
                    <span className="text-[10px] uppercase font-mono text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2 py-0.5">
                      Excluded from Re-ranking
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Titles rated &lt; 3.0★ (1★–2.5★) on Letterboxd or marked as Disliked receive a mathematical weight of 0.0, are completely excluded from candidate suggestions, and actively apply negative penalties to their associated director and actor taste weights.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {tasteMatrix.interactions
                      .filter((i) => i.isHardFiltered)
                      .slice(0, 16)
                      .map((item) => (
                        <span
                          key={`hardfilter-${item.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/60 border border-red-900/60 text-zinc-300 text-xs font-mono"
                        >
                          <span className="text-rose-500 font-bold">✕</span>
                          <span>{item.title}</span>
                          <span className="text-[10px] text-zinc-500">({item.userRating ? `${item.userRating}★` : '1-2★'})</span>
                        </span>
                      ))}
                    {tasteMatrix.hardFilteredIds.length > 16 && (
                      <span className="px-2.5 py-1 bg-zinc-900 text-zinc-500 text-xs font-mono">
                        +{tasteMatrix.hardFilteredIds.length - 16} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      )}

      {/* Letterboxd Import Modal */}
      <LetterboxdImportModal
        isOpen={isLetterboxdOpen}
        onClose={() => {
          setIsLetterboxdOpen(false);
          setDroppedFile(null);
        }}
        initialFile={droppedFile}
      />

      {/* Manual Add Watched Modal */}
      <AddWatchedModal
        isOpen={isAddWatchedOpen}
        onClose={() => setIsAddWatchedOpen(false)}
      />

      {/* 5-Star Letterboxd Style Rating Modal */}
      <StarRatingModal
        isOpen={!!ratingModalMedia}
        onClose={() => setRatingModalMedia(null)}
        media={ratingModalMedia}
      />
    </div>
  );
};

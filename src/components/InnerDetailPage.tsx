import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import type { MediaItem, Episode } from '../types/movie';
import { useStreamStore } from '../store/useStreamStore';
import {
  fetchSeasonEpisodes,
  fetchMediaDetails,
  getPosterUrl,
  getBackdropUrl,
  getLogoUrl,
  fetchMediaLogo,
  fetchCredits,
  getCachedLogo,
  ALL_CURATED_MEDIA,
  searchWithTMDB,
  fetchRecommendations
} from '../services/tmdb';
import { NetflixNavbar } from './NetflixNavbar';
import { SearchResults } from './SearchResults';
import {
  Play,
  Star,
  Calendar,
  Sparkles,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Heart,
  Bookmark,
} from 'lucide-react';
import { StarRatingModal } from './StarRatingModal';
import { MediaCard } from './MediaCard';

interface InnerDetailPageProps {
  mediaId?: number;
  initialType?: 'movie' | 'tv';
  onBack?: () => void;
  onSelectRelated?: (item: MediaItem) => void;
  allMedia?: MediaItem[];
}

export const InnerDetailPage: React.FC<InnerDetailPageProps> = ({
  mediaId,
  initialType,
  onBack: _onBack,
  onSelectRelated,
  allMedia,
}) => {
  const params = useParams<{ id?: string; type?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Resolve mediaId: route param takes precedence, then props
  const resolvedMediaId = params.id ? parseInt(params.id, 10) : mediaId || 0;

  // Resolve type: route param 'type' or path prefix (/tv, /series, /movie), then props
  const resolvedType: 'movie' | 'tv' = (
    params.type === 'tv' || params.type === 'movie'
      ? params.type
      : location.pathname.startsWith('/tv') || location.pathname.startsWith('/series')
      ? 'tv'
      : initialType || 'movie'
  );

  const querySeason = searchParams.get('season') ? parseInt(searchParams.get('season')!, 10) : null;
  const queryEpisode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!, 10) : null;

  const [media, setMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  // Separate player state (what is actually playing) from viewing state (what season the user is browsing)
  const [playingSeason, setPlayingSeason] = useState(querySeason || 1);
  const [playingEpisode, setPlayingEpisode] = useState(queryEpisode || 1);
  const [viewingSeason, setViewingSeason] = useState(querySeason || 1);
  const [playingEp, setPlayingEp] = useState<Episode | null>(null);
  const [resumeBadge, setResumeBadge] = useState<{ time: number; visible: boolean } | null>(null);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [autoResumed, setAutoResumed] = useState(false);
  const [isSeasonOpen, setIsSeasonOpen] = useState(false);
  const seasonDropdownRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [playerWidth, setPlayerWidth] = useState<number | null>(null);

  // Sync details section width to match the streaming player container exactly
  useEffect(() => {
    if (!playerRef.current) return;
    const updateWidth = () => {
      if (playerRef.current) {
        setPlayerWidth(playerRef.current.offsetWidth);
      }
    };
    updateWidth();

    const ro = new ResizeObserver(() => {
      updateWidth();
    });
    ro.observe(playerRef.current);
    window.addEventListener('resize', updateWidth);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Close season dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        seasonDropdownRef.current &&
        !seasonDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSeasonOpen(false);
      }
    };
    if (isSeasonOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSeasonOpen]);

  // Search state for unified navbar
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Transparent title PNG logo & cast states
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [cast, setCast] = useState<string[]>([]);

  // Dynamic TMDB Recommendations for "More Like This"
  const [relatedMedia, setRelatedMedia] = useState<MediaItem[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const saveSeriesEpisode = useStreamStore((state) => state.saveSeriesEpisode);
  const getSeriesLastEpisode = useStreamStore((state) => state.getSeriesLastEpisode);
  const saveMovieToHistory = useStreamStore((state) => state.saveMovieToHistory);
  const toggleLike = useStreamStore((state) => state.toggleLike);
  const isLiked = useStreamStore((state) => state.isLiked);
  const toggleWatched = useStreamStore((state) => state.toggleWatched);
  const isWatched = useStreamStore((state) => state.isWatched);
  const toggleWatchlist = useStreamStore((state) => state.toggleWatchlist);
  const isInWatchlist = useStreamStore((state) => state.isInWatchlist);
  const getMediaRating = useStreamStore((state) => state.getMediaRating);
  const getPlaybackProgress = useStreamStore((state) => state.getPlaybackProgress);

  const [ratingModalMedia, setRatingModalMedia] = useState<MediaItem | null>(null);

  // Fetch dynamic TMDB recommendations when media changes
  useEffect(() => {
    let isMounted = true;
    if (!media) {
      setRelatedMedia([]);
      return;
    }

    setLoadingRelated(true);
    fetchRecommendations(media.id, media.media_type)
      .then((recs) => {
        if (!isMounted) return;
        if (recs && recs.length > 0) {
          setRelatedMedia(recs);
        } else {
          // Fallback to media pool if TMDB has no direct recommendations
          const pool = allMedia && allMedia.length > 0 ? allMedia : ALL_CURATED_MEDIA;
          setRelatedMedia(pool.filter((m) => m.id !== media.id).slice(0, 12));
        }
        setLoadingRelated(false);
      })
      .catch(() => {
        if (!isMounted) return;
        const pool = allMedia && allMedia.length > 0 ? allMedia : ALL_CURATED_MEDIA;
        setRelatedMedia(pool.filter((m) => m.id !== media.id).slice(0, 12));
        setLoadingRelated(false);
      });

    return () => {
      isMounted = false;
    };
  }, [media?.id, media?.media_type, allMedia]);

  // Fetch transparent title logo & cast whenever media changes
  useEffect(() => {
    let isMounted = true;
    const instantLogo = media?.logo_path || (media ? getCachedLogo(media.id, media.media_type) : null);
    if (instantLogo) {
      setLogoPath(instantLogo);
      setLogoFailed(false);
    } else {
      setLogoPath(null);
      setLogoFailed(false);
    }
    setCast([]);

    if (media) {
      if (!instantLogo) {
        fetchMediaLogo(media.id, media.media_type).then((path) => {
          if (isMounted && path) {
            setLogoPath(path);
          }
        });
      }

      fetchCredits(media.id, media.media_type).then((names) => {
        if (isMounted && names && names.length > 0) {
          setCast(names);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [media]);

  // Search with debounce using tmdb-ts
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchWithTMDB(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load media details once on mount or when route media changes
  useEffect(() => {
    let isMounted = true;
    if (!resolvedMediaId) return;

    setLoading(true);

    const loadData = async () => {
      const details = await fetchMediaDetails(resolvedMediaId, resolvedType);
      if (!isMounted) return;

      if (details) {
        setMedia(details);

        if (details.media_type === 'tv') {
          // Read initial season/episode from URL or Zustand saved progress
          const urlParams = new URLSearchParams(window.location.search);
          const initialQSeason = urlParams.get('season') ? parseInt(urlParams.get('season')!, 10) : null;
          const initialQEpisode = urlParams.get('episode') ? parseInt(urlParams.get('episode')!, 10) : null;

          let s = 1;
          let e = 1;
          if (initialQSeason && initialQEpisode) {
            s = initialQSeason;
            e = initialQEpisode;
            setAutoResumed(false);
          } else {
            // Check Zustand for previously saved episode
            const savedProgress = getSeriesLastEpisode(details.id);
            if (savedProgress) {
              s = savedProgress.season;
              e = savedProgress.episode;
              setAutoResumed(true);
            } else {
              setAutoResumed(false);
            }
          }

          setPlayingSeason(s);
          setPlayingEpisode(e);
          setViewingSeason(s);

          // Update address bar cleanly with window.history.replaceState without page refresh
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('season', String(s));
            url.searchParams.set('episode', String(e));
            window.history.replaceState(null, '', url.pathname + url.search);
          } catch {
            // Ignore
          }

          // Check if we have saved progress timestamp for this specific episode
          const savedTime = getPlaybackProgress(details.id, 'tv', s, e);
          if (savedTime && savedTime > 15) {
            setResumeBadge({ time: savedTime, visible: true });
          }

          // Save to Continue Watching
          saveSeriesEpisode(details.id, s, e, {
            title: details.title,
            overview: details.overview,
            poster_path: details.poster_path,
            backdrop_path: details.backdrop_path,
            release_date: details.release_date,
            vote_average: details.vote_average,
            number_of_seasons: details.number_of_seasons,
            seasons: details.seasons,
            episode_run_time: details.episode_run_time,
          });
        } else {
          // Record movie to history
          saveMovieToHistory(details);
        }
      }
      setLoading(false);
    };

    loadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    return () => {
      isMounted = false;
    };
  }, [resolvedMediaId, resolvedType]);

  // Load episodes when viewingSeason changes for a TV show
  useEffect(() => {
    if (media && media.media_type === 'tv') {
      let isMounted = true;
      setLoadingEpisodes(true);

      fetchSeasonEpisodes(media.id, viewingSeason).then((eps) => {
        if (isMounted) {
          setEpisodes(eps);
          setLoadingEpisodes(false);

          const foundRuntime = eps.find((e) => e.runtime && e.runtime > 0)?.runtime;
          if (foundRuntime && (!media.episode_run_time || media.episode_run_time.length === 0)) {
            media.episode_run_time = [foundRuntime];
          }

          // If this season is currently playing, sync playingEp details
          if (viewingSeason === playingSeason) {
            const current = eps.find((e) => e.episode_number === playingEpisode);
            if (current) {
              setPlayingEp(current);
              const actualRuntime = current.runtime || foundRuntime || (media.episode_run_time && media.episode_run_time[0]);
              saveSeriesEpisode(media.id, playingSeason, playingEpisode, {
                title: media.title,
                overview: media.overview,
                poster_path: media.poster_path,
                backdrop_path: media.backdrop_path,
                release_date: media.release_date,
                vote_average: media.vote_average,
                number_of_seasons: media.number_of_seasons,
                seasons: media.seasons,
                episode_run_time: actualRuntime ? [actualRuntime] : media.episode_run_time,
              });
            }
          }
        }
      });

      return () => {
        isMounted = false;
      };
    }
  }, [media?.id, media?.media_type, viewingSeason]);

  // Keep playingEp populated if playingSeason is different from viewingSeason
  useEffect(() => {
    if (media && media.media_type === 'tv' && playingSeason !== viewingSeason) {
      let isMounted = true;
      fetchSeasonEpisodes(media.id, playingSeason).then((eps) => {
        if (isMounted) {
          const current = eps.find((e) => e.episode_number === playingEpisode);
          if (current) setPlayingEp(current);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [media?.id, media?.media_type, playingSeason, playingEpisode, viewingSeason]);

  // Handle explicitly playing an episode -> updates player, Zustand store and URL cleanly without refresh!
  const handleSelectEpisode = (seasonNum: number, episodeNum: number, scroll = false) => {
    setPlayingSeason(seasonNum);
    setPlayingEpisode(episodeNum);
    setViewingSeason(seasonNum);

    // Update URL query parameters cleanly with window.history.replaceState (zero page refresh!)
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('season', String(seasonNum));
      url.searchParams.set('episode', String(episodeNum));
      window.history.replaceState(null, '', url.pathname + url.search);
    } catch {
      // Ignore
    }

    // Find and update playing episode info
    const epObj = episodes.find((e) => e.episode_number === episodeNum && viewingSeason === seasonNum);
    if (epObj) {
      setPlayingEp(epObj);
    }

    if (media) {
      const actualRuntime = epObj?.runtime || (media.episode_run_time && media.episode_run_time[0]);
      saveSeriesEpisode(media.id, seasonNum, episodeNum, {
        title: media.title,
        overview: media.overview,
        poster_path: media.poster_path,
        backdrop_path: media.backdrop_path,
        release_date: media.release_date,
        vote_average: media.vote_average,
        number_of_seasons: media.number_of_seasons,
        seasons: media.seasons,
        episode_run_time: actualRuntime ? [actualRuntime] : media.episode_run_time,
      });
    }

    if (scroll) {
      const playerEl = document.getElementById('vidbolt-player-container');
      if (playerEl) {
        playerEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Play next episode
  const handleNextEpisode = () => {
    if (!media || media.media_type !== 'tv') return;

    // Check if next episode exists in current season
    const nextEpNum = playingEpisode + 1;
    const hasNextInSeason = episodes.some((e) => e.episode_number === nextEpNum);

    if (hasNextInSeason) {
      handleSelectEpisode(playingSeason, nextEpNum, false);
      return;
    }

    // Otherwise check next season
    const totalSeasons = media.number_of_seasons || (media.seasons ? media.seasons.length : 1);
    if (playingSeason + 1 <= totalSeasons) {
      handleSelectEpisode(playingSeason + 1, 1, false);
    }
  };

  // PostMessage Bridge with VidBolt Player (ended, next_episode)
  useEffect(() => {
    if (!media) return;

    const handleMessage = (event: MessageEvent) => {
      // Security check: only listen to events from vidbolt
      if (!event.origin || !event.origin.includes('vidbolt')) return;

      const data = event.data;
      if (!data) return;

      // 1. Playback finished / ended event -> Auto Advance to Next Episode!
      if (data.type === 'ended' || data.event === 'ended') {
        if (media.media_type === 'tv') {
          handleNextEpisode();
        }
      }

      // 2. In-player Next Episode button or custom episode picker event
      if (
        data.type === 'next_episode' ||
        data.type === 'next' ||
        data.event === 'next_episode' ||
        data.event === 'next'
      ) {
        if (media.media_type === 'tv') {
          handleNextEpisode();
        }
      }

      // 3. If player sends specific episode data: { type: 'episode_change', season: 1, episode: 3 }
      const newSeason = data.season ?? data.season_number;
      const newEpisode = data.episode ?? data.episode_number;
      if (typeof newSeason === 'number' && typeof newEpisode === 'number') {
        if (newSeason !== playingSeason || newEpisode !== playingEpisode) {
          handleSelectEpisode(newSeason, newEpisode, false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [media, playingSeason, playingEpisode, episodes]);



  const handleSelectRelated = (item: MediaItem) => {
    setSearchQuery('');
    if (onSelectRelated) {
      onSelectRelated(item);
    }
    navigate(`/${item.media_type || 'movie'}/${item.id}`);
  };

  if (loading || !media) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex flex-col">
        <NetflixNavbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
      />

        {searchQuery ? (
          <SearchResults
            query={searchQuery}
            results={searchResults}
            loading={isSearching}
            onSelect={handleSelectRelated}
            onClear={() => setSearchQuery('')}
          />
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center space-y-4 pt-24">
            <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-zinc-400">Loading title & stream sources...</p>
          </div>
        )}
      </div>
    );
  }

  // Construct Vidbolt stream URL according to specifications (uses playingSeason & playingEpisode)
  const streamUrl =
    media.media_type === 'tv'
      ? `https://vidbolt.xyz/tv/${media.id}/${playingSeason}/${playingEpisode}`
      : `https://vidbolt.xyz/movie/${media.id}`;

  const backdrop = getBackdropUrl(media.backdrop_path);
  const poster = getPosterUrl(media.poster_path);
  const releaseYear = media.release_date ? new Date(media.release_date).getFullYear() : '';
  const totalSeasons = media.number_of_seasons || (media.seasons ? media.seasons.length : 1);
  const currentEp = playingEp || episodes.find((e) => e.episode_number === playingEpisode);

  return (
    <div className="relative min-h-screen bg-[#141414] text-zinc-100 pb-20 selection:bg-rose-600 selection:text-white">
      {/* Ambient Backdrop Glow */}
      <div className="absolute top-0 left-0 right-0 h-screen overflow-hidden pointer-events-none opacity-20 filter blur-3xl z-0">
        <img src={backdrop} alt="" className="w-full h-full object-cover" />
      </div>

      {/* Netflix Top Navigation Bar (Fixed location, auto-reveals on hover) */}
      <NetflixNavbar
        autoHide={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {searchQuery ? (
        <SearchResults
          query={searchQuery}
          results={searchResults}
          loading={isSearching}
          onSelect={handleSelectRelated}
          onClear={() => setSearchQuery('')}
        />
      ) : (
        <>
          {/* Full Screen Theater Section: Centered Player with 20px top & bottom padding */}
          <div className="relative w-full h-screen min-h-[500px] flex items-center justify-center p-[20px]">
            <div
              id="vidbolt-player-container"
              ref={playerRef}
              className="relative h-[calc(100vh-40px)] aspect-video max-w-[calc(100vw-40px)] bg-black rounded-none overflow-hidden border border-zinc-800 shadow-2xl shadow-black flex items-center justify-center group/player"
            >
              <iframe
                id="vidbolt-player"
                src={streamUrl}
                width="100%"
                height="100%"
                className="w-full h-full border-0 rounded-none"
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture"
                title={`${media.title} - Vidbolt Stream`}
              />

              {/* Auto Resume Alert if retrieved from Zustand - sleek bottom overlay */}
              {(autoResumed || resumeBadge?.visible) && media.media_type === 'tv' && (
                <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2.5 bg-black/85 backdrop-blur-md border-t border-rose-900/60 text-xs sm:text-sm">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>
                      Resumed from saved progress: <strong className="text-white">Season {playingSeason}, Episode {playingEpisode}</strong>
                      {resumeBadge?.time ? <span className="text-zinc-400 ml-1.5 font-normal">({Math.floor(resumeBadge.time / 60)}m {resumeBadge.time % 60}s)</span> : null}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setAutoResumed(false);
                        setResumeBadge(null);
                        handleSelectEpisode(1, 1, false);
                      }}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-rose-400 underline cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Start from S1:E1
                    </button>
                    <button
                      onClick={() => {
                        setAutoResumed(false);
                        setResumeBadge(null);
                      }}
                      className="text-zinc-400 hover:text-white text-xs px-1 cursor-pointer"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details, Seasons & Related Media below the theater - matches streaming iframe width */}
          <div
            style={{ width: playerWidth ? `${playerWidth}px` : undefined }}
            className="w-[min(calc(100vw-40px),calc((100vh-40px)*16/9))] max-w-[calc(100vw-40px)] mx-auto pt-10 space-y-8"
          >

        {/* Media Details & Episodes Section */}
        {media.media_type === 'tv' ? (
          /* TV Series: 60% Details, 40% Episodes Side-by-Side with Equal Height */
          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            {/* 60% Details Column (Matches Episodes container height) */}
            <div className="w-full lg:w-[60%] flex flex-col justify-between p-5 sm:p-6 rounded-none bg-[#181818] border border-zinc-800 h-auto lg:h-[520px]">
              {/* Top Section: Cover on Left, Show Details on Right */}
              <div className="flex flex-col sm:flex-row gap-5 items-start min-h-0">
                {/* Poster & Badges Column */}
                <div className="w-36 sm:w-44 flex-shrink-0 flex flex-col gap-2.5">
                  <img
                    src={poster}
                    alt={media.title}
                    className="w-full h-auto rounded-none shadow-xl border border-zinc-700/80 object-cover aspect-[2/3]"
                  />

                  {/* Total Seasons & Episode count under the cover */}
                  <div className="flex flex-col gap-1.5 text-xs pt-0.5 w-full">
                    <div className="border border-zinc-800/80 bg-zinc-900/40 p-2 rounded-none">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block leading-tight">Total Seasons</span>
                      <span className="font-semibold text-xs text-zinc-200 mt-0.5 block">{totalSeasons} Seasons</span>
                    </div>
                    <div className="border border-zinc-800/80 bg-zinc-900/40 p-2 rounded-none">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block leading-tight">Episodes in S{viewingSeason}</span>
                      <span className="font-semibold text-xs text-zinc-200 mt-0.5 block">{episodes.length} Episodes</span>
                    </div>
                  </div>
                </div>

                {/* Info & Features Column */}
                <div className="space-y-2.5 min-w-0 flex-1">
                  {/* Title: Transparent PNG Title Logo with Text Fallback */}
                  {!logoFailed && logoPath ? (
                    <div className="h-12 sm:h-16 max-w-xs flex items-center my-0.5">
                      <img
                        key={logoPath}
                        src={getLogoUrl(logoPath, 'w500') || ''}
                        alt={media.title}
                        onError={() => setLogoFailed(true)}
                        className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)] brightness-105"
                      />
                    </div>
                  ) : (
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {media.title}
                    </h1>
                  )}

                  {media.tagline && (
                    <p className="text-xs italic text-zinc-400 font-serif">"{media.tagline}"</p>
                  )}

                  {/* Genres */}
                  {media.genres && media.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {media.genres.map((g) => (
                        <span
                          key={g.id}
                          className="text-xs bg-zinc-800/80 text-zinc-300 px-2 py-0.5 rounded-none border border-zinc-700/80"
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Year & Rating under Genres + Like & Status buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400 pt-0.5">
                    <div className="flex flex-wrap items-center gap-3">
                      {releaseYear && (
                        <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{releaseYear}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                        <Star className="w-3.5 h-3.5 fill-zinc-400 text-zinc-400" />
                        <span>{media.vote_average ? media.vote_average.toFixed(1) : '8.0'}</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Letterboxd 5-Star Rating Trigger */}
                      <button
                        onClick={() => setRatingModalMedia(media)}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-none border transition-all cursor-pointer ${
                          getMediaRating(media.id)
                            ? 'bg-[#00E054] text-black border-[#00E054] shadow-md shadow-emerald-950/50'
                            : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border-zinc-700/80 hover:border-[#00E054] hover:text-[#00E054]'
                        }`}
                        title="Rate with Letterboxd 5-Stars"
                      >
                        <Star className={`w-3.5 h-3.5 ${getMediaRating(media.id) ? 'fill-black' : 'text-zinc-400'}`} />
                        <span>{getMediaRating(media.id) ? `${getMediaRating(media.id)}★ Rated` : 'Rate 5★'}</span>
                      </button>

                      {/* Watchlist Toggle */}
                      <button
                        onClick={() => toggleWatchlist(media)}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-none border transition-all cursor-pointer ${
                          isInWatchlist(media.id)
                            ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-950/50'
                            : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border-zinc-700/80 hover:border-amber-500 hover:text-amber-400'
                        }`}
                        title={isInWatchlist(media.id) ? 'In Watchlist! Click to remove' : 'Add to Watchlist'}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isInWatchlist(media.id) ? 'fill-white stroke-[2.5]' : 'text-amber-400'}`} />
                        <span>{isInWatchlist(media.id) ? 'In Watchlist' : 'Watchlist'}</span>
                      </button>

                      {/* Watched Toggle */}
                      <button
                        onClick={() => toggleWatched(media)}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-none border transition-all cursor-pointer ${
                          isWatched(media.id)
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/50'
                            : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border-zinc-700/80 hover:border-emerald-500 hover:text-emerald-400'
                        }`}
                        title={isWatched(media.id) ? 'Marked as watched! Click to unmark' : 'Mark as watched to update taste profile'}
                      >
                        <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isWatched(media.id) ? 'text-white' : 'text-emerald-400'}`} />
                        <span>{isWatched(media.id) ? 'Watched' : 'Mark Watched'}</span>
                      </button>

                      {/* Like Toggle */}
                      <button
                        onClick={() => toggleLike(media)}
                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-none border transition-all cursor-pointer ${
                          isLiked(media.id)
                            ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/50'
                            : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border-zinc-700/80'
                        }`}
                        title={isLiked(media.id) ? 'Liked! Click to remove from taste profile' : 'Like this title to tailor recommendations'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked(media.id) ? 'fill-white text-white' : 'text-rose-400'}`} />
                        <span>{isLiked(media.id) ? 'Liked' : 'Like'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Synopsis */}
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed line-clamp-3">
                    {media.overview || 'No overview available for this title.'}
                  </p>

                  {/* Starring Cast */}
                  {cast.length > 0 && (
                    <p className="text-xs text-zinc-400 truncate">
                      <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-wider mr-1.5">
                        Starring:
                      </span>
                      <span className="text-zinc-300">{cast.slice(0, 4).join(', ')}</span>
                    </p>
                  )}


                </div>
              </div>

              {/* Bottom Section: Full Width Now Streaming Card with More Height */}
              <div className="w-full ">
                <div className="border border-zinc-800 bg-zinc-900/70 p-3 sm:p-3.5 rounded-none flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Episode Thumbnail */}
                    <div className="w-28 sm:w-36 aspect-video bg-zinc-950 border border-zinc-800 shrink-0 relative overflow-hidden">
                      <img
                        src={currentEp?.still_path ? getBackdropUrl(currentEp.still_path) : backdrop}
                        alt={currentEp?.name || 'Episode thumbnail'}
                        className="w-full h-full object-cover"
                      />
                      {currentEp?.runtime && (
                        <span className="absolute bottom-1 right-1 text-[10px] bg-black/85 px-1.5 py-0.5 font-mono text-zinc-300">
                          {currentEp.runtime}m
                        </span>
                      )}
                    </div>

                    {/* Episode Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          Now Streaming
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-[11px] font-semibold text-zinc-300">
                          Season {playingSeason}, Episode {playingEpisode}
                        </span>
                      </div>
                      <h5 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                        {currentEp?.name || `Episode ${playingEpisode}`}
                      </h5>
                      {currentEp?.overview && (
                        <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                          {currentEp.overview}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Previous / Next Controls */}
                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                    {playingEpisode > 1 && (
                      <button
                        onClick={() => handleSelectEpisode(playingSeason, playingEpisode - 1)}
                        className="px-2.5 py-2 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-none border border-zinc-700 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                        title="Previous Episode"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Prev</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleSelectEpisode(playingSeason, playingEpisode + 1)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-none border border-zinc-700 transition cursor-pointer"
                      title="Next Episode"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Next Ep</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 40% Episodes Column (Equal height) */}
            <div className="w-full lg:w-[40%] bg-[#181818] border border-zinc-800 p-5 rounded-none flex flex-col h-[520px]">
              {/* Centered Selectable Season Header with Prev/Next Buttons */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 flex-shrink-0">
                {/* Prev Season Button */}
                <button
                  onClick={() => setViewingSeason((prev) => Math.max(1, prev - 1))}
                  disabled={viewingSeason <= 1}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 disabled:hover:bg-zinc-800 disabled:cursor-not-allowed text-zinc-300 hover:text-white rounded-none border border-zinc-700 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                  title="Previous Season"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                {/* Centered Selectable Season Custom Dropdown */}
                <div ref={seasonDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSeasonOpen((prev) => !prev)}
                    className="flex items-center gap-2 bg-[#242424] hover:bg-[#2c2c2c] text-white text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-none border border-zinc-700 hover:border-zinc-500 focus:outline-none focus:border-rose-500 cursor-pointer transition tracking-wide select-none"
                    aria-expanded={isSeasonOpen}
                    aria-haspopup="listbox"
                  >
                    <span>Season {viewingSeason}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                        isSeasonOpen ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  </button>

                  {/* Custom Styled Options Dropdown Menu */}
                  {isSeasonOpen && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-36 sm:w-44 bg-[#181818] border border-zinc-700 shadow-2xl shadow-black z-50 py-1 max-h-60 overflow-y-auto rounded-none"
                      role="listbox"
                    >
                      {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((sNum) => {
                        const isSelected = sNum === viewingSeason;
                        return (
                          <button
                            key={sNum}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setViewingSeason(sNum);
                              setIsSeasonOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#252525] text-white border-l-2 border-rose-600 font-bold'
                                : 'text-zinc-300 hover:bg-[#222222] hover:text-white'
                            }`}
                          >
                            <span>Season {sNum}</span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-rose-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Next Season Button */}
                <button
                  onClick={() => setViewingSeason((prev) => Math.min(totalSeasons, prev + 1))}
                  disabled={viewingSeason >= totalSeasons}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 disabled:hover:bg-zinc-800 disabled:cursor-not-allowed text-zinc-300 hover:text-white rounded-none border border-zinc-700 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                  title="Next Season"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Episodes List */}
              {loadingEpisodes ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-1 mt-3 space-y-2.5">
                  {episodes.map((ep) => {
                    const isCurrent = viewingSeason === playingSeason && ep.episode_number === playingEpisode;

                    return (
                      <div
                        key={ep.id}
                        onClick={() => handleSelectEpisode(viewingSeason, ep.episode_number)}
                        className={`flex items-center justify-between gap-3 p-3 rounded-none border transition-all duration-200 cursor-pointer ${
                          isCurrent
                            ? 'bg-[#222] border-rose-600/80 shadow-md shadow-rose-950/20'
                            : 'bg-[#181818] border-zinc-800/80 hover:bg-[#202020] hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* 16:9 Episode Thumbnail */}
                          <div className="relative w-24 sm:w-28 aspect-video bg-zinc-950 border border-zinc-800/90 rounded-none overflow-hidden shrink-0 group/ep">
                            <img
                              src={ep.still_path ? getBackdropUrl(ep.still_path) : backdrop}
                              alt={ep.name}
                              loading="lazy"
                              className="w-full h-full object-cover rounded-none transition-transform duration-300 group-hover/ep:scale-105"
                            />
                            {/* Play Overlay */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                              isCurrent ? 'bg-black/50 opacity-100' : 'bg-black/40 opacity-0 group-hover/ep:opacity-100'
                            }`}>
                              <div className={`w-7 h-7 rounded-none flex items-center justify-center shadow-lg ${
                                isCurrent ? 'bg-rose-600 text-white' : 'bg-white text-black'
                              }`}>
                                <Play className={`w-3.5 h-3.5 ml-0.5 ${isCurrent ? 'fill-white' : 'fill-black'}`} />
                              </div>
                            </div>
                            {/* Episode number tag */}
                         
                            {/* Episode runtime in thumbnail */}
                            {ep.runtime && (
                              <span className="absolute bottom-1 right-1 bg-black/85 text-[10px] font-mono text-zinc-300 px-1.5 py-0.5 border border-zinc-800">
                                {ep.runtime}m
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <h4
                              className={`text-xs sm:text-sm font-bold truncate ${
                                isCurrent ? 'text-rose-400' : 'text-white'
                              }`}
                            >
                              {ep.episode_number}. {ep.name}
                            </h4>
                            {ep.overview && (
                              <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                                {ep.overview}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectEpisode(viewingSeason, ep.episode_number);
                            }}
                            className={`px-2.5 py-1 rounded-none text-xs font-semibold flex items-center gap-1 transition ${
                              isCurrent
                                ? 'bg-rose-600 text-white'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-white hover:text-black'
                            }`}
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>{isCurrent ? 'Playing' : 'Play'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Movie: Dedicated Full Width Cinematic Banner */
          <div className="flex flex-col sm:flex-row gap-6 p-6 sm:p-8 rounded-none bg-[#181818] border border-zinc-800">
            {/* Movie Poster on Left */}
            <div className="w-36 sm:w-48 md:w-56 flex-shrink-0 flex flex-col gap-3">
              <img
                src={poster}
                alt={media.title}
                className="w-full rounded-none shadow-xl border border-zinc-700/80 object-cover aspect-[2/3]"
              />

              {/* Meta tags under cover */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {releaseYear && (
                  <span className="flex items-center gap-1 text-[11px] text-zinc-400 bg-zinc-900/80 px-2 py-0.5 rounded-none border border-zinc-800">
                    <Calendar className="w-3 h-3" />
                    {releaseYear}
                  </span>
                )}
                {media.vote_average ? (
                  <span className="flex items-center gap-1 text-[11px] text-zinc-300 font-semibold bg-zinc-800/80 px-2 py-0.5 rounded-none border border-zinc-700/60">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{media.vote_average.toFixed(1)}</span>
                  </span>
                ) : null}
                {isWatched(media.id) && (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-none border border-emerald-800/60">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                    <span>Watched</span>
                  </span>
                )}
              </div>
            </div>

            {/* Movie Details Column */}
            <div className="flex-1 space-y-4 flex flex-col justify-between min-w-0">
              <div className="space-y-3">
                {/* Title Logo or Header */}
                {!logoFailed && logoPath ? (
                  <div className="h-14 sm:h-20 max-w-sm flex items-center my-1">
                    <img
                      key={logoPath}
                      src={getLogoUrl(logoPath, 'w500') || ''}
                      alt={media.title}
                      onError={() => setLogoFailed(true)}
                      className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)] brightness-105"
                    />
                  </div>
                ) : (
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
                    {media.title}
                  </h1>
                )}

                {media.tagline && (
                  <p className="text-xs sm:text-sm italic text-zinc-400 font-serif">"{media.tagline}"</p>
                )}

                {/* Genres */}
                {media.genres && media.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {media.genres.map((g) => (
                      <span
                        key={g.id}
                        className="text-xs bg-zinc-800/80 text-zinc-300 px-2.5 py-0.5 rounded-none border border-zinc-700/80"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="flex flex-wrap items-center gap-2 pt-1 pb-2 border-b border-zinc-800/80">
                  {/* Letterboxd 5-Star Rating Trigger */}
                  <button
                    onClick={() => setRatingModalMedia(media)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-none border transition-all cursor-pointer ${
                      getMediaRating(media.id)
                        ? 'bg-[#00E054] text-black border-[#00E054] shadow-md shadow-emerald-950/50'
                        : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border-zinc-700/80 hover:border-[#00E054] hover:text-[#00E054]'
                    }`}
                    title="Rate with Letterboxd 5-Stars"
                  >
                    <Star className={`w-3.5 h-3.5 ${getMediaRating(media.id) ? 'fill-black' : 'text-zinc-400'}`} />
                    <span>{getMediaRating(media.id) ? `${getMediaRating(media.id)}★ Rated` : 'Rate 5★'}</span>
                  </button>

                  {/* Watchlist Toggle */}
                  <button
                    onClick={() => toggleWatchlist(media)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-none border transition-all cursor-pointer ${
                      isInWatchlist(media.id)
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-950/50'
                        : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border-zinc-700/80 hover:border-amber-500 hover:text-amber-400'
                    }`}
                    title={isInWatchlist(media.id) ? 'In Watchlist! Click to remove' : 'Add to Watchlist'}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${isInWatchlist(media.id) ? 'fill-white stroke-[2.5]' : 'text-amber-400'}`} />
                    <span>{isInWatchlist(media.id) ? 'In Watchlist' : 'Watchlist'}</span>
                  </button>

                  {/* Watched Toggle */}
                  <button
                    onClick={() => toggleWatched(media)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-none border transition-all cursor-pointer ${
                      isWatched(media.id)
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/50'
                        : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border-zinc-700/80 hover:border-emerald-500 hover:text-emerald-400'
                    }`}
                    title={isWatched(media.id) ? 'Marked as watched! Click to unmark' : 'Mark as watched to update taste profile'}
                  >
                    <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isWatched(media.id) ? 'text-white' : 'text-emerald-400'}`} />
                    <span>{isWatched(media.id) ? 'Watched' : 'Mark Watched'}</span>
                  </button>

                  {/* Like Toggle */}
                  <button
                    onClick={() => toggleLike(media)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-none border transition-all cursor-pointer ${
                      isLiked(media.id)
                        ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/50'
                        : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border-zinc-700/80'
                    }`}
                    title={isLiked(media.id) ? 'Liked! Click to remove from taste profile' : 'Like this title to tailor recommendations'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isLiked(media.id) ? 'fill-white text-white' : 'text-rose-400'}`} />
                    <span>{isLiked(media.id) ? 'Liked' : 'Like'}</span>
                  </button>
                </div>

                {/* Overview */}
                <p className="text-sm sm:text-base text-zinc-300 leading-relaxed pt-1">
                  {media.overview || 'No overview available for this title.'}
                </p>

                {/* Cast */}
                {cast.length > 0 && (
                  <p className="text-xs sm:text-sm text-zinc-400 pt-1">
                    <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-wider mr-2">
                      Starring:
                    </span>
                    <span className="text-zinc-200">{cast.slice(0, 8).join(', ')}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* More Like This / Dynamic TMDB Recommendations */}
        {(loadingRelated || relatedMedia.length > 0) && (
          <div className="space-y-4 pt-6 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                More Like This
              </h3>
              {loadingRelated && (
                <span className="text-xs text-zinc-500 animate-pulse">Finding recommendations...</span>
              )}
            </div>

            {loadingRelated && relatedMedia.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
                {[...Array(6)].map((_, idx) => (
                  <div key={idx} className="bg-zinc-900/60 border border-zinc-800 animate-pulse">
                    <div className="aspect-[2/3] w-full bg-zinc-800/50" />
                    <div className="p-2 space-y-2">
                      <div className="h-3 bg-zinc-800 rounded-none w-3/4" />
                      <div className="h-2.5 bg-zinc-800/60 rounded-none w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {relatedMedia.map((item, index) => (
                  <MediaCard
                    key={`${item.id}-${index}`}
                    item={item}
                    onSelect={handleSelectRelated}
                    isLiked={isLiked(item.id)}
                    onToggleLike={() => toggleLike(item)}
                    isWatched={isWatched(item.id)}
                    onToggleWatched={() => toggleWatched(item)}
                    isInWatchlist={isInWatchlist(item.id)}
                    onToggleWatchlist={() => toggleWatchlist(item)}
                    userRating={getMediaRating(item.id)}
                    onOpenRatingModal={() => setRatingModalMedia(item)}
                    className="w-full"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}

      {/* Letterboxd 5-Star Rating Modal */}
      <StarRatingModal
        isOpen={!!ratingModalMedia}
        onClose={() => setRatingModalMedia(null)}
        media={ratingModalMedia}
      />
    </div>
  );
};

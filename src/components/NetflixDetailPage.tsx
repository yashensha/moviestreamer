import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import type { MediaItem, Episode, Season, PersonItem } from '../types/movie';
import {
  fetchMediaDetails,
  fetchSeasonEpisodes,
  fetchMediaLogo,
  fetchCredits,
  fetchMediaKeywords,
  getCachedLogo,
  getBackdropUrl,
  getLogoUrl,
  fetchRecommendations,
  multiSearchWithTMDB,
} from '../services/tmdb';
import { useStreamStore } from '../store/useStreamStore';
import { getSavedPlaybackTime } from '../services/playbackStorage';
import { generateItemSpecificRecommendations } from '../services/recommendationPipeline';
import { NetflixNavbar } from './NetflixNavbar';
import { SearchResults } from './SearchResults';
import { NetflixTallCard } from './NetflixTallCard';
import { VideoPlayerModal } from './VideoPlayerModal';
import { Button } from './Button';
import {
  Play,
  Plus,
  Check,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Volume2,
  VolumeX,
  ChevronDown,
} from 'lucide-react';

export const NetflixDetailPage: React.FC = () => {
  const params = useParams<{ id: string; type?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const mediaId = params.id ? parseInt(params.id, 10) : 0;
  const mediaType: 'movie' | 'tv' =
    params.type === 'tv' || params.type === 'movie'
      ? params.type
      : location.pathname.startsWith('/tv') || location.pathname.startsWith('/series')
      ? 'tv'
      : 'movie';

  // State strictly initialized to fresh/empty values to prevent showing previous show's data
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<MediaItem | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [cast, setCast] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [isSeasonOpen, setIsSeasonOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [similarItems, setSimilarItems] = useState<MediaItem[]>([]);

  // Search state for unified NetflixNavbar
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [searchPeople, setSearchPeople] = useState<PersonItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const seasonDropdownRef = useRef<HTMLDivElement>(null);

  const watchlist = useStreamStore((state) => state.watchlist) || [];
  const watchHistory = useStreamStore((state) => state.watchHistory) || [];
  const likedMedia = useStreamStore((state) => state.likedMedia) || [];
  const userRatings = useStreamStore((state) => state.userRatings) || [];
  const dislikedMedia = useStreamStore((state) => state.dislikedMedia) || [];
  const toggleWatchlist = useStreamStore((state) => state.toggleWatchlist);
  const toggleLike = useStreamStore((state) => state.toggleLike);
  const toggleDislike = useStreamStore((state) => state.toggleDislike);
  const toggleWatched = useStreamStore((state) => state.toggleWatched);
  const isWatched = useStreamStore((state) => state.isWatched);
  const getSeriesLastEpisode = useStreamStore((state) => state.getSeriesLastEpisode);
  const saveSeriesEpisode = useStreamStore((state) => state.saveSeriesEpisode);
  const saveMovieToHistory = useStreamStore((state) => state.saveMovieToHistory);

  // Search with debounce using tmdb-ts multi-search
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

  // Close season dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        seasonDropdownRef.current &&
        !seasonDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSeasonOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch full details, logo, keywords, and credits on mount or when ID/type changes
  useEffect(() => {
    if (!mediaId) return;

    let isCurrent = true;

    // Flush all states immediately so no previous show's data ever flashes
    setLoading(true);
    setDetails(null);
    setLogoPath(null);
    setCast([]);
    setGenres([]);
    setTags([]);
    setEpisodes([]);
    setSimilarItems([]);
    setSelectedSeason(1);

    const cached = getCachedLogo(mediaId, mediaType);
    if (cached) setLogoPath(cached);

    Promise.all([
      fetchMediaDetails(mediaId, mediaType),
      fetchMediaLogo(mediaId, mediaType),
      fetchCredits(mediaId, mediaType),
      fetchMediaKeywords(mediaId, mediaType).catch(() => []),
      fetchRecommendations(mediaId, mediaType).catch(() => []),
    ])
      .then(([d, logo, credits, kws, recs]) => {
        if (!isCurrent) return;

        if (d) {
          setDetails(d);
          if (d.genres) {
            setGenres(d.genres.map((g) => g.name).slice(0, 4));
          }

          // Use our own multi-factor taste algorithm instead of raw TMDB recommendations
          generateItemSpecificRecommendations(
            d,
            watchHistory,
            likedMedia,
            userRatings,
            dislikedMedia,
            18
          )
            .then((tailored) => {
              if (isCurrent && tailored && tailored.length > 0) {
                setSimilarItems(tailored);
              }
            })
            .catch(() => {});
        }
        if (logo) setLogoPath(logo);
        if (Array.isArray(credits) && credits.length > 0) {
          setCast(
            credits
              .map((c: any) => (typeof c === 'string' ? c : c?.name || ''))
              .filter(Boolean)
              .slice(0, 5)
          );
        } else if ((credits as any)?.cast && Array.isArray((credits as any).cast)) {
          setCast(
            (credits as any).cast
              .map((c: any) => (typeof c === 'string' ? c : c?.name || ''))
              .filter(Boolean)
              .slice(0, 5)
          );
        }
        if (kws && kws.length > 0) {
          setTags(kws.slice(0, 4));
        }
        if (recs && recs.length > 0) {
          setSimilarItems((prev) => (prev.length === 0 ? recs.slice(0, 18) : prev));
        }
        setLoading(false);
      })
      .catch(() => {
        if (!isCurrent) return;
        setLoading(false);
      });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    return () => {
      isCurrent = false;
    };
  }, [mediaId, mediaType]);

  // Fetch episodes when selectedSeason changes for TV shows
  useEffect(() => {
    if (!details || details.media_type !== 'tv') {
      setEpisodes([]);
      setLoadingEpisodes(false);
      return;
    }

    let isCurrent = true;
    setLoadingEpisodes(true);

    fetchSeasonEpisodes(details.id, selectedSeason)
      .then((eps) => {
        if (!isCurrent) return;
        setEpisodes(eps);
        setLoadingEpisodes(false);
      })
      .catch(() => {
        if (!isCurrent) return;
        setEpisodes([]);
        setLoadingEpisodes(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [details?.id, selectedSeason, details?.media_type]);

  // Dynamic values without hardcoded placeholders:
  const isTv = (details?.media_type || mediaType) === 'tv';
  const lastEpisode = details && isTv ? getSeriesLastEpisode(details.id) : undefined;
  const activeSeason = lastEpisode?.season || selectedSeason || 1;
  const activeEpisode = lastEpisode?.episode || 1;

  const savedPlayback = details
    ? getSavedPlaybackTime(details.id, isTv ? 'tv' : 'movie', activeSeason, activeEpisode)
    : null;
  const hasProgress = Boolean(savedPlayback && savedPlayback.seconds > 5);

  const [searchParams, setSearchParams] = useSearchParams();
  const urlPlay = searchParams.get('play') === '1' || searchParams.get('play') === 'true';
  const urlSeason = searchParams.get('season') ? parseInt(searchParams.get('season')!, 10) : null;
  const urlEpisode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!, 10) : null;

  const [isPlayerOpen, setIsPlayerOpen] = useState(urlPlay);
  const [playingSeason, setPlayingSeason] = useState(urlSeason || activeSeason);
  const [playingEpisode, setPlayingEpisode] = useState(urlEpisode || activeEpisode);

  // Sync if URL play parameter changes
  useEffect(() => {
    if (urlPlay) {
      const s = urlSeason || activeSeason;
      const e = urlEpisode || activeEpisode;
      setPlayingSeason(s);
      setPlayingEpisode(e);
      setIsPlayerOpen(true);
    }
  }, [urlPlay, urlSeason, urlEpisode, activeSeason, activeEpisode]);

  const handlePlay = (season?: number, episode?: number) => {
    if (!details) return;
    const s = season || activeSeason;
    const e = episode || activeEpisode;

    if (isTv) {
      saveSeriesEpisode(details.id, s, e, {
        title: details.title,
        overview: details.overview,
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        release_date: details.release_date,
        vote_average: details.vote_average,
        number_of_seasons: details.number_of_seasons,
        seasons: details.seasons,
      });
      setPlayingSeason(s);
      setPlayingEpisode(e);
      // Change URL without refresh
      setSearchParams({ play: '1', season: String(s), episode: String(e) }, { replace: true });
    } else {
      saveMovieToHistory(details);
      // Change URL without refresh
      setSearchParams({ play: '1' }, { replace: true });
    }

    setIsPlayerOpen(true);
  };

  const handlePlayerEpisodeChange = (newSeason: number, newEpisode: number) => {
    if (!details) return;
    setPlayingSeason(newSeason);
    setPlayingEpisode(newEpisode);
    if (newSeason !== selectedSeason) {
      setSelectedSeason(newSeason);
    }

    saveSeriesEpisode(details.id, newSeason, newEpisode, {
      title: details.title,
      overview: details.overview,
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      release_date: details.release_date,
      vote_average: details.vote_average,
      number_of_seasons: details.number_of_seasons,
      seasons: details.seasons,
    });

    // Change URL without refresh!
    setSearchParams(
      { play: '1', season: String(newSeason), episode: String(newEpisode) },
      { replace: true }
    );
  };

  const handleClosePlayer = () => {
    setIsPlayerOpen(false);
    // Remove play parameter from URL without refresh
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('play');
    setSearchParams(newParams, { replace: true });
  };

  const handleSelectRelated = (item: MediaItem) => {
    setSearchQuery('');
    const targetType = item.media_type || 'movie';
    navigate(`/${targetType}/${item.id}`);
  };
  const backdrop = details ? getBackdropUrl(details.backdrop_path || details.poster_path) : '';
  const releaseYear = details?.release_date ? new Date(details.release_date).getFullYear() : null;
  const voteAvg = details?.vote_average;
  const matchPercentage =
    voteAvg && voteAvg > 0 ? Math.min(99, Math.max(50, Math.round(voteAvg * 10))) : null;
  const maturityRating = details?.certification || null;
  const seasonsCount = details?.number_of_seasons;
  const runtime = details?.runtime;

  const durationOrSeasonsLabel = isTv
    ? seasonsCount
      ? `${seasonsCount} Season${seasonsCount > 1 ? 's' : ''}`
      : null
    : runtime
    ? runtime >= 60
      ? `${Math.floor(runtime / 60)}h ${runtime % 60}m`
      : `${runtime}m`
    : null;

  const seasonsList: Season[] =
    details?.seasons && details.seasons.length > 0
      ? details.seasons
      : seasonsCount
      ? Array.from({ length: seasonsCount }, (_, i) => ({
          id: i + 1,
          season_number: i + 1,
          name: `Season ${i + 1}`,
          overview: '',
          poster_path: null,
          episode_count: 0,
        }))
      : [];

  const rawSubtitle =
    details?.tagline && details.tagline.trim().length > 0
      ? details.tagline
      : isTv && episodes && episodes.length > 0 && episodes[0]?.name && !episodes[0].name.toLowerCase().startsWith('episode')
      ? episodes[0].name
      : 'The Anxious Activist';

  const subtitle = rawSubtitle ? rawSubtitle.replace(/^["“”]|["“”]$/g, '').trim() : null;

  const inWatchlist = details ? watchlist.some((m) => Number(m.id) === Number(details.id)) : false;
  const liked = details ? likedMedia.some((m) => Number(m.id) === Number(details.id)) : false;
  const disliked = details ? dislikedMedia.some((m) => Number(m.id) === Number(details.id)) : false;
  const watched = details ? isWatched(details.id) : false;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-rose-600 selection:text-white">
      {/* Same Netflix Top Navigation */}
      <NetflixNavbar
        activeTab={isTv ? 'tv' : 'movie'}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {searchQuery ? (
        /* Search Overlay */
        <SearchResults
          query={searchQuery}
          results={searchResults}
          people={searchPeople}
          loading={isSearching}
          onSelect={handleSelectRelated}
          onClear={() => setSearchQuery('')}
        />
      ) : loading || !details ? (
        /* Sleek Netflix Loading Skeleton matching 100vh Billboard shape */
        <div className="relative w-full h-screen min-h-[640px] max-h-screen bg-black flex flex-col justify-end overflow-hidden animate-pulse">
          <div className="absolute inset-0 bg-zinc-900" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/55 to-transparent w-full md:w-3/5 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

          {/* Bottom Content Group Skeleton */}
          <div className="relative z-20 w-full max-w-7xl mx-auto px-4 md:px-12 pb-6 sm:pb-8 md:pb-10 space-y-6 sm:space-y-8">
            <div className="w-full space-y-4">
              <div className="h-16 w-64 bg-zinc-800 rounded" />
              <div className="flex items-center justify-between w-full">
                <div className="flex gap-3">
                  <div className="h-11 w-32 bg-zinc-800 rounded-full" />
                  <div className="h-11 w-11 bg-zinc-800 rounded-full" />
                  <div className="h-11 w-11 bg-zinc-800 rounded-full" />
                  <div className="h-11 w-11 bg-zinc-800 rounded-full" />
                  <div className="h-11 w-11 bg-zinc-800 rounded-full" />
                </div>
                <div className="h-11 w-11 bg-zinc-800 rounded-full" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12 items-end">
              <div className="md:col-span-2 space-y-2.5">
                <div className="h-4 w-48 bg-zinc-800 rounded" />
                <div className="h-4 w-60 bg-zinc-800/80 rounded" />
                <div className="space-y-2">
                  <div className="h-3.5 w-full bg-zinc-800 rounded" />
                  <div className="h-3.5 w-5/6 bg-zinc-800 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-40 bg-zinc-800 rounded" />
                <div className="h-3 w-32 bg-zinc-800 rounded" />
                <div className="h-3 w-48 bg-zinc-800 rounded" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Standardized Detail Page matching NetflixHero Billboard */
        <main className="flex-grow">
          {/* 100vh Billboard Hero Section - anchored to bottom */}
          <div className="relative w-full h-screen min-h-[640px] max-h-screen overflow-hidden select-none bg-black flex flex-col justify-end">
            {/* Cinematic Fullscreen Backdrop */}
            <img
              src={backdrop}
              alt={details.title}
              className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.75] contrast-[1.05]"
            />

            {/* Netflix Vignette Overlays matching NetflixHero */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/55 to-transparent w-full md:w-3/5 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

            {/* Bottom Content Group: Logo & Buttons directly ABOVE Details with comfortable breathing space */}
            <div className="relative z-20 w-full max-w-7xl mx-auto px-4 md:px-12 pb-6 sm:pb-8 md:pb-10 space-y-6 sm:space-y-8">
              {/* Logo & Action Buttons Row (Above the details) */}
              <div className="w-full">
                {/* Title: Transparent PNG Title Logo with Text Fallback */}
                {logoPath ? (
                  <div className="max-w-xs sm:max-w-md md:max-w-lg flex items-end mb-4 sm:mb-5">
                    <img
                      src={getLogoUrl(logoPath, 'w500') || ''}
                      alt={details.title}
                      className="h-14 sm:h-18 md:h-24 w-auto max-w-full object-contain filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] brightness-105"
                    />
                  </div>
                ) : (
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-none max-w-2xl drop-shadow-2xl mb-4 sm:mb-5">
                    {details.title}
                  </h1>
                )}

                {/* Action Buttons Row */}
                <div className="pt-1 flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="primary"
                      size="lg"
                      rounded="full"
                      onClick={() => handlePlay()}
                      leftIcon={<Play className="w-5 h-5 fill-black" />}
                    >
                      {hasProgress
                        ? isTv
                          ? `Resume S${activeSeason}:E${activeEpisode}`
                          : 'Resume'
                        : 'Play'}
                    </Button>

                    {/* Add to Watchlist */}
                    <button
                      onClick={() => toggleWatchlist(details)}
                      className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition cursor-pointer backdrop-blur-sm ${
                        inWatchlist
                          ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                          : 'border-zinc-400 hover:border-white text-zinc-300 hover:text-white bg-black/40'
                      }`}
                      title={inWatchlist ? 'In Watchlist (Click to remove)' : 'Add to Watchlist'}
                      aria-label="Toggle Watchlist"
                    >
                      {inWatchlist ? (
                        <Bookmark className="w-5 h-5 fill-amber-300 stroke-[2]" />
                      ) : (
                        <Plus className="w-5 h-5 stroke-[2.5]" />
                      )}
                    </button>

                    {/* Mark as Watched */}
                    <button
                      onClick={() => toggleWatched(details)}
                      className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition cursor-pointer backdrop-blur-sm ${
                        watched
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                          : 'border-zinc-400 hover:border-white text-zinc-300 hover:text-white bg-black/40'
                      }`}
                      title={watched ? 'Watched (Click to unmark)' : 'Mark as Watched'}
                      aria-label="Toggle Watched"
                    >
                      <Check className={`w-5 h-5 stroke-[2.8] ${watched ? 'text-emerald-400' : ''}`} />
                    </button>

                    {/* Thumbs Up (Like) */}
                    <button
                      onClick={() => toggleLike(details)}
                      className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition cursor-pointer backdrop-blur-sm ${
                        liked
                          ? 'border-rose-500 bg-rose-500/20 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                          : 'border-zinc-400 hover:border-white text-zinc-300 hover:text-white bg-black/40'
                      }`}
                      title={liked ? 'Liked' : 'I like this'}
                      aria-label="Like"
                    >
                      <ThumbsUp className={`w-4.5 h-4.5 ${liked ? 'fill-rose-400' : ''}`} />
                    </button>

                    {/* Thumbs Down (Dislike) */}
                    <button
                      onClick={() => toggleDislike(details)}
                      className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition cursor-pointer backdrop-blur-sm ${
                        disliked
                          ? 'border-sky-500 bg-sky-500/20 text-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.3)]'
                          : 'border-zinc-400 hover:border-white text-zinc-300 hover:text-white bg-black/40'
                      }`}
                      title={disliked ? 'Disliked (Excluded from recommendations)' : 'Not for me / Dislike'}
                      aria-label="Dislike"
                    >
                      <ThumbsDown className={`w-4.5 h-4.5 ${disliked ? 'fill-sky-400' : ''}`} />
                    </button>
                  </div>

                  {/* Volume Toggle */}
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="w-11 h-11 rounded-full border-2 border-zinc-400 hover:border-white text-zinc-300 hover:text-white bg-black/40 flex items-center justify-center transition cursor-pointer backdrop-blur-sm"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Details Row: Metadata Badges, Subtitle & Overview on Left, Genres/Tags/Cast on Right */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12 items-end">
                {/* Left Column (2/3 width): Metadata Badges, Subtitle & Overview */}
                <div className="md:col-span-2 space-y-2.5">
                  {/* Metadata Badges: Match %  Year  Rating  Duration/Seasons */}
                  <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm font-semibold">
                    {matchPercentage !== null && (
                      <span className="text-emerald-400 font-bold">{matchPercentage}% Match</span>
                    )}
                    {releaseYear && <span className="text-zinc-300 font-semibold">{releaseYear}</span>}
                    {maturityRating && (
                      <span className="border border-zinc-400/80 px-1.5 py-0.5 text-[11px] text-zinc-200 font-semibold tracking-wider rounded-[2px] leading-none">
                        {maturityRating}
                      </span>
                    )}
                    {durationOrSeasonsLabel && (
                      <span className="text-zinc-300 font-semibold">{durationOrSeasonsLabel}</span>
                    )}
                  </div>

                  {/* Subtitle of the title of the show / movie */}
                  {subtitle && (
                    <p className="text-sm sm:text-base font-semibold text-white tracking-wide drop-shadow">
                      "{subtitle}"
                    </p>
                  )}

                  {/* Overview Description */}
                  {details.overview && (
                    <p className="text-xs sm:text-sm md:text-base text-zinc-200 line-clamp-3 md:line-clamp-4 leading-relaxed max-w-2xl drop-shadow-md font-normal">
                      {details.overview}
                    </p>
                  )}
                </div>

                {/* Right Column (1/3 width): Cast, Genres, Mood tags */}
                <div className="space-y-1.5 text-xs sm:text-sm text-zinc-400">
                  {/* Cast */}
                  {(cast.length > 0 || details.title) && (
                    <div>
                      <span className="text-zinc-500 font-medium">Cast: </span>
                      <span className="text-zinc-200">
                        {cast.length > 0
                          ? cast.join(', ')
                          : 'Zac Efron, Lily Collins, Kaya Scodelario, John Malkovich'}
                      </span>
                    </div>
                  )}

                  {genres.length > 0 && (
                    <div>
                      <span className="text-zinc-500 font-medium">Genres: </span>
                      <span className="text-zinc-200">{genres.join(', ')}</span>
                    </div>
                  )}

                  {tags.length > 0 && (
                    <div>
                      <span className="text-zinc-500 font-medium">
                        {isTv ? 'This show is: ' : 'This movie is: '}
                      </span>
                      <span className="text-zinc-200">{tags.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content below 100vh Hero: Episodes & More Like This */}
          <div className="relative z-20 w-full pt-8 pb-20 space-y-10">
            {/* TV Shows: Episodes Section */}
            {isTv && (
              <div className="w-full max-w-7xl mx-auto px-4 md:px-12 space-y-4">
                {/* Episodes Header with Season Selector Dropdown */}
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg md:text-xl font-bold text-white tracking-tight hover:text-zinc-300 transition cursor-pointer inline-flex items-center gap-2">
                    <span>Episodes</span>
                  </h2>

                  {/* Season Dropdown */}
                  {seasonsList.length > 1 && (
                    <div className="relative" ref={seasonDropdownRef}>
                      <button
                        onClick={() => setIsSeasonOpen(!isSeasonOpen)}
                        className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-[3px] text-xs sm:text-sm font-bold border border-zinc-800 transition cursor-pointer"
                      >
                        <span>Season {selectedSeason}</span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isSeasonOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isSeasonOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 bg-zinc-900 border border-zinc-800 rounded-[3px] shadow-2xl py-1 z-30">
                          {seasonsList.map((s) => (
                            <button
                              key={s.season_number}
                              onClick={() => {
                                setSelectedSeason(s.season_number);
                                setIsSeasonOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 transition flex items-center justify-between cursor-pointer ${
                                s.season_number === selectedSeason
                                  ? 'text-white font-bold bg-zinc-800'
                                  : 'text-zinc-300'
                              }`}
                            >
                              <span>Season {s.season_number}</span>
                              {s.season_number === selectedSeason && (
                                <Check className="w-4 h-4 text-white" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Episode List Items */}
                {loadingEpisodes ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-2 text-zinc-400 text-xs">
                    <div className="w-8 h-8 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : episodes.length > 0 ? (
                  <div className="divide-y divide-zinc-900">
                    {episodes.map((ep) => {
                      const epStill = ep.still_path
                        ? getBackdropUrl(ep.still_path, 'w500')
                        : backdrop;

                      const epSaved = details
                        ? getSavedPlaybackTime(details.id, 'tv', selectedSeason, ep.episode_number)
                        : null;
                      const epDuration = ep.runtime ? ep.runtime * 60 : epSaved?.duration || 45 * 60;
                      const epPercent =
                        epSaved && epSaved.seconds > 5
                          ? Math.min(95, Math.max(5, Math.round((epSaved.seconds / epDuration) * 100)))
                          : null;

                      return (
                        <div
                          key={ep.id}
                          onClick={() => handlePlay(selectedSeason, ep.episode_number)}
                          className="group/ep flex items-center gap-4 sm:gap-6 p-3 sm:p-4 rounded-[4px] hover:bg-zinc-900/80 transition cursor-pointer"
                        >
                          {/* Episode Number */}
                          <span className="text-xl sm:text-2xl font-bold text-zinc-500 w-8 text-center flex-shrink-0 group-hover/ep:text-white transition">
                            {ep.episode_number}
                          </span>

                          {/* Episode Thumbnail with Play Icon on Hover and Progress Bar */}
                          <div className="relative w-32 sm:w-44 aspect-video bg-zinc-900 rounded-[3px] overflow-hidden flex-shrink-0 shadow-md">
                            <img
                              src={epStill}
                              alt={ep.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover/ep:scale-105 transition duration-300"
                            />
                            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover/ep:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="w-9 h-9 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
                                <Play className="w-4 h-4 fill-black ml-0.5" />
                              </div>
                            </div>
                            {/* Red Continue Playback bar */}
                            {epPercent !== null && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700/70">
                                <div
                                  className="h-full bg-red-600 rounded-r-sm transition-all"
                                  style={{ width: `${epPercent}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Title, Duration & Synopsis */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-3">
                              <h4 className="text-sm sm:text-base font-bold text-white group-hover/ep:text-zinc-200 transition truncate">
                                {ep.name || `Episode ${ep.episode_number}`}
                              </h4>
                              {ep.runtime ? (
                                <span className="text-xs text-zinc-400 font-medium flex-shrink-0">
                                  {ep.runtime}m
                                </span>
                              ) : null}
                            </div>
                            {ep.overview ? (
                              <p className="text-xs sm:text-sm text-zinc-400 line-clamp-2 leading-relaxed">
                                {ep.overview}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}

            {/* More Like This (Algorithm-Driven Grid with Portrait Covers) */}
            {similarItems.length > 0 && (
              <div className="space-y-4 px-4 sm:px-8 md:px-12 my-10">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight">
                  More Like This
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
                  {similarItems.map((item) => (
                    <NetflixTallCard
                      key={item.id}
                      item={item}
                      imageType="backdrop"
                      onSelect={handleSelectRelated}
                      onPlay={() => {
                        const targetType = item.media_type || 'movie';
                        navigate(`/${targetType}/${item.id}?play=1`);
                      }}
                      className="w-full"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Netflix Footer */}
      <footer className="border-t border-zinc-900 bg-black py-12 px-6 sm:px-12 text-zinc-500 text-xs space-y-4 mt-auto">
        <div className="max-w-6xl mx-auto space-y-4">
          <p className="font-semibold text-zinc-400">Questions? Call 1-800-019-8877</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-zinc-500">
            <span>FAQ</span>
            <span>Help Center</span>
            <span>Account</span>
            <span>Media Center</span>
            <span>Terms of Use</span>
            <span>Privacy</span>
            <span>Cookie Preferences</span>
            <span>Corporate Information</span>
          </div>
          <div className="pt-4 border-t border-zinc-900 text-[11px] text-zinc-600 flex flex-wrap justify-between gap-2">
            <span>&copy; 2026 SEVEN</span>
            <span>All rights reserved.</span>
          </div>
        </div>
      </footer>

      {/* Pure Video Player Modal - Exit on click outside, no close button, internal episode URL updates */}
      {isPlayerOpen && details && (
        <VideoPlayerModal
          mediaId={details.id}
          mediaType={isTv ? 'tv' : 'movie'}
          title={details.title}
          season={playingSeason}
          episode={playingEpisode}
          totalSeasons={details.number_of_seasons || seasonsList.length || 1}
          episodes={episodes}
          onEpisodeChange={handlePlayerEpisodeChange}
          onClose={handleClosePlayer}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import type { MediaItem, Episode, Season } from '../types/movie';
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
} from '../services/tmdb';
import { useStreamStore } from '../store/useStreamStore';
import { calculateUnifiedMatchScore, useUserTasteProfile } from '../services/tasteEngine';
import {
  X,
  Play,
  Plus,
  Check,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
  ChevronDown,
} from 'lucide-react';
import { NetflixBackdropCard } from './NetflixBackdropCard';

interface NetflixDetailModalProps {
  media: MediaItem | null;
  onClose: () => void;
  onPlay: (item: MediaItem, season?: number, episode?: number) => void;
}

export const NetflixDetailModal: React.FC<NetflixDetailModalProps> = ({
  media,
  onClose,
  onPlay,
}) => {
  const [details, setDetails] = useState<MediaItem | null>(media);
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

  const seasonDropdownRef = useRef<HTMLDivElement>(null);
  const tasteProfile = useUserTasteProfile();

  const toggleWatchlist = useStreamStore((state) => state.toggleWatchlist);
  const toggleLike = useStreamStore((state) => state.toggleLike);
  const inWatchlist = useStreamStore((state) =>
    (state.watchlist || []).some((m) => Number(m.id) === Number(currentMedia.id))
  );
  const liked = useStreamStore((state) =>
    (state.likedMedia || []).some((m) => Number(m.id) === Number(currentMedia.id))
  );

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  // Fetch full details, logo, and credits when media changes
  useEffect(() => {
    if (!media) return;
    let isCurrent = true;

    // Immediately flush stale data from any previous title
    setDetails(media);
    setCast([]);
    setGenres(media.genres ? media.genres.map((g) => g.name).slice(0, 4) : []);
    setTags([]);
    setEpisodes([]);
    setSimilarItems([]);

    const mediaType = media.media_type || 'movie';

    // Instant cached logo if available
    const cached = media.logo_path || getCachedLogo(media.id, mediaType);
    setLogoPath(cached);

    Promise.all([
      fetchMediaDetails(media.id, mediaType),
      fetchMediaLogo(media.id, mediaType),
      fetchCredits(media.id, mediaType),
      fetchMediaKeywords(media.id, mediaType).catch(() => []),
      fetchRecommendations(media.id, mediaType).catch(() => []),
    ]).then(([d, logo, credits, kws, recs]) => {
      if (!isCurrent) return;
      if (d) setDetails(d);
      if (logo) setLogoPath(logo);
      if (Array.isArray(credits)) setCast(credits.slice(0, 5));
      if (d?.genres) {
        setGenres(d.genres.map((g) => g.name).slice(0, 4));
      }
      if (kws && kws.length > 0) {
        setTags(kws.slice(0, 4));
      }
      if (recs && recs.length > 0) {
        setSimilarItems(recs.slice(0, 6));
      }
    });

    const initSeason = media.season || 1;
    setSelectedSeason(initSeason);

    return () => {
      isCurrent = false;
    };
  }, [media?.id, media?.media_type]);

  // Fetch episodes when selectedSeason changes for TV shows
  useEffect(() => {
    const targetType = details?.media_type || media?.media_type;
    if (!media || targetType !== 'tv') {
      setEpisodes([]);
      setLoadingEpisodes(false);
      return;
    }

    let isCurrent = true;
    setLoadingEpisodes(true);
    setEpisodes([]);

    fetchSeasonEpisodes(media.id, selectedSeason)
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
  }, [media?.id, selectedSeason, details?.media_type]);

  if (!media) return null;

  const currentMedia = details || media;
  const isTv = (currentMedia.media_type || 'movie') === 'tv';
  const backdrop = getBackdropUrl(currentMedia.backdrop_path || currentMedia.poster_path);

  // Dynamic values without hardcoded text fallbacks:
  const releaseYear = currentMedia.release_date
    ? new Date(currentMedia.release_date).getFullYear()
    : null;

  const matchResult = currentMedia ? calculateUnifiedMatchScore(currentMedia, tasteProfile) : null;
  const matchPercentage = matchResult ? matchResult.percentage : null;

  const maturityRating = currentMedia.certification || null;

  const seasonsCount = currentMedia.number_of_seasons;
  const runtime = currentMedia.runtime;

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
    currentMedia.seasons && currentMedia.seasons.length > 0
      ? currentMedia.seasons
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

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-0 sm:p-4 md:py-8 animate-fadeIn select-none"
      style={{ scrollbarWidth: 'thin' }}
    >
      {/* Modal Dialog Card - Strict #000 Body */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl text-white rounded-none sm:rounded-xl shadow-2xl overflow-hidden my-auto sm:my-4 transform transition-all duration-300 border border-zinc-900"
        style={{ backgroundColor: '#000000' }}
      >
        {/* Close Button Top-Right Floating */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-40 w-9 h-9 rounded-full bg-black/80 hover:bg-zinc-800 text-white flex items-center justify-center transition cursor-pointer shadow-lg border border-white/10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Hero Banner with 16:9 Backdrop Image */}
        <div className="relative aspect-[16/9] w-full bg-black overflow-hidden">
          <img
            src={backdrop}
            alt={currentMedia.title}
            className="w-full h-full object-cover filter brightness-[0.85] contrast-[1.05]"
          />

          {/* Vignette gradients to blend seamlessly into pure #000 black background */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none w-2/3" />

          {/* Floating Hero Content Overlay on Backdrop */}
          <div className="absolute bottom-6 sm:bottom-10 left-6 sm:left-10 right-6 sm:right-10 z-20 flex flex-col justify-end space-y-3">
            {/* Title Logo (Transparent PNG) or bold typography */}
            {logoPath ? (
              <div className="max-w-xs sm:max-w-sm md:max-w-md max-h-20 sm:max-h-24 flex items-end">
                <img
                  src={getLogoUrl(logoPath, 'w500') || ''}
                  alt={currentMedia.title}
                  className="max-h-16 sm:max-h-20 w-auto max-w-full object-contain filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]"
                />
              </div>
            ) : (
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-xl leading-none">
                {currentMedia.title}
              </h1>
            )}

            {/* Action Buttons Row */}
            <div className="flex items-center gap-2.5 pt-1">
              {/* Play Button (White Pill) */}
              <button
                onClick={() => onPlay(currentMedia, selectedSeason, 1)}
                className="flex items-center gap-2 bg-white text-black font-bold px-6 sm:px-7 py-2 sm:py-2.5 rounded-[4px] hover:bg-white/90 transition shadow-lg text-sm sm:text-base cursor-pointer"
              >
                <Play className="w-5 h-5 fill-black" />
                <span>Play</span>
              </button>

              {/* Add to Watchlist */}
              <button
                type="button"
                onClick={() => toggleWatchlist(currentMedia)}
                className={`w-9 sm:w-10 h-9 sm:h-10 rounded-full border-2 flex items-center justify-center transition cursor-pointer backdrop-blur-sm ${
                  inWatchlist
                    ? 'border-white bg-white hover:bg-zinc-200 text-black'
                    : 'border-zinc-400 hover:border-white text-zinc-300 hover:text-white bg-black/40'
                }`}
                title={inWatchlist ? 'Remove from My List' : 'Add to My List'}
              >
                {inWatchlist ? <Check className="w-5 h-5 stroke-[3] text-black" /> : <Plus className="w-5 h-5 stroke-[2.5]" />}
              </button>

              {/* Thumbs Up (Like) */}
              <button
                type="button"
                onClick={() => toggleLike(currentMedia)}
                className={`w-9 sm:w-10 h-9 sm:h-10 rounded-full border-2 flex items-center justify-center transition cursor-pointer backdrop-blur-sm ${
                  liked
                    ? 'border-white bg-zinc-800 text-white'
                    : 'border-zinc-400 hover:border-white text-zinc-300 hover:text-white bg-black/40'
                }`}
                title={liked ? 'Liked' : 'I like this'}
              >
                <ThumbsUp className={`w-4 sm:w-4.5 h-4 sm:h-4.5 ${liked ? 'fill-white text-white' : ''}`} />
              </button>

              {/* Thumbs Down */}
              <button
                className="w-9 sm:w-10 h-9 sm:h-10 rounded-full border-2 border-zinc-400 hover:border-white text-zinc-300 hover:text-white bg-black/40 flex items-center justify-center transition cursor-pointer backdrop-blur-sm"
                title="Not for me"
              >
                <ThumbsDown className="w-4 sm:w-4.5 h-4 sm:h-4.5" />
              </button>

              {/* Volume Toggle */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="ml-auto w-9 sm:w-10 h-9 sm:h-10 rounded-full border-2 border-zinc-400 hover:border-white text-zinc-300 hover:text-white bg-black/40 flex items-center justify-center transition cursor-pointer backdrop-blur-sm"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body Container in Strict #000 */}
        <div
          className="px-6 sm:px-10 py-6 space-y-8 text-white"
          style={{ backgroundColor: '#000000' }}
        >
          {/* Metadata & Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-start">
            {/* Left Column (2/3 width) */}
            <div className="md:col-span-2 space-y-4">
              {/* Dynamic Metadata Badges: Match %  Year  Rating  Duration/Seasons */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-semibold">
                {matchPercentage !== null && (
                  <span className="text-emerald-400 font-bold">{matchPercentage}% Match</span>
                )}
                {releaseYear && (
                  <span className="text-zinc-300">{releaseYear}</span>
                )}
                {maturityRating && (
                  <span className="border border-zinc-400/80 px-1.5 py-0.5 text-[11px] text-zinc-200 font-medium tracking-wider rounded-[2px] leading-none">
                    {maturityRating}
                  </span>
                )}
                {durationOrSeasonsLabel && (
                  <span className="text-zinc-300 font-medium">{durationOrSeasonsLabel}</span>
                )}
              </div>

              {/* Overview Description */}
              {currentMedia.overview && (
                <p className="text-sm sm:text-base text-zinc-200 leading-relaxed drop-shadow-sm font-normal">
                  {currentMedia.overview}
                </p>
              )}
            </div>

            {/* Right Column (1/3 width): Cast, Genres, Mood tags */}
            <div className="space-y-3 text-xs sm:text-sm text-zinc-400">
              {cast.length > 0 && (
                <div>
                  <span className="text-zinc-500 font-medium">Cast: </span>
                  <span className="text-zinc-200">{cast.join(', ')}</span>
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

          {/* TV Shows: Episodes Section */}
          {isTv && (
            <div className="space-y-4 pt-4 border-t border-zinc-900">
              {/* Episodes Header with Season Selector Dropdown */}
              <div className="flex items-center justify-between">
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Episodes
                </h3>

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
                      <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-zinc-800 rounded-[3px] shadow-2xl py-1 z-30">
                        {seasonsList.map((s) => (
                          <button
                            key={s.season_number}
                            onClick={() => {
                              setSelectedSeason(s.season_number);
                              setIsSeasonOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs sm:text-sm hover:bg-zinc-800 transition flex items-center justify-between cursor-pointer ${
                              s.season_number === selectedSeason
                                ? 'text-white font-bold bg-zinc-800'
                                : 'text-zinc-300'
                            }`}
                          >
                            <span>Season {s.season_number}</span>
                            {s.season_number === selectedSeason && (
                              <Check className="w-3.5 h-3.5 text-white" />
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
                  <div className="w-7 h-7 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : episodes.length > 0 ? (
                <div className="divide-y divide-zinc-900">
                  {episodes.map((ep) => {
                    const epStill = ep.still_path
                      ? getBackdropUrl(ep.still_path, 'w500')
                      : backdrop;

                    return (
                      <div
                        key={ep.id}
                        onClick={() => onPlay(currentMedia, selectedSeason, ep.episode_number)}
                        className="group/ep flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-[4px] hover:bg-zinc-900/90 transition cursor-pointer"
                      >
                        {/* Episode Number */}
                        <span className="text-base sm:text-xl font-bold text-zinc-400 w-6 text-center flex-shrink-0 group-hover/ep:text-white transition">
                          {ep.episode_number}
                        </span>

                        {/* Episode Thumbnail with Play Icon on Hover */}
                        <div className="relative w-28 sm:w-36 aspect-video bg-zinc-900 rounded-[3px] overflow-hidden flex-shrink-0">
                          <img
                            src={epStill}
                            alt={ep.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover/ep:scale-105 transition duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/ep:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 fill-black ml-0.5" />
                            </div>
                          </div>
                        </div>

                        {/* Title, Duration & Synopsis */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-white group-hover/ep:text-zinc-200 transition truncate">
                              {ep.name || `Episode ${ep.episode_number}`}
                            </h4>
                            {ep.runtime ? (
                              <span className="text-xs text-zinc-400 font-medium flex-shrink-0">
                                {ep.runtime}m
                              </span>
                            ) : null}
                          </div>
                          {ep.overview ? (
                            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
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

          {/* Movies: More Like This Recommendations */}
          {!isTv && similarItems.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-zinc-900">
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                More Like This
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {similarItems.map((item) => (
                  <NetflixBackdropCard
                    key={item.id}
                    item={item}
                    onSelect={(selected) => setDetails(selected)}
                    className="w-full"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MediaItem } from '../types/movie';
import {
  getBackdropUrl,
  getPosterUrl,
  getLogoUrl,
  fetchMediaLogo,
  getCachedLogo,
  fetchMediaQuickInfo,
  GENRE_MAP,
} from '../services/tmdb';
import { useStreamStore } from '../store/useStreamStore';
import { Play, Plus, Check, ThumbsUp, ThumbsDown, Trash2, Eye } from 'lucide-react';

export interface NetflixTallCardProps {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
  imageType?: 'backdrop' | 'poster';
  className?: string;
  isWatchedCard?: boolean;
  isWatchlistCard?: boolean;
  onMarkWatched?: (item: MediaItem) => void;
  rating?: number | null;
  isLetterboxd?: boolean;
  confidenceWeight?: number;
  onRate?: (item: MediaItem) => void;
  onRemove?: (item: MediaItem) => void;
  badge?: React.ReactNode;
}

export const NetflixTallCard: React.FC<NetflixTallCardProps> = ({
  item,
  onSelect,
  onPlay,
  imageType = 'backdrop',
  className = 'w-36 sm:w-44 md:w-52 lg:w-56',
  isWatchedCard,
  isWatchlistCard,
  onMarkWatched,
  onRemove,
}) => {
  const navigate = useNavigate();

  // Store actions and reactive subscriptions
  const toggleWatchlist = useStreamStore((state) => state.toggleWatchlist);
  const toggleLike = useStreamStore((state) => state.toggleLike);
  const toggleDislike = useStreamStore((state) => state.toggleDislike);
  const markAsWatched = useStreamStore((state) => state.markAsWatched);
  const removeFromWatchlist = useStreamStore((state) => state.removeFromWatchlist);
  const isWatchedStore = useStreamStore((state) => state.isWatched(item.id));

  const inList = useStreamStore((state) =>
    (state.watchlist || []).some((m) => Number(m.id) === Number(item.id))
  );
  const liked = useStreamStore((state) =>
    (state.likedMedia || []).some((m) => Number(m.id) === Number(item.id))
  );
  const disliked = useStreamStore((state) =>
    (state.dislikedMedia || []).some((m) => Number(m.id) === Number(item.id))
  );

  const isWatched = Boolean(isWatchedCard || isWatchedStore || liked);

  const handleMarkWatchedClick = () => {
    if (onMarkWatched) {
      onMarkWatched(item);
    } else {
      markAsWatched(item);
      removeFromWatchlist(item.id);
    }
  };

  // Logo fetching for official transparent PNG title
  const initialLogo = item.logo_path || getCachedLogo(item.id, item.media_type);
  const [logoPath, setLogoPath] = useState<string | null>(initialLogo);

  // Dynamic quick info fetching (seasons count, runtime, certification, backdrop)
  const [quickInfo, setQuickInfo] = useState<{
    runtime?: number;
    numberOfSeasons?: number;
    certification?: string;
    backdrop_path?: string | null;
  }>({
    runtime: item.runtime,
    numberOfSeasons: item.number_of_seasons,
    certification: item.certification,
    backdrop_path: item.backdrop_path,
  });

  useEffect(() => {
    let isMounted = true;
    const cached = item.logo_path || getCachedLogo(item.id, item.media_type);
    if (cached) {
      setLogoPath(cached);
    } else {
      fetchMediaLogo(item.id, item.media_type).then((path) => {
        if (isMounted && path) {
          setLogoPath(path);
        }
      });
    }

    // Fetch real season count / runtime / backdrop if missing
    if (
      !item.backdrop_path ||
      (item.media_type === 'tv' && !item.number_of_seasons) ||
      (item.media_type === 'movie' && !item.runtime) ||
      !item.certification
    ) {
      fetchMediaQuickInfo(item.id, item.media_type).then((info) => {
        if (isMounted && info) {
          setQuickInfo(info);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [item.id, item.media_type, item.logo_path, item.backdrop_path, item.number_of_seasons, item.runtime, item.certification]);

  // Choose between cinematic backdrop artwork (without title) or portrait poster cover
  const effectiveBackdrop = quickInfo.backdrop_path || item.backdrop_path;
  const cardImage =
    imageType === 'poster'
      ? getPosterUrl(item.poster_path || effectiveBackdrop, 'w500')
      : getBackdropUrl(effectiveBackdrop || item.poster_path, 'w780');

  const matchScore = useMemo(() => {
    const raw = item.vote_average ? item.vote_average * 10 + 6 : 94;
    const clamped = Math.min(99, Math.max(85, Math.round(raw)));
    return `${clamped}% Match`;
  }, [item.vote_average]);

  const certification = useMemo(() => {
    return (
      quickInfo.certification ||
      item.certification ||
      (item.media_type === 'tv' ? 'TV-MA' : 'PG-13')
    );
  }, [quickInfo.certification, item.certification, item.media_type]);

  const durationOrSeasons = useMemo(() => {
    if (item.media_type === 'tv') {
      const count = quickInfo.numberOfSeasons || item.number_of_seasons;
      if (count && count > 0) {
        return `${count} ${count === 1 ? 'Season' : 'Seasons'}`;
      }
      return null;
    }
    const mins = quickInfo.runtime || item.runtime;
    if (mins && mins > 0) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    return null;
  }, [item.media_type, item.number_of_seasons, item.runtime, quickInfo]);

  // Dot-separated tags
  const tags = useMemo(() => {
    if (item.genres && item.genres.length > 0) {
      return item.genres.slice(0, 3).map((g) => g.name);
    }
    if (item.genre_ids && item.genre_ids.length > 0) {
      const resolved = item.genre_ids.map((id) => GENRE_MAP[id]).filter(Boolean);
      if (resolved.length > 0) return resolved.slice(0, 3);
    }
    return item.media_type === 'tv' ? ['Series', 'Drama', 'Exciting'] : ['Movie', 'Action', 'Suspense'];
  }, [item.genres, item.genre_ids, item.media_type]);

  const handlePlayClick = () => {
    if (onPlay) {
      onPlay(item);
    } else {
      const targetType = item.media_type || 'movie';
      navigate(`/${targetType}/${item.id}?play=1`);
    }
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className={`relative flex-shrink-0 group/card cursor-pointer select-none transition-all duration-300 ease-out hover:scale-110 sm:hover:scale-112 hover:-translate-y-1.5 hover:z-40 first:hover:origin-left last:hover:origin-right hover:origin-center ${className}`}
      title={item.title}
    >
      {/* Tall Card Container (Aspect 2/3) - SHARP EDGES (rounded-none), NO BORDER OUTLINE */}
      <div className="relative aspect-[2/3] w-full bg-zinc-900 rounded-none overflow-hidden shadow-lg group-hover/card:shadow-2xl group-hover/card:shadow-black/95 border-0 transition-all duration-300">
        {/* Cover Artwork Image */}
        <img
          src={cardImage}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover rounded-none brightness-[0.92] group-hover/card:brightness-105 transition-all duration-500"
        />

        {/* Unhovered Bottom PNG Title Logo or Typography */}
        <div className="absolute inset-x-0 bottom-0 pt-16 pb-3 px-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent group-hover/card:opacity-0 transition-opacity duration-200 pointer-events-none flex flex-col items-center justify-end text-center">
          {logoPath ? (
            <img
              src={getLogoUrl(logoPath, 'w300') || ''}
              alt={item.title}
              className="max-h-8 sm:max-h-9 max-w-[85%] object-contain mx-auto filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]"
            />
          ) : (
            <h3 className="font-extrabold text-xs sm:text-sm text-white uppercase tracking-tight line-clamp-2 text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {item.title}
            </h3>
          )}
        </div>

        {/* ======================================================== */}
        {/* HOVER EXPANDED OVERLAY & CONTROLS                        */}
        {/* ======================================================== */}

        {/* Hover Bottom Drawer with Actions, Written Title, Metadata & Genre Tags */}
        <div className="absolute inset-x-0 bottom-0 pt-16 pb-3 px-3 bg-gradient-to-t from-black via-black/95 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 pointer-events-auto flex flex-col justify-end">
          {/* Row of Action Buttons */}
          <div className="flex items-center gap-2 mb-2">
            {/* 1. Play Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePlayClick();
              }}
              className="w-8 h-8 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              title="Play"
            >
              <Play className="w-4 h-4 fill-black ml-0.5" />
            </button>

            {isWatched ? (
              <>
                {/* 2. Like Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(item);
                  }}
                  className={`w-8 h-8 rounded-full border-2 ${
                    liked
                      ? 'border-white bg-zinc-800 text-white'
                      : 'border-white/60 bg-black/60 hover:border-white text-zinc-200 hover:text-white'
                  } flex items-center justify-center backdrop-blur-sm transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer`}
                  title={liked ? 'Liked' : 'Like'}
                >
                  <ThumbsUp
                    className={`w-3.5 h-3.5 transition-colors ${
                      liked ? 'fill-white text-white' : 'text-zinc-200'
                    }`}
                  />
                </button>

                {/* 3. Dislike Button (Replaces Watchlist for watched titles for whole reaction UX) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDislike(item);
                  }}
                  className={`w-8 h-8 rounded-full border-2 ${
                    disliked
                      ? 'border-white bg-zinc-800 text-white'
                      : 'border-white/60 bg-black/60 hover:border-white text-zinc-200 hover:text-white'
                  } flex items-center justify-center backdrop-blur-sm transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer`}
                  title={disliked ? 'Disliked' : 'Dislike'}
                >
                  <ThumbsDown
                    className={`w-3.5 h-3.5 transition-colors ${
                      disliked ? 'fill-white text-white' : 'text-zinc-200'
                    }`}
                  />
                </button>
              </>
            ) : isWatchlistCard ? (
              <>
                {/* 2. Watched Button (Moves title from watchlist to watched section) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkWatchedClick();
                  }}
                  className="w-8 h-8 rounded-full border-2 border-white/60 bg-black/60 hover:border-white text-zinc-200 hover:text-white flex items-center justify-center backdrop-blur-sm transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
                  title="Mark as Watched"
                >
                  <Eye className="w-4 h-4" />
                </button>

                {/* 3. Like Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(item);
                  }}
                  className={`w-8 h-8 rounded-full border-2 ${
                    liked
                      ? 'border-white bg-zinc-800 text-white'
                      : 'border-white/60 bg-black/60 hover:border-white text-zinc-200 hover:text-white'
                  } flex items-center justify-center backdrop-blur-sm transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer`}
                  title={liked ? 'Liked' : 'Like'}
                >
                  <ThumbsUp
                    className={`w-3.5 h-3.5 transition-colors ${
                      liked ? 'fill-white text-white' : 'text-zinc-200'
                    }`}
                  />
                </button>
              </>
            ) : (
              <>
                {/* 2. My List / Watchlist Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWatchlist(item);
                  }}
                  className={`w-8 h-8 rounded-full border-2 ${
                    inList
                      ? 'border-white bg-white hover:bg-zinc-200 text-black'
                      : 'border-white/60 bg-black/60 hover:border-white text-zinc-200 hover:text-white'
                  } flex items-center justify-center backdrop-blur-sm transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer`}
                  title={inList ? 'Remove from My List' : 'Add to My List'}
                >
                  {inList ? (
                    <Check className="w-4 h-4 stroke-[3] text-black" />
                  ) : (
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  )}
                </button>

                {/* 3. Like Button (Clean monochrome switch without glow) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(item);
                  }}
                  className={`w-8 h-8 rounded-full border-2 ${
                    liked
                      ? 'border-white bg-zinc-800 text-white'
                      : 'border-white/60 bg-black/60 hover:border-white text-zinc-200 hover:text-white'
                  } flex items-center justify-center backdrop-blur-sm transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer`}
                  title={liked ? 'Liked' : 'Like'}
                >
                  <ThumbsUp
                    className={`w-3.5 h-3.5 transition-colors ${
                      liked ? 'fill-white text-white' : 'text-zinc-200'
                    }`}
                  />
                </button>
              </>
            )}

            {/* Optional Remove Button */}
            {onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item);
                }}
                className="w-8 h-8 rounded-full border-2 border-white/60 bg-black/60 hover:border-rose-500 text-zinc-200 hover:text-rose-400 flex items-center justify-center backdrop-blur-sm transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer ml-auto"
                title="Remove from library"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Hovering shows written title, just like we did in home page */}
          <h4 className="font-extrabold text-xs sm:text-sm text-white tracking-tight leading-snug line-clamp-2 drop-shadow-md mb-1">
            {item.title}
          </h4>

          {/* Metadata Line: Match %, Age Rating Badge, Seasons/Duration */}
          <div className="flex items-center gap-1.5 text-[11px] mt-0.5 flex-wrap">
            <span className="text-emerald-400 font-bold">{matchScore}</span>
            {certification && (
              <span className="border border-zinc-600 text-[10px] px-1 py-0.2 rounded-none font-semibold text-zinc-300">
                {certification}
              </span>
            )}
            {durationOrSeasons && (
              <span className="text-zinc-400 font-medium">
                {durationOrSeasons}
              </span>
            )}
          </div>

          {/* Dot-separated Genre/Subgenre Tags */}
          <div className="text-[10px] text-zinc-300 font-medium truncate mt-1 flex items-center gap-1 opacity-90">
            {tags.map((tag, i) => (
              <React.Fragment key={tag}>
                {i > 0 && <span className="text-zinc-500 text-[8px]">•</span>}
                <span>{tag}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

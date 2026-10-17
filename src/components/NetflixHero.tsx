import React, { useState, useEffect, useMemo } from 'react';
import type { MediaItem } from '../types/movie';
import { getBackdropUrl, getLogoUrl, fetchMediaLogo, getCachedLogo } from '../services/tmdb';
import { Play, Info, Star, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useStreamStore } from '../store/useStreamStore';

interface NetflixHeroProps {
  items?: MediaItem[];
  item?: MediaItem;
  onPlay: (item: MediaItem) => void;
  onMoreInfo: (item: MediaItem) => void;
}

export const NetflixHero: React.FC<NetflixHeroProps> = ({
  items,
  item,
  onPlay,
  onMoreInfo,
}) => {
  const list = useMemo(
    () => (items && items.length > 0 ? items : item ? [item] : []),
    [items, item]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [fade, setFade] = useState(true);

  // Stable list ID key so re-renders don't cancel auto-advance
  const listKey = useMemo(() => list.map((i) => i.id).join('-'), [list]);

  // Reset index only when the title collection actually changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [listKey]);

  // Auto-advance through carousel items every 6 seconds and loop continuously
  useEffect(() => {
    if (list.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % list.length);
        setFade(true);
      }, 300);
    }, 6000);

    return () => clearInterval(timer);
  }, [list.length, isPaused]);

  const goToNext = () => {
    if (list.length <= 1) return;
    setFade(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % list.length);
      setFade(true);
    }, 200);
  };

  const goToPrev = () => {
    if (list.length <= 1) return;
    setFade(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + list.length) % list.length);
      setFade(true);
    }, 200);
  };

  const currentItem = list[currentIndex] || list[0];

  // Synchronously initialize logoPath if already cached or available on currentItem (0ms delay)
  const initialLogo = currentItem?.logo_path || (currentItem ? getCachedLogo(currentItem.id, currentItem.media_type) : null);
  const [logoPath, setLogoPath] = useState<string | null>(initialLogo);
  const [logoFailed, setLogoFailed] = useState(false);

  // Sync logoPath whenever currentItem changes
  useEffect(() => {
    let isMounted = true;
    const instantLogo = currentItem?.logo_path || (currentItem ? getCachedLogo(currentItem.id, currentItem.media_type) : null);

    if (instantLogo) {
      setLogoPath(instantLogo);
      setLogoFailed(false);
    } else if (currentItem) {
      setLogoPath(null);
      setLogoFailed(false);
      fetchMediaLogo(currentItem.id, currentItem.media_type).then((path) => {
        if (isMounted && path) {
          setLogoPath(path);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [currentItem]);

  // Pre-load all hero item logos into browser memory cache in advance
  useEffect(() => {
    if (!list || list.length === 0) return;
    list.forEach((item) => {
      if (!item) return;
      const logo = item.logo_path || getCachedLogo(item.id, item.media_type);
      if (logo) {
        const img = new Image();
        img.src = getLogoUrl(logo, 'w500') || '';
      } else {
        fetchMediaLogo(item.id, item.media_type).then((path) => {
          if (path) {
            item.logo_path = path;
            const img = new Image();
            img.src = getLogoUrl(path, 'w500') || '';
          }
        });
      }
    });
  }, [list]);

  const isWatched = useStreamStore((state) => state.isWatched);
  const watchHistory = useStreamStore((state) => state.watchHistory);
  const seriesProgress = useStreamStore((state) => state.seriesProgress);

  if (!currentItem) return null;

  const watched = isWatched(currentItem.id);
  const prog = seriesProgress[currentItem.id];
  const hist = watchHistory.find((h) => h.id === currentItem.id);
  const isContinueWatching = Boolean(!watched && (prog || hist || currentItem.season));
  const resolvedSeason = currentItem.season || prog?.season || hist?.season;
  const resolvedEpisode = currentItem.episode || prog?.episode || hist?.episode;

  const backdrop = getBackdropUrl(currentItem.backdrop_path);
  const releaseYear = currentItem.release_date
    ? new Date(currentItem.release_date).getFullYear()
    : '2024';

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="group relative w-full h-screen min-h-[600px] overflow-hidden select-none bg-black"
    >
      {/* Cinematic Backdrop with Smooth Fade */}
      <img
        key={currentItem.id}
        src={backdrop}
        alt={currentItem.title}
        className={`absolute inset-0 w-full h-full object-cover object-top filter brightness-[0.72] contrast-[1.05] transition-opacity duration-700 ${
          fade ? 'opacity-100' : 'opacity-40'
        }`}
      />

      {/* Netflix Vignette Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/50 to-transparent w-full md:w-3/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/40 to-transparent" />

      {/* Left / Right Carousel Controls */}
      {list.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition duration-200 cursor-pointer border border-white/10 shadow-lg"
            aria-label="Previous Featured Title"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition duration-200 cursor-pointer border border-white/10 shadow-lg"
            aria-label="Next Featured Title"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Hero Content */}
      <div
        className={`relative z-10 h-full max-w-7xl mx-auto px-4 md:px-12 flex flex-col justify-end pb-24 md:pb-28 space-y-4 transition-all duration-300 ${
          fade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {/* Title: Transparent PNG Title Logo with Text Fallback */}
        {!logoFailed && logoPath ? (
          <div className="h-20 sm:h-28 md:h-36 max-w-sm sm:max-w-md md:max-w-xl flex items-center mb-1">
            <img
              key={logoPath}
              src={getLogoUrl(logoPath, 'w500') || ''}
              alt={currentItem.title}
              onError={() => setLogoFailed(true)}
              className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] brightness-105"
            />
          </div>
        ) : (
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-none max-w-3xl drop-shadow-2xl">
            {currentItem.title}
          </h1>
        )}

        {/* Metadata Badges */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs md:text-sm font-semibold pt-1">
          {isContinueWatching && (
            <span className="bg-rose-600 text-white text-[10px] md:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded shadow flex items-center gap-1.5 border border-rose-400/50">
              <Play className="w-3 h-3 fill-white" />
              <span>Continue Watching</span>
            </span>
          )}
          {releaseYear && (
            <span className="text-zinc-400 font-medium">{releaseYear}</span>
          )}
          {currentItem.media_type === 'tv' && resolvedSeason && resolvedEpisode && (
            <span className="text-rose-200 bg-rose-950/80 border border-rose-800/60 px-2.5 py-1 rounded text-xs font-mono font-bold">
              Season {resolvedSeason}, Episode {resolvedEpisode}
            </span>
          )}
          {currentItem.media_type === 'tv' && (
            <span className="text-zinc-300">
              {currentItem.number_of_seasons || 1} Season
              {currentItem.number_of_seasons && currentItem.number_of_seasons > 1 ? 's' : ''}
            </span>
          )}
          {watched && (
            <span className="flex items-center gap-1 bg-emerald-600/90 text-white border border-emerald-400/50 px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider shadow">
              <Check className="w-3 h-3 stroke-[3]" />
              Watched
            </span>
          )}
          {currentItem.vote_average ? (
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              {currentItem.vote_average.toFixed(1)}
            </span>
          ) : null}
        </div>

        {/* Overview */}
        <p className="text-sm md:text-base text-zinc-200 line-clamp-3 leading-relaxed max-w-xl drop-shadow-md">
          {currentItem.overview}
        </p>

        {/* Action Buttons & Bottom Indicator Controls */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3.5">
            <button
              onClick={() =>
                onPlay({
                  ...currentItem,
                  season: resolvedSeason,
                  episode: resolvedEpisode,
                })
              }
              className="flex items-center gap-2.5 px-7 py-3 rounded-md bg-white hover:bg-white/85 text-black font-bold text-sm md:text-base transition duration-200 shadow-xl cursor-pointer"
            >
              <Play className="w-5 h-5 fill-black" />
              {isContinueWatching
                ? currentItem.media_type === 'tv' && resolvedSeason && resolvedEpisode
                  ? `Resume S${resolvedSeason}:E${resolvedEpisode}`
                  : 'Resume Playing'
                : 'Play Now'}
            </button>

            <button
              onClick={() => onMoreInfo(currentItem)}
              className="flex items-center gap-2 px-6 py-3 rounded-md bg-zinc-600/60 hover:bg-zinc-600/40 text-white font-bold text-sm md:text-base backdrop-blur-sm transition duration-200 border border-zinc-500/30 cursor-pointer"
            >
              <Info className="w-5 h-5" />
              {currentItem.media_type === 'tv' ? 'More Info & Episodes' : 'More Info'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import type { MediaItem } from '../types/movie';
import { getBackdropUrl, getLogoUrl, fetchMediaLogo, getCachedLogo } from '../services/tmdb';
import { Play, Info, Star, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
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

  const toggleLike = useStreamStore((state) => state.toggleLike);
  const isLiked = useStreamStore((state) => state.isLiked);

  if (!currentItem) return null;

  const liked = isLiked(currentItem.id);
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
        <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm font-semibold pt-1">
          <span className="text-zinc-400">{releaseYear}</span>
          <span className="border border-zinc-600 px-1.5 py-0.5 rounded text-[11px] text-zinc-300">
            16+
          </span>
          {currentItem.season && currentItem.episode && (
            <span className="text-zinc-200 bg-white/10 border border-white/20 px-2 py-0.5 rounded text-xs font-semibold">
              Season {currentItem.season}, Episode {currentItem.episode}
            </span>
          )}
          {currentItem.media_type === 'tv' ? (
            <span className="text-zinc-300">
              {currentItem.number_of_seasons || 1} Season
              {currentItem.number_of_seasons && currentItem.number_of_seasons > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="border border-zinc-600/80 px-1.5 py-0.5 rounded text-[10px] text-zinc-300 uppercase">
              Ultra HD 4K
            </span>
          )}
          <span className="flex items-center gap-1 text-amber-400">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            {currentItem.vote_average ? currentItem.vote_average.toFixed(1) : '8.2'}
          </span>
        </div>

        {/* Overview */}
        <p className="text-sm md:text-base text-zinc-200 line-clamp-3 leading-relaxed max-w-xl drop-shadow-md">
          {currentItem.overview}
        </p>

        {/* Action Buttons & Bottom Indicator Controls */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => onPlay(currentItem)}
              className="flex items-center gap-2.5 px-7 py-3 rounded-md bg-white hover:bg-white/85 text-black font-bold text-sm md:text-base transition duration-200 shadow-xl cursor-pointer"
            >
              <Play className="w-5 h-5 fill-black" />
              {currentItem.season && currentItem.episode
                ? `Resume S${currentItem.season}:E${currentItem.episode}`
                : 'Play Now'}
            </button>

            <button
              onClick={() => onMoreInfo(currentItem)}
              className="flex items-center gap-2 px-6 py-3 rounded-md bg-zinc-600/60 hover:bg-zinc-600/40 text-white font-bold text-sm md:text-base backdrop-blur-sm transition duration-200 border border-zinc-500/30 cursor-pointer"
            >
              <Info className="w-5 h-5" />
              More Info & Episodes
            </button>

            <button
              onClick={() => toggleLike(currentItem)}
              className={`flex items-center gap-2 px-5 py-3 rounded-md font-bold text-sm md:text-base backdrop-blur-sm transition duration-200 border cursor-pointer ${
                liked
                  ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-950/40'
                  : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 border-zinc-600/60'
              }`}
              title={liked ? 'Liked! Click to unlike' : 'Like title to train your recommendations'}
            >
              <Heart className={`w-5 h-5 ${liked ? 'fill-white text-white' : 'text-rose-400'}`} />
              {liked ? 'Liked' : 'Like'}
            </button>
          </div>

          {/* Right Side: Carousel Progress Indicators */}
          {list.length > 1 && (
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              {list.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setFade(false);
                    setTimeout(() => {
                      setCurrentIndex(idx);
                      setFade(true);
                    }, 200);
                  }}
                  className={`h-1.5 transition-all duration-300 rounded-full cursor-pointer ${
                    currentIndex === idx
                      ? 'w-6 bg-rose-600'
                      : 'w-2 bg-zinc-600 hover:bg-zinc-400'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

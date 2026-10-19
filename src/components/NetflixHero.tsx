import React, { useState, useEffect, useMemo } from 'react';
import type { MediaItem } from '../types/movie';
import {
  getBackdropUrl,
  getLogoUrl,
  fetchMediaLogo,
  getCachedLogo,
  fetchMediaQuickInfo,
} from '../services/tmdb';
import { Play, Info } from 'lucide-react';
import { useStreamStore } from '../store/useStreamStore';
import { getSavedPlaybackTime } from '../services/playbackStorage';
import { Button } from './Button';

interface NetflixHeroProps {
  items?: MediaItem[];
  item?: MediaItem;
  onPlay: (item: MediaItem) => void;
  onMoreInfo: (item: MediaItem) => void;
  bottomRow?: React.ReactNode;
}

export const NetflixHero: React.FC<NetflixHeroProps> = ({
  items,
  item,
  onPlay,
  onMoreInfo,
  bottomRow,
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

  // Auto-advance through carousel items every 7 seconds
  useEffect(() => {
    if (list.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % list.length);
        setFade(true);
      }, 300);
    }, 7000);

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

  // Dynamic quick info: runtime, seasons, certification (rating)
  const [quickInfo, setQuickInfo] = useState<{
    runtime?: number;
    numberOfSeasons?: number;
    certification?: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (currentItem) {
      if (currentItem.runtime && currentItem.certification) {
        setQuickInfo({
          runtime: currentItem.runtime,
          numberOfSeasons: currentItem.number_of_seasons,
          certification: currentItem.certification,
        });
      } else {
        fetchMediaQuickInfo(currentItem.id, currentItem.media_type).then((info) => {
          if (isMounted) setQuickInfo(info);
        });
      }
    }
    return () => {
      isMounted = false;
    };
  }, [currentItem]);

  // Synchronously initialize logoPath if already cached or available on currentItem
  const initialLogo =
    currentItem?.logo_path ||
    (currentItem ? getCachedLogo(currentItem.id, currentItem.media_type) : null);
  const [logoPath, setLogoPath] = useState<string | null>(initialLogo);
  const [logoFailed, setLogoFailed] = useState(false);

  // Sync logoPath whenever currentItem changes
  useEffect(() => {
    let isMounted = true;
    const instantLogo =
      currentItem?.logo_path ||
      (currentItem ? getCachedLogo(currentItem.id, currentItem.media_type) : null);

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

  const isTv = currentItem.media_type === 'tv';
  const watched = isWatched(currentItem.id);
  const prog = seriesProgress[currentItem.id];
  const hist = watchHistory.find((h) => h.id === currentItem.id);
  const resolvedSeason = currentItem.season || prog?.season || hist?.season || 1;
  const resolvedEpisode = currentItem.episode || prog?.episode || hist?.episode || 1;

  const savedPlayback = getSavedPlaybackTime(
    currentItem.id,
    isTv ? 'tv' : 'movie',
    resolvedSeason,
    resolvedEpisode
  );
  const hasProgress = Boolean(
    !watched && (
      (savedPlayback && savedPlayback.seconds > 5) ||
      (hist && hist.progressSeconds && hist.progressSeconds > 5) ||
      (prog && prog.progressSeconds && prog.progressSeconds > 5)
    )
  );

  const backdrop = getBackdropUrl(currentItem.backdrop_path);
  const releaseYear = currentItem.release_date
    ? new Date(currentItem.release_date).getFullYear()
    : '2024';

  // Format rating (e.g. TV-14, TV-MA, PG-13, R)
  const displayRating =
    currentItem.certification ||
    quickInfo?.certification ||
    (currentItem.media_type === 'tv'
      ? currentItem.vote_average >= 8.2
        ? 'TV-MA'
        : 'TV-14'
      : currentItem.vote_average >= 8.0
      ? 'R'
      : 'PG-13');

  // Format seasons for TV shows vs runtime for movies (per user requirement)
  let durationLabel = '';
  if (currentItem.media_type === 'tv') {
    const seasons =
      currentItem.number_of_seasons ||
      quickInfo?.numberOfSeasons ||
      1;
    durationLabel = `${seasons} Season${seasons > 1 ? 's' : ''}`;
  } else {
    // Movie: use runtime instead of seasons
    const minutes = currentItem.runtime || quickInfo?.runtime || 118;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0 && mins > 0) durationLabel = `${hrs}h ${mins}m`;
    else if (hrs > 0) durationLabel = `${hrs}h`;
    else durationLabel = `${mins}m`;
  }

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="group relative w-full h-screen min-h-[640px] max-h-screen overflow-hidden select-none bg-black flex flex-col justify-between"
    >
      {/* Cinematic Backdrop with Smooth Fade */}
      <img
        key={currentItem.id}
        src={backdrop}
        alt={currentItem.title}
        className={`absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.75] contrast-[1.05] transition-opacity duration-700 ${
          fade ? 'opacity-100' : 'opacity-40'
        }`}
      />

      {/* Netflix Vignette Overlays (Vignette to black on left and bottom) */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/55 to-transparent w-full md:w-3/5 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

      {/* Left / Right Clickable Areas to change slide (hidden buttons, entire area clickable) */}
      {list.length > 1 && (
        <>
          <div
            onClick={goToPrev}
            className="absolute left-0 top-0 bottom-44 sm:bottom-48 w-16 sm:w-20 md:w-28 z-10 cursor-pointer select-none"
            aria-label="Previous Slide"
          />
          <div
            onClick={goToNext}
            className="absolute right-0 top-0 bottom-44 sm:bottom-48 w-1/3 sm:w-2/5 md:w-1/2 z-10 cursor-pointer select-none"
            aria-label="Next Slide"
          />
        </>
      )}

      {/* Hero Content Container - centered vertically in the billboard section above Popular row */}
      <div className="relative z-20 flex-1 flex flex-col justify-center w-full max-w-7xl mx-auto px-4 md:px-12 pt-14 sm:pt-16 pb-4">
        <div
          className={`max-w-2xl transition-all duration-300 ${
            fade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          {/* Title: Transparent PNG Title Logo with Text Fallback */}
          {!logoFailed && logoPath ? (
            <div className="max-w-xs sm:max-w-md md:max-w-lg flex items-end mb-4 sm:mb-5">
              <img
                key={logoPath}
                src={getLogoUrl(logoPath, 'w500') || ''}
                alt={currentItem.title}
                onError={() => setLogoFailed(true)}
                className="h-14 sm:h-18 md:h-24 w-auto max-w-full object-contain filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] brightness-105"
              />
            </div>
          ) : (
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-none max-w-2xl drop-shadow-2xl mb-4 sm:mb-5">
              {currentItem.title}
            </h1>
          )}

          {/* Metadata Line matching Image 3: Year  [Rating]  Seasons/Runtime (no continue watching tag) */}
          <div className="flex items-center gap-3 text-xs md:text-sm font-medium text-zinc-300 mb-3">
            {/* Release Year */}
            <span className="font-semibold text-zinc-200">{releaseYear}</span>

            {/* Maturity Rating in Subtle Border Box (e.g. [TV-14] from Image 3) */}
            <span className="border border-zinc-400/80 px-1.5 py-0.5 text-[11px] text-zinc-200 font-semibold tracking-wider rounded-[2px] leading-none">
              {displayRating}
            </span>

            {/* Seasons for TV / Runtime for Movies */}
            <span className="font-semibold text-zinc-200">{durationLabel}</span>
          </div>

          {/* Overview Description */}
          <p className="text-xs sm:text-sm text-zinc-200 line-clamp-2 md:line-clamp-3 leading-relaxed max-w-xl drop-shadow-md mb-4 sm:mb-5">
            {currentItem.overview}
          </p>

          {/* Action Buttons: Play (White) and More Info (Gray) */}
          <div className="pt-1 flex items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              rounded="full"
              onClick={() =>
                onPlay({
                  ...currentItem,
                  season: resolvedSeason,
                  episode: resolvedEpisode,
                })
              }
              leftIcon={<Play className="w-5 h-5 fill-black" />}
            >
              {hasProgress
                ? isTv
                  ? `Resume S${resolvedSeason}:E${resolvedEpisode}`
                  : 'Resume'
                : 'Play'}
            </Button>

            <Button
              variant="secondary"
              size="lg"
              rounded="full"
              onClick={() => onMoreInfo(currentItem)}
              leftIcon={<Info className="w-5 h-5" />}
            >
              More Info
            </Button>
          </div>
        </div>
      </div>

      {/* Popular on Netflix row inside the 100vh viewport */}
      {bottomRow && (
        <div className="relative z-20 w-full pb-3 md:pb-4">
          {bottomRow}
        </div>
      )}
    </div>
  );
};

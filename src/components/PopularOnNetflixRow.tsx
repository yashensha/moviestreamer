import React, { useRef } from 'react';
import type { MediaItem } from '../types/movie';
import { NetflixBackdropCard } from './NetflixBackdropCard';
import { NetflixTallCard } from './NetflixTallCard';

export type CardVariant = 'backdrop' | 'tall';

interface PopularOnNetflixRowProps {
  title?: string;
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
  variant?: CardVariant;
  className?: string;
  imageType?: 'backdrop' | 'poster';
  badgeRenderer?: (item: MediaItem, index: number) => React.ReactNode;
  onTitleClick?: () => void;
  titleIcon?: React.ReactNode;
}

export const PopularOnNetflixRow: React.FC<PopularOnNetflixRowProps> = ({
  title = 'Popular on Netflix',
  items,
  onSelect,
  onPlay,
  variant = 'backdrop',
  className = '',
  imageType,
  badgeRenderer,
  onTitleClick,
  titleIcon,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  return (
    <div className={`space-y-1.5 md:space-y-2 px-4 md:px-12 ${className}`}>
      {/* Row Header */}
      <h2
        onClick={onTitleClick}
        className={`text-base sm:text-lg md:text-xl font-bold text-white tracking-tight hover:text-zinc-300 transition inline-flex items-center gap-2 group/header ${
          onTitleClick ? 'cursor-pointer' : ''
        }`}
      >
        {titleIcon && <span className="inline-flex items-center shrink-0">{titleIcon}</span>}
        <span>{title}</span>
        <span className="text-sm text-cyan-400 opacity-0 group-hover/header:opacity-100 transition-opacity">
          &gt;
        </span>
      </h2>

      {/* Row Container */}
      <div className="relative">
        {/* Scrolling Items with exact Netflix gap and vertical breathing room for hover states */}
        <div
          ref={rowRef}
          className={`flex items-center gap-2 sm:gap-2.5 overflow-x-auto scrollbar-none ${
            variant === 'tall' ? 'py-10 sm:py-12 px-3 sm:px-6 -my-6 sm:-my-8' : 'py-4 -my-2'
          } scroll-smooth`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item, index) =>
            variant === 'tall' ? (
              <NetflixTallCard
                key={`${item.id}-${index}`}
                item={item}
                imageType={imageType ?? 'poster'}
                onSelect={onSelect}
                onPlay={onPlay}
                badge={badgeRenderer ? badgeRenderer(item, index) : undefined}
              />
            ) : (
              <NetflixBackdropCard
                key={`${item.id}-${index}`}
                item={item}
                onSelect={onSelect}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';

/**
 * Three overlapping circles representing the iconic Letterboxd brand symbol
 */
export const LetterboxdIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <circle cx="6.5" cy="12" r="4.5" fill="#40bcf4" />
    <circle cx="12" cy="12" r="4.5" fill="#00e054" />
    <circle cx="17.5" cy="12" r="4.5" fill="#ff8000" />
  </svg>
);

/**
 * Bold yellow/black IMDb badge icon
 */
export const ImdbIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-4' }) => (
  <span
    className={`inline-flex items-center justify-center font-black tracking-tighter rounded bg-[#f5c518] text-black px-1.5 py-0.5 text-[10px] leading-none select-none shadow-sm ${className}`}
  >
    IMDb
  </span>
);

/**
 * Rank badge for Letterboxd items
 */
export const LetterboxdRankBadge: React.FC<{ rank: number }> = ({ rank }) => (
  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md border border-white/15 text-[11px] font-bold text-white shadow-lg">
    <span className="w-1.5 h-1.5 rounded-full bg-[#00e054] inline-block shrink-0 shadow-[0_0_6px_#00e054]" />
    <span className="text-[#00e054]">#</span>
    <span className="text-zinc-100">{rank}</span>
  </div>
);

/**
 * Rank badge for IMDb items
 */
export const ImdbRankBadge: React.FC<{ rank: number; rating?: number }> = ({ rank, rating }) => (
  <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-md border border-[#f5c518]/30 text-[11px] font-bold text-white shadow-lg">
    <span className="text-[#f5c518]">#{rank}</span>
    {rating && (
      <>
        <span className="text-zinc-500 font-light">•</span>
        <span className="text-zinc-200 font-medium">★ {rating.toFixed(1)}</span>
      </>
    )}
  </div>
);

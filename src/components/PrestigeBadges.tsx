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
 * Solid bold rank number with crisp Netflix outline (no box)
 */
export const LetterboxdRankBadge: React.FC<{ rank: number }> = ({ rank }) => (
  <span
    className="font-black text-xl sm:text-2xl md:text-3xl text-white opacity-45 select-none tracking-tighter leading-none inline-block font-sans"
    
  >
    {rank}
  </span>
);

/**
 * Solid bold rank number with crisp Netflix outline (no box)
 */
export const ImdbRankBadge: React.FC<{ rank: number; rating?: number }> = ({ rank }) => (
  <span
    className="font-black text-xl sm:text-2xl md:text-3xl text-white opacity-45 select-none tracking-tighter leading-none inline-block font-sans"
  
  >
    {rank}
  </span>
);

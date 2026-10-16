import React from 'react';
import type { Movie } from '../types/movie';
import { getBackdropUrl } from '../services/tmdb';
import { Play, Star, Calendar } from 'lucide-react';

interface HeroBannerProps {
  movie: Movie;
  onWatch: (movie: Movie) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ movie, onWatch }) => {
  const backdrop = getBackdropUrl(movie.backdrop_path);
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : '';

  return (
    <div className="relative w-full h-[420px] md:h-[500px] lg:h-[540px] overflow-hidden bg-zinc-950">
      {/* Background Image */}
      <img
        src={backdrop}
        alt={movie.title}
        className="absolute inset-0 w-full h-full object-cover object-top opacity-35 transition-transform duration-700 hover:scale-105"
      />

      {/* Gradients to blend smoothly into dark UI */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090b10] via-[#090b10]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#090b10] via-[#090b10]/80 to-transparent w-full md:w-3/4" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col justify-end px-4 md:px-8 pb-10">
        <div className="max-w-2xl space-y-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
              FEATURED
            </span>
            {releaseYear && (
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <Calendar className="w-3.5 h-3.5" />
                {releaseYear}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-amber-400 font-medium bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {movie.vote_average ? movie.vote_average.toFixed(1) : 'NR'}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            {movie.title}
          </h1>

          <p className="text-sm md:text-base text-zinc-300 line-clamp-3 leading-relaxed max-w-xl">
            {movie.overview}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onWatch(movie)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-sm md:text-base shadow-lg shadow-rose-950/40 transition transform active:scale-95 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white" />
              Play Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

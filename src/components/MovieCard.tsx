import React from 'react';
import type { Movie } from '../types/movie';
import { getPosterUrl } from '../services/tmdb';
import { Play, Star } from 'lucide-react';

interface MovieCardProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, onSelect }) => {
  const posterUrl = getPosterUrl(movie.poster_path);
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : '';

  return (
    <div
      onClick={() => onSelect(movie)}
      className="group relative flex flex-col bg-[#11131c] rounded-xl overflow-hidden border border-zinc-800/80 hover:border-zinc-600 transition-all duration-300 hover:shadow-xl hover:shadow-black/60 hover:-translate-y-1 cursor-pointer"
    >
      {/* Poster image container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900">
        <img
          src={posterUrl}
          alt={movie.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Dark gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300">
            <Play className="w-6 h-6 fill-white ml-0.5" />
          </div>
        </div>

        {/* Rating chip top-right */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[11px] font-semibold text-amber-400">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span>{movie.vote_average ? movie.vote_average.toFixed(1) : 'NR'}</span>
        </div>
      </div>

      {/* Info footer */}
      <div className="p-3 flex flex-col flex-grow justify-between">
        <h3 className="font-semibold text-sm text-zinc-100 line-clamp-1 group-hover:text-rose-400 transition-colors">
          {movie.title}
        </h3>
        <div className="flex items-center justify-between mt-1 text-xs text-zinc-400">
          <span>{releaseYear || 'Movie'}</span>
          <span className="text-[11px] text-zinc-300 hover:text-white font-medium flex items-center gap-1">
            Watch <Play className="w-2.5 h-2.5 fill-current" />
          </span>
        </div>
      </div>
    </div>
  );
};

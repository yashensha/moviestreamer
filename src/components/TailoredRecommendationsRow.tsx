import React, { useRef, useState, useEffect } from 'react';
import type { MediaItem } from '../types/movie';
import { getPosterUrl, fetchTailoredSuggestions, type TailoredSuggestionsResult } from '../services/tmdb';
import { useStreamStore } from '../store/useStreamStore';
import { ChevronLeft, ChevronRight, Play, Star, Sparkles, Heart } from 'lucide-react';

interface TailoredRecommendationsRowProps {
  onSelect: (item: MediaItem) => void;
  mediaType?: 'movie' | 'tv';
  title?: string;
}

export const TailoredRecommendationsRow: React.FC<TailoredRecommendationsRowProps> = ({
  onSelect,
  mediaType,
  title,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const likedMedia = useStreamStore((state) => state.likedMedia);
  const watchHistory = useStreamStore((state) => state.watchHistory);
  const toggleLike = useStreamStore((state) => state.toggleLike);
  const isLiked = useStreamStore((state) => state.isLiked);

  const [data, setData] = useState<TailoredSuggestionsResult>({
    items: [],
    reason: '',
    sourceTitles: [],
    topGenres: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchTailoredSuggestions(likedMedia, watchHistory, mediaType)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load tailored suggestions:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [likedMedia, watchHistory, mediaType]);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollAmount = clientWidth * 0.75;
      rowRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // If no signals and no items yet, show a tasteful helper discovery prompt
  if (data.items.length === 0 && !loading) {
    return (
      <div className="px-4 md:px-12 my-6">
        <div className="bg-gradient-to-r from-rose-950/30 via-zinc-900/60 to-zinc-900/30 border border-rose-900/40 rounded-none p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center flex-shrink-0 text-rose-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm md:text-base flex items-center gap-2">
                Personalized For You
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-rose-600/30 border border-rose-500/40 text-rose-300 rounded">
                  Learning
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Like movies & shows with the heart icon or start streaming to train your dynamic recommendations.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:space-y-3 px-4 md:px-12 my-8">
      {/* Dynamic Header with AI Taste Insights */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5 border-b border-zinc-800/80 pb-2">
        <div className="space-y-1">
          <h2 className="text-lg md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-rose-500 fill-rose-500/20" />
            <span>{title || (mediaType === 'tv' ? 'Top Series for You' : mediaType === 'movie' ? 'Top Movies for You' : 'Top Picks for You')}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded-none shadow-sm">
              Tailored
            </span>
          </h2>
          {data.reason && (
            <p className="text-xs md:text-sm text-zinc-400 flex items-center gap-1.5">
              <span>{data.reason}</span>
            </p>
          )}
        </div>

        {/* Badges for learned taste genres & likes count */}
        <div className="flex items-center gap-2 flex-wrap">
          {data.topGenres.map((genre) => (
            <span
              key={genre}
              className="text-[11px] font-medium bg-zinc-800/90 text-rose-300 px-2 py-0.5 rounded-none border border-zinc-700/80"
            >
              {genre}
            </span>
          ))}
          {likedMedia.length > 0 && (
            <span className="text-[11px] font-medium text-zinc-400 bg-zinc-900 px-2 py-0.5 border border-zinc-800 flex items-center gap-1">
              <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
              {likedMedia.length} Liked
            </span>
          )}
        </div>
      </div>

      {/* Row Container with Navigation Arrows */}
      <div className="relative group">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-30 w-10 md:w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer rounded-r"
          aria-label="Scroll Left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Scrolling Items */}
        <div
          ref={rowRef}
          className="flex items-center gap-3 md:gap-4 overflow-x-auto scrollbar-none py-3 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {loading && data.items.length === 0
            ? [...Array(6)].map((_, idx) => (
                <div key={idx} className="w-36 sm:w-44 md:w-52 flex-shrink-0 animate-pulse bg-zinc-900 border border-zinc-800">
                  <div className="aspect-[2/3] w-full bg-zinc-800/60" />
                  <div className="p-2 space-y-2">
                    <div className="h-3 bg-zinc-800 w-3/4" />
                    <div className="h-2.5 bg-zinc-800/60 w-1/2" />
                  </div>
                </div>
              ))
            : data.items.map((item, index) => {
                const poster = getPosterUrl(item.poster_path);
                const year = item.release_date ? new Date(item.release_date).getFullYear() : '';
                const liked = isLiked(item.id);

                return (
                  <div
                    key={`${item.id}-${index}`}
                    className="relative flex-shrink-0 group/card cursor-pointer transition-all duration-300 hover:scale-105 hover:z-20 w-36 sm:w-44 md:w-52"
                  >
                    <div
                      onClick={() => onSelect(item)}
                      className="relative aspect-[2/3] w-full bg-zinc-900 rounded-none overflow-hidden shadow-md group-hover/card:shadow-2xl border border-zinc-800 group-hover/card:border-zinc-500"
                    >
                      <img
                        src={poster}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover rounded-none"
                      />

                      {/* Hover Overlay with Play Button */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 rounded-none bg-white text-black flex items-center justify-center shadow-lg transform group-hover/card:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-black ml-0.5" />
                        </div>
                      </div>

                      {/* Taste Match Pill Badge */}
                      <div className="absolute top-2 left-2 z-10">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-rose-600/90 text-white px-1.5 py-0.5 rounded-none shadow backdrop-blur-sm">
                          98% Match
                        </span>
                      </div>

                      {/* Quick Like / Heart button on card */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(item);
                        }}
                        className={`absolute top-2 right-2 z-20 w-7 h-7 rounded-none flex items-center justify-center transition-all ${
                          liked
                            ? 'bg-rose-600 text-white'
                            : 'bg-black/60 text-zinc-300 hover:text-white hover:bg-black/90'
                        } backdrop-blur-sm border border-white/20`}
                        title={liked ? 'Unlike' : 'Like this title'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-white' : ''}`} />
                      </button>
                    </div>

                    {/* Metadata Card Footer */}
                    <div className="pt-2 px-0.5">
                      <h4
                        onClick={() => onSelect(item)}
                        className="font-bold text-xs md:text-sm text-zinc-200 truncate group-hover/card:text-white"
                        title={item.title}
                      >
                        {item.title}
                      </h4>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                        <span className="flex items-center gap-1 text-amber-400 font-semibold">
                          <Star className="w-3 h-3 fill-amber-400" />
                          {item.vote_average ? item.vote_average.toFixed(1) : '8.0'}
                        </span>
                        <span>{item.media_type === 'tv' ? 'TV' : 'Movie'}</span>
                        {year && <span>{year}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-30 w-10 md:w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer rounded-l"
          aria-label="Scroll Right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

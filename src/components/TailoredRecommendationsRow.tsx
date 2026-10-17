import React, { useRef, useState, useEffect } from 'react';
import type { MediaItem } from '../types/movie';
import { getPosterUrl } from '../services/tmdb';
import { useStreamStore } from '../store/useStreamStore';
import {
  generateFullRecommendationPipeline,
  type CuratedRecommendationRows,
  type ScoredRecommendationItem,
} from '../services/recommendationPipeline';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Star,
  Sparkles,
  Heart,
  Compass,
  Film,
  Check,
} from 'lucide-react';

interface TailoredRecommendationsRowProps {
  onSelect: (item: MediaItem) => void;
  mediaType?: 'movie' | 'tv';
  title?: string;
}

// Single Category Row Component with Netflix carousel controls
const RecommendationSubRow: React.FC<{
  title: string;
  badgeLabel: string;
  badgeColor?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  items: ScoredRecommendationItem[];
  onSelect: (item: MediaItem) => void;
  isLiked: (id: number) => boolean;
  toggleLike: (item: MediaItem) => void;
  isWatched: (id: number) => boolean;
  toggleWatched: (item: MediaItem) => void;
}> = ({
  title,
  badgeLabel,
  badgeColor = 'bg-rose-600',
  subtitle,
  icon,
  items,
  onSelect,
  isLiked,
  toggleLike,
  isWatched,
  toggleWatched,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

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

  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2 md:space-y-3 px-4 md:px-12 my-6">
      {/* Row Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5 border-b border-zinc-800/80 pb-2">
        <div className="space-y-0.5">
          <h2 className="text-lg md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            {icon || <Sparkles className="w-5 h-5 text-rose-500 fill-rose-500/20" />}
            <span>{title}</span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${badgeColor} text-white px-2 py-0.5 rounded-none shadow-sm`}
            >
              {badgeLabel}
            </span>
          </h2>
          {subtitle && <p className="text-xs md:text-sm text-zinc-400">{subtitle}</p>}
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
          {items.map((scored, index) => {
            const item = scored.item;
            const poster = getPosterUrl(item.poster_path);
            const year = item.release_date ? new Date(item.release_date).getFullYear() : '';
            const liked = isLiked(item.id);
            const watched = isWatched(item.id);
            const matchPct = Math.round(Math.min(99, Math.max(78, scored.hybridScore * 100)));

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

                  {/* Badges: Watched (if watched) & Hybrid Match */}
                  <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
                    {watched && (
                      <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-1.5 py-0.5 rounded-none shadow backdrop-blur-sm flex items-center gap-1 border border-emerald-400/50">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        <span>Watched</span>
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-wider bg-rose-600/90 text-white px-1.5 py-0.5 rounded-none shadow backdrop-blur-sm">
                      {matchPct}% Match
                    </span>
                    {scored.attributionTags.slice(0, 2).map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[9px] font-bold bg-black/85 text-zinc-200 border border-white/20 px-1.5 py-0.5 backdrop-blur-sm truncate max-w-[130px] rounded-none capitalize"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Top-Right Quick Actions: Watched & Like */}
                  <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWatched(item);
                      }}
                      className={`w-7 h-7 rounded-none flex items-center justify-center transition-all cursor-pointer ${
                        watched
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-black/60 text-zinc-300 hover:text-white hover:bg-black/90'
                      } backdrop-blur-sm border border-white/20`}
                      title={watched ? 'Watched! Click to unmark' : 'Mark as watched'}
                    >
                      <Check className={`w-3.5 h-3.5 stroke-[2.5] ${watched ? 'text-white' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(item);
                      }}
                      className={`w-7 h-7 rounded-none flex items-center justify-center transition-all cursor-pointer ${
                        liked
                          ? 'bg-rose-600 text-white'
                          : 'bg-black/60 text-zinc-300 hover:text-white hover:bg-black/90'
                      } backdrop-blur-sm border border-white/20`}
                      title={liked ? 'Unlike' : 'Like this title'}
                    >
                      <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-white' : ''}`} />
                    </button>
                  </div>
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

export const TailoredRecommendationsRow: React.FC<TailoredRecommendationsRowProps> = ({
  onSelect,
  mediaType,
  title,
}) => {
  const likedMedia = useStreamStore((state) => state.likedMedia);
  const watchHistory = useStreamStore((state) => state.watchHistory);
  const userRatings = useStreamStore((state) => state.userRatings);
  const toggleLike = useStreamStore((state) => state.toggleLike);
  const isLiked = useStreamStore((state) => state.isLiked);
  const toggleWatched = useStreamStore((state) => state.toggleWatched);
  const isWatched = useStreamStore((state) => state.isWatched);

  const [pipelineData, setPipelineData] = useState<CuratedRecommendationRows>({
    topPicks: [],
    dominantGenres: [],
    totalCandidatePoolCount: 0,
    modelTimestamp: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    generateFullRecommendationPipeline(watchHistory, likedMedia, userRatings, {
      preferredType: mediaType,
    })
      .then((res) => {
        if (isMounted) {
          setPipelineData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Recommendation pipeline error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [likedMedia, watchHistory, userRatings, mediaType]);

  // Cold-start helper banner
  if (pipelineData.topPicks.length === 0 && !loading) {
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
                Like movies with the heart icon, rate titles, or stream to activate your multi-stage recommendation graph.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const defaultTitle =
    title ||
    (mediaType === 'tv'
      ? 'Top Series Tailored for You'
      : mediaType === 'movie'
      ? 'Top Movies Tailored for You'
      : 'Top Picks for You');

  const dominantGenreSummary = pipelineData.dominantGenres.slice(0, 3).join(', ');

  return (
    <div className="space-y-4">
      {/* Row 1: Top Picks for You (Highest overall hybrid score) */}
      <RecommendationSubRow
        title={defaultTitle}
        badgeLabel="Hybrid AI"
        badgeColor="bg-rose-600"
        subtitle={
          dominantGenreSummary
            ? `Curated from your interaction graph & affinities in ${dominantGenreSummary}`
            : 'Scored by Content Graph & Latent Semantic Similarity'
        }
        icon={<Sparkles className="w-5 h-5 text-rose-500 fill-rose-500/20" />}
        items={pipelineData.topPicks}
        onSelect={onSelect}
        isLiked={isLiked}
        toggleLike={toggleLike}
        isWatched={isWatched}
        toggleWatched={toggleWatched}
      />

      {/* Row 2: Because You Watched [Title] (Highest single-seed similarity) */}
      {pipelineData.becauseYouWatched && (
        <RecommendationSubRow
          title={`Because You Watched "${pipelineData.becauseYouWatched.seedTitle}"`}
          badgeLabel="Graph Seed"
          badgeColor="bg-indigo-600"
          subtitle={`Similar director, cast & thematic tags linked to ${pipelineData.becauseYouWatched.seedTitle}`}
          icon={<Film className="w-5 h-5 text-indigo-400" />}
          items={pipelineData.becauseYouWatched.items}
          onSelect={onSelect}
          isLiked={isLiked}
          toggleLike={toggleLike}
          isWatched={isWatched}
          toggleWatched={toggleWatched}
        />
      )}

      {/* Row 3: Hidden Gems in [Your #1 Genre] (High rating, moderate popularity) */}
      {pipelineData.hiddenGems && (
        <RecommendationSubRow
          title={`Hidden Gems in ${pipelineData.hiddenGems.genreName}`}
          badgeLabel="Undiscovered"
          badgeColor="bg-amber-600"
          subtitle={`Critically acclaimed titles with high review averages in your #1 genre`}
          icon={<Compass className="w-5 h-5 text-amber-400" />}
          items={pipelineData.hiddenGems.items}
          onSelect={onSelect}
          isLiked={isLiked}
          toggleLike={toggleLike}
          isWatched={isWatched}
          toggleWatched={toggleWatched}
        />
      )}
    </div>
  );
};

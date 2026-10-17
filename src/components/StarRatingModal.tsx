import React, { useState, useEffect } from 'react';
import { X, Trash2, Check, Sparkles } from 'lucide-react';
import type { MediaItem } from '../types/movie';
import { useStreamStore } from '../store/useStreamStore';
import { getPosterUrl } from '../services/tmdb';

interface StarRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem | null;
}

export const StarRatingModal: React.FC<StarRatingModalProps> = ({
  isOpen,
  onClose,
  media,
}) => {
  const userRatings = useStreamStore((state) => state.userRatings);
  const rateMedia = useStreamStore((state) => state.rateMedia);
  const removeUserRating = useStreamStore((state) => state.removeUserRating);

  const existingRating = media ? userRatings.find((r) => r.id === media.id)?.rating : undefined;

  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (existingRating) {
      setSelectedRating(existingRating);
    } else {
      setSelectedRating(0);
    }
    setJustSaved(false);
  }, [existingRating, media?.id, isOpen]);

  if (!isOpen || !media) return null;

  const poster = getPosterUrl(media.poster_path);
  const activeScore = hoverRating !== null ? hoverRating : selectedRating;

  const getRatingLabel = (score: number) => {
    if (score === 0) return 'Unrated • Hover or click to rate';
    if (score <= 1.0) return '★☆☆☆☆ (1.0) Poor • Filtered from Recs';
    if (score <= 1.5) return '★½☆☆☆ (1.5) Subpar • Negative Bias';
    if (score <= 2.0) return '★★☆☆☆ (2.0) Mediocre • Low Priority';
    if (score <= 2.5) return '★★½☆☆ (2.5) Decent • Balanced';
    if (score <= 3.0) return '★★★☆☆ (3.0) Good Watch';
    if (score <= 3.5) return '★★★½☆ (3.5) Very Good';
    if (score <= 4.0) return '★★★★☆ (4.0) Great • High Match Boost';
    if (score <= 4.5) return '★★★★½ (4.5) Superb • Strong Favorite';
    return '★★★★★ (5.0) Masterpiece • Peak Taste Multiplier';
  };

  const handleSelectScore = (score: number) => {
    setSelectedRating(score);
    rateMedia(media, score);
    setJustSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleRemoveRating = () => {
    removeUserRating(media.id);
    setSelectedRating(0);
    setHoverRating(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-[#161616] border border-zinc-800 shadow-2xl shadow-black rounded-none p-6 space-y-6 text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Preview */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-24 bg-zinc-900 border border-zinc-800 flex-shrink-0 overflow-hidden shadow-lg">
            <img
              src={poster}
              alt={media.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-mono tracking-widest text-[#00E054] uppercase font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#00E054]" />
              Letterboxd 5-Star Rating
            </span>
            <h3 className="text-lg font-bold text-white truncate mt-0.5">
              {media.title}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {media.release_date ? new Date(media.release_date).getFullYear() : ''} •{' '}
              {media.media_type === 'tv' ? 'TV Series' : 'Movie'}
            </p>
          </div>
        </div>

        {/* Interactive 5-Star Rating Widget */}
        <div className="bg-[#1a1a1a] border border-zinc-800/80 p-5 flex flex-col items-center justify-center space-y-4">
          <div
            className="flex items-center gap-1.5 select-none"
            onMouseLeave={() => setHoverRating(null)}
          >
            {[1, 2, 3, 4, 5].map((starIndex) => {
              const leftValue = starIndex - 0.5;
              const rightValue = starIndex;

              const isLeftFilled = activeScore >= leftValue;
              const isRightFilled = activeScore >= rightValue;

              return (
                <div key={starIndex} className="relative w-10 h-10 cursor-pointer group">
                  {/* Left Half Hitbox (0.5 step) */}
                  <div
                    className="absolute left-0 top-0 w-1/2 h-full z-10"
                    onMouseEnter={() => setHoverRating(leftValue)}
                    onClick={() => handleSelectScore(leftValue)}
                  />

                  {/* Right Half Hitbox (1.0 step) */}
                  <div
                    className="absolute right-0 top-0 w-1/2 h-full z-10"
                    onMouseEnter={() => setHoverRating(rightValue)}
                    onClick={() => handleSelectScore(rightValue)}
                  />

                  {/* Star Visual SVG */}
                  <svg
                    viewBox="0 0 24 24"
                    className="w-10 h-10 filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                  >
                    <defs>
                      <linearGradient id={`star-half-${starIndex}`}>
                        <stop offset="50%" stopColor="#00E054" />
                        <stop offset="50%" stopColor="#2e2e2e" />
                      </linearGradient>
                    </defs>
                    <polygon
                      points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                      fill={
                        isRightFilled
                          ? '#00E054'
                          : isLeftFilled
                          ? `url(#star-half-${starIndex})`
                          : '#2e2e2e'
                      }
                      stroke={isLeftFilled || isRightFilled ? '#00E054' : '#454545'}
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              );
            })}
          </div>

          {/* Rating Value & Description */}
          <div className="text-center">
            <span
              className={`text-sm font-black tracking-wide ${
                activeScore >= 4.0
                  ? 'text-[#00E054]'
                  : activeScore >= 2.5
                  ? 'text-amber-400'
                  : activeScore > 0
                  ? 'text-rose-400'
                  : 'text-zinc-500'
              }`}
            >
              {getRatingLabel(activeScore)}
            </span>
          </div>
        </div>

        {/* Quick Value Picker (Clickable Pills) */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Quick Star Selector
          </span>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                onClick={() => handleSelectScore(val)}
                className={`py-1.5 text-xs font-bold font-mono transition cursor-pointer border ${
                  selectedRating === val
                    ? 'bg-[#00E054] text-black border-[#00E054]'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-[#00E054] hover:text-[#00E054]'
                }`}
              >
                {val}.0 ★
              </button>
            ))}
          </div>
        </div>

        {/* Feedback / Save Confirmation or Remove */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          {selectedRating > 0 ? (
            <button
              onClick={handleRemoveRating}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-rose-400 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Rating</span>
            </button>
          ) : (
            <span className="text-[11px] text-zinc-500 italic">
              Rating marks title as Watched & updates taste matrix
            </span>
          )}

          {justSaved && (
            <span className="flex items-center gap-1 text-xs text-[#00E054] font-bold animate-pulse">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              Saved to Profile!
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

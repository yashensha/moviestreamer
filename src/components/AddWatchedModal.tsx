import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Star,
  Check,
  Calendar,
  Loader2,
  PlusCircle,
  Film
} from 'lucide-react';
import { searchWithTMDB, getPosterUrl } from '../services/tmdb';
import type { MediaItem, UserRatingItem } from '../types/movie';
import { useStreamStore } from '../store/useStreamStore';
import { calculateConfidenceWeight } from '../services/letterboxd';

interface AddWatchedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded?: (item: MediaItem) => void;
}

export const AddWatchedModal: React.FC<AddWatchedModalProps> = ({
  isOpen,
  onClose,
  onAdded,
}) => {
  const addUserRating = useStreamStore((state) => state.addUserRating);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  // Rating input: 0.5 to 5.0 (0 means unrated)
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [watchDate, setWatchDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isSaved, setIsSaved] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchWithTMDB(query);
        setResults(res.slice(0, 8));
      } catch (err) {
        console.warn('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelectItem = (item: MediaItem) => {
    setSelectedItem(item);
    setIsSaved(false);
  };

  const handleSave = () => {
    if (!selectedItem) return;

    const finalRating = rating > 0 ? rating : undefined;
    const weight = calculateConfidenceWeight(finalRating);
    const timestamp = watchDate ? new Date(watchDate).getTime() : Date.now();

    const ratingItem: UserRatingItem = {
      id: selectedItem.id,
      type: selectedItem.media_type || 'movie',
      title: selectedItem.title,
      rating: finalRating,
      confidenceWeight: weight,
      source: 'manual',
      poster_path: selectedItem.poster_path,
      backdrop_path: selectedItem.backdrop_path,
      release_date: selectedItem.release_date,
      vote_average: selectedItem.vote_average,
      genre_ids: selectedItem.genre_ids,
      ratedAt: timestamp,
    };

    addUserRating(ratingItem);
    setIsSaved(true);

    if (onAdded) {
      onAdded(selectedItem);
    }

    setTimeout(() => {
      handleClose();
    }, 900);
  };

  const handleClose = () => {
    setQuery('');
    setResults([]);
    setSelectedItem(null);
    setRating(0);
    setHoverRating(0);
    setIsSaved(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#181818] border border-zinc-800 w-full max-w-xl shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-black">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-rose-600/15 border border-rose-500/40 flex items-center justify-center text-rose-500">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide">
                Add Watched Title
              </h3>
              <p className="text-xs text-zinc-400">
                Log any movie or series you've watched and seed your profile taste
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Step 1: Search or View Selected */}
          {!selectedItem ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a movie or TV show to add..."
                  autoFocus
                  className="w-full bg-zinc-900 border border-zinc-700 pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition"
                />
                {isSearching && (
                  <Loader2 className="w-4 h-4 text-zinc-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                )}
              </div>

              {results.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Search Results ({results.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                    {results.map((item) => (
                      <div
                        key={`${item.media_type || 'movie'}-${item.id}`}
                        onClick={() => handleSelectItem(item)}
                        className="flex items-center gap-3 p-2 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 transition cursor-pointer group"
                      >
                        <img
                          src={getPosterUrl(item.poster_path, 'w92')}
                          alt={item.title}
                          className="w-10 aspect-[2/3] object-cover bg-zinc-950 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-rose-400 transition">
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                            <span className="uppercase text-[9px] font-semibold px-1 py-0.2 bg-zinc-800 text-zinc-300">
                              {item.media_type === 'tv' ? 'TV' : 'Movie'}
                            </span>
                            <span>{item.release_date ? new Date(item.release_date).getFullYear() : ''}</span>
                            {item.vote_average ? (
                              <span className="flex items-center gap-0.5 text-amber-400 text-[10px]">
                                <Star className="w-2.5 h-2.5 fill-amber-400" />
                                {item.vote_average.toFixed(1)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {query && !isSearching && results.length === 0 && (
                <div className="p-8 text-center bg-zinc-900/20 border border-zinc-800 space-y-1">
                  <Film className="w-7 h-7 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400">No titles found matching "{query}"</p>
                </div>
              )}
            </div>
          ) : (
            /* Selected Title Configuration */
            <div className="space-y-5">
              {/* Selected Movie Preview Card */}
              <div className="bg-zinc-900 border border-zinc-800 p-3.5 flex gap-4 relative">
                <img
                  src={getPosterUrl(selectedItem.poster_path, 'w185')}
                  alt={selectedItem.title}
                  className="w-16 sm:w-20 aspect-[2/3] object-cover bg-zinc-950 flex-shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-rose-400">
                      {selectedItem.media_type === 'tv' ? 'TV Series' : 'Feature Film'}
                    </span>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                    >
                      Choose another
                    </button>
                  </div>
                  <h4 className="text-base font-black text-white truncate">
                    {selectedItem.title}
                  </h4>
                  <p className="text-xs text-zinc-400 line-clamp-2">
                    {selectedItem.overview || 'No description available.'}
                  </p>
                  <div className="text-[11px] text-zinc-500 pt-1">
                    Release: {selectedItem.release_date || 'Unknown'}
                  </div>
                </div>
              </div>

              {/* Star Rating Picker */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                  Your Rating (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 p-2 bg-zinc-900 border border-zinc-800">
                    {[1, 2, 3, 4, 5].map((starVal) => {
                      const active = (hoverRating || rating) >= starVal;
                      return (
                        <button
                          key={starVal}
                          type="button"
                          onMouseEnter={() => setHoverRating(starVal)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(starVal)}
                          className="p-1 text-zinc-600 hover:scale-110 transition cursor-pointer"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              active ? 'fill-[#00E054] text-[#00E054]' : 'text-zinc-600'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {rating > 0 ? (
                    <div className="text-xs text-[#00E054] font-bold">
                      {rating}.0 ★ {rating >= 4 ? '(Added to Liked)' : ''}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500">Unrated (Mark as Watched)</span>
                  )}

                  {rating > 0 && (
                    <button
                      type="button"
                      onClick={() => setRating(0)}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 underline ml-auto cursor-pointer"
                    >
                      Clear rating
                    </button>
                  )}
                </div>
              </div>

              {/* Watched Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                  Date Watched
                </label>
                <div className="relative max-w-xs">
                  <Calendar className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={watchDate}
                    onChange={(e) => setWatchDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300 transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={isSaved}
                  onClick={handleSave}
                  className={`inline-flex items-center gap-2 px-5 py-2 font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg ${
                    isSaved
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#E50914] hover:bg-[#c90812] text-white shadow-rose-950/40'
                  }`}
                >
                  {isSaved ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Saved to Profile!</span>
                    </>
                  ) : (
                    <>
                      <span>Mark as Watched</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

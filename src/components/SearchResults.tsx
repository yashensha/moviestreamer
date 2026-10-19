import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MediaItem, PersonItem } from '../types/movie';
import { getPosterUrl, fetchPersonCombinedCredits } from '../services/tmdb';
import { Film, Tv, User, ArrowLeft, Loader2 } from 'lucide-react';
import { NetflixTallCard } from './NetflixTallCard';

interface SearchResultsProps {
  query: string;
  results: MediaItem[];
  people?: PersonItem[];
  loading: boolean;
  onSelect: (item: MediaItem) => void;
  onClear: () => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  query,
  results,
  people = [],
  loading,
  onSelect,
  onClear,
}) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv' | 'people'>('all');
  const [selectedPerson, setSelectedPerson] = useState<PersonItem | null>(null);
  const [personCredits, setPersonCredits] = useState<MediaItem[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);

  const filteredMedia = results.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'people') return false;
    return item.media_type === filter;
  });

  const handleSelectPerson = async (person: PersonItem) => {
    setSelectedPerson(person);
    setLoadingCredits(true);
    const credits = await fetchPersonCombinedCredits(person.id);
    setPersonCredits(credits.length > 0 ? credits : (person.known_for || []));
    setLoadingCredits(false);
  };

  const handlePlayMedia = (item: MediaItem) => {
    const targetType = item.media_type || 'movie';
    navigate(`/${targetType}/${item.id}?play=1`);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 max-w-7xl mx-auto px-4 md:px-12 pt-24 pb-24 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
        <div>
          {selectedPerson ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedPerson(null)}
                className="p-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer"
                title="Back to search results"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span>{selectedPerson.name}</span>
                  <span className="text-xs uppercase tracking-wider bg-rose-950/70 text-rose-300 border border-rose-800/60 px-2 py-0.5 rounded-[2px] font-mono">
                    {selectedPerson.known_for_department || 'Filmography'}
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Showing filmography and associated productions
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Search results for <span className="text-[#E50914] font-extrabold">"{query}"</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                {loading
                  ? 'Searching titles and cast...'
                  : `Found ${results.length} titles${people.length > 0 ? ` and ${people.length} people` : ''}`}
              </p>
            </div>
          )}
        </div>

        {/* Filter Pills */}
        {!selectedPerson && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-[#E50914] text-white border-[#E50914]'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              All ({results.length + people.length})
            </button>
            <button
              onClick={() => setFilter('movie')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                filter === 'movie'
                  ? 'bg-[#E50914] text-white border-[#E50914]'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Film className="w-3 h-3" /> Movies ({results.filter((r) => r.media_type === 'movie').length})
            </button>
            <button
              onClick={() => setFilter('tv')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                filter === 'tv'
                  ? 'bg-[#E50914] text-white border-[#E50914]'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Tv className="w-3 h-3" /> Shows ({results.filter((r) => r.media_type === 'tv').length})
            </button>
            {people.length > 0 && (
              <button
                onClick={() => setFilter('people')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                  filter === 'people'
                    ? 'bg-[#E50914] text-white border-[#E50914]'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                <User className="w-3 h-3" /> People ({people.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Selected Person Filmography View */}
      {selectedPerson ? (
        loadingCredits ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="w-8 h-8 text-[#E50914] animate-spin" />
            <p className="text-sm text-zinc-400">Loading {selectedPerson.name}'s filmography...</p>
          </div>
        ) : personCredits.length === 0 ? (
          <div className="text-center py-16 space-y-2 text-zinc-400">
            <p className="text-sm">No streaming titles currently indexed for this person.</p>
            <button
              onClick={() => setSelectedPerson(null)}
              className="text-xs text-rose-400 hover:underline cursor-pointer"
            >
              Back to all search results
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{personCredits.length} titles in filmography</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
              {personCredits.map((item) => (
                <NetflixTallCard
                  key={`person-credit-${item.id}`}
                  item={item}
                  imageType="backdrop"
                  className="w-full"
                  onSelect={onSelect}
                  onPlay={() => handlePlayMedia(item)}
                />
              ))}
            </div>
          </div>
        )
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-10 h-10 text-[#E50914] animate-spin" />
          <p className="text-sm text-zinc-400 font-medium">Searching titles and creators...</p>
        </div>
      ) : filteredMedia.length === 0 && (filter === 'people' ? people.length === 0 : true) ? (
        <div className="text-center py-20 space-y-3 bg-zinc-950/40 border border-zinc-900 p-8 rounded-[4px]">
          <p className="text-base text-zinc-300">
            No matching titles or creators found for <span className="font-semibold text-white">"{query}"</span>.
          </p>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Try searching for titles (e.g. "Oppenheimer", "Stranger Things") or people (e.g. "Christopher Nolan", "Cillian Murphy").
          </p>
          <button
            onClick={onClear}
            className="mt-2 px-4 py-2 rounded-[3px] bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition cursor-pointer"
          >
            Clear Search & Browse
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* People Spotlight Row (when in 'all' or 'people' view) */}
          {(filter === 'all' || filter === 'people') && people.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-rose-400" />
                <span>Cast & Directors ({people.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {people.slice(0, 4).map((person) => (
                  <div
                    key={`person-${person.id}`}
                    onClick={() => handleSelectPerson(person)}
                    className="flex items-center gap-3.5 p-3 bg-zinc-900/70 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-[3px] cursor-pointer transition group"
                  >
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0 border border-zinc-700 group-hover:border-rose-500 transition">
                      <img
                        src={getPosterUrl(person.profile_path, 'w185')}
                        alt={person.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-white group-hover:text-rose-400 transition truncate">
                        {person.name}
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {person.known_for_department || 'Actor / Director'}
                      </p>
                      {person.known_for && person.known_for.length > 0 && (
                        <p className="text-[10px] text-zinc-500 truncate mt-1">
                          Known for: {person.known_for.map((k) => k.title).slice(0, 2).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Titles Results Grid */}
          {filter !== 'people' && filteredMedia.length > 0 && (
            <div className="space-y-3">
              {people.length > 0 && filter === 'all' && (
                <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Movies & Series ({filteredMedia.length})</span>
                </h3>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
                {filteredMedia.map((item) => (
                  <NetflixTallCard
                    key={`search-item-${item.media_type}-${item.id}`}
                    item={item}
                    imageType="backdrop"
                    className="w-full"
                    onSelect={onSelect}
                    onPlay={() => handlePlayMedia(item)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

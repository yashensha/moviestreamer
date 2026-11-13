import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MediaItem, PersonItem } from '../types/movie';
import { getPosterUrl } from '../services/tmdb';
import { Film, Tv, User, Loader2, ArrowRight, Sparkles } from 'lucide-react';
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

  const filteredMedia = results.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'people') return false;
    return item.media_type === filter;
  });

  const handleSelectPerson = (person: PersonItem) => {
    // Dedicated route for actor/crew profile with full filmography & role breakdown
    navigate(`/person/${person.id}`);
  };

  const handlePlayMedia = (item: MediaItem) => {
    const targetType = item.media_type || 'movie';
    navigate(`/${targetType}/${item.id}?play=1`);
  };

  const movieCount = results.filter((r) => r.media_type === 'movie').length;
  const tvCount = results.filter((r) => r.media_type === 'tv').length;
  const totalCount = results.length + people.length;

  return (
    <div className="min-h-screen bg-black text-zinc-100 max-w-7xl mx-auto px-4 md:px-12 pt-20 sm:pt-24 pb-24 space-y-8 font-sans">
      {/* Search Header Bar with Modern Glass Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-850 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
            <span>Search Results</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Results for <span className="text-[#E50914]">"{query}"</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {loading
              ? 'Searching titles, actors, and directors...'
              : `Found ${results.length} title${results.length === 1 ? '' : 's'}${
                  people.length > 0
                    ? ` and ${people.length} creator${people.length === 1 ? '' : 's'}`
                    : ''
                }`}
          </p>
        </div>

        {/* Modern 4px Radius Filter Tabs */}
        {!loading && totalCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-[4px]">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-[3px] text-xs font-bold transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All ({totalCount})
            </button>

            {movieCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('movie')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold transition cursor-pointer ${
                  filter === 'movie'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Film className="w-3 h-3" />
                <span>Movies ({movieCount})</span>
              </button>
            )}

            {tvCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('tv')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold transition cursor-pointer ${
                  filter === 'tv'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Tv className="w-3 h-3" />
                <span>Shows ({tvCount})</span>
              </button>
            )}

            {people.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter('people')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold transition cursor-pointer ${
                  filter === 'people'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <User className="w-3 h-3" />
                <span>Cast & Crew ({people.length})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 space-y-4">
          <Loader2 className="w-10 h-10 text-[#E50914] animate-spin" />
          <p className="text-sm text-zinc-400 font-medium">Scanning titles and filmographies...</p>
        </div>
      ) : filteredMedia.length === 0 && (filter === 'people' ? people.length === 0 : true) ? (
        <div className="text-center py-20 space-y-4 bg-zinc-950/60 border border-zinc-850 p-8 rounded-[4px] max-w-xl mx-auto shadow-xl">
          <p className="text-base font-semibold text-zinc-200">
            No matching titles or creators found for "{query}".
          </p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Try checking for spelling errors, or search by person (e.g. "Cillian Murphy", "Christopher Nolan") or popular franchise.
          </p>
          <button
            onClick={onClear}
            className="mt-2 px-4 py-2 rounded-[4px] bg-white hover:bg-zinc-200 text-black text-xs font-bold transition cursor-pointer shadow-md"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {/* ======================================================== */}
          {/* 1. CREATORS & CAST SPOTLIGHT (OPENS DEDICATED /person/:id) */}
          {/* ======================================================== */}
          {(filter === 'all' || filter === 'people') && people.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Cast & Crew ({people.length})</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {people.map((person) => (
                  <div
                    key={`person-${person.id}`}
                    onClick={() => handleSelectPerson(person)}
                    className="group/person relative flex items-center gap-3.5 p-3.5 bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-[4px] cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-lg hover:shadow-black"
                  >
                    {/* Portrait Photo */}
                    <div className="w-16 h-20 rounded-[4px] overflow-hidden bg-zinc-800 flex-shrink-0 border border-zinc-800 shadow">
                      <img
                        src={getPosterUrl(person.profile_path, 'w185')}
                        alt={person.name}
                        className="w-full h-full object-cover group-hover/person:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>

                    {/* Details Column */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          {person.known_for_department || 'Creator'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover/person:text-white group-hover/person:translate-x-0.5 transition-all" />
                      </div>

                      <h4 className="text-sm font-bold text-white group-hover/person:text-zinc-200 transition truncate">
                        {person.name}
                      </h4>

                      {person.known_for && person.known_for.length > 0 ? (
                        <p className="text-[10px] text-zinc-400 line-clamp-1">
                          Known for: {person.known_for.map((k) => k.title).slice(0, 2).join(', ')}
                        </p>
                      ) : (
                        <p className="text-[10px] text-zinc-500">View filmography</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. TITLES RESULTS GRID                                  */}
          {/* ======================================================== */}
          {filter !== 'people' && filteredMedia.length > 0 && (
            <div className="space-y-3">
              {people.length > 0 && filter === 'all' && (
                <h3 className="text-xs uppercase font-black tracking-wider text-zinc-400 flex items-center gap-1.5">
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

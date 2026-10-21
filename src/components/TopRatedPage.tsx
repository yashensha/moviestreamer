import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { MediaItem } from '../types/movie';
import { NetflixNavbar } from './NetflixNavbar';
import { NetflixTallCard } from './NetflixTallCard';
import {
  letterboxdTop500List,
  imdbTop200SeriesList,
  type TopRankedMediaItem,
} from '../services/topRatedLists';
import {
  LetterboxdRankBadge,
  ImdbRankBadge,
} from './PrestigeBadges';
import { Search, ArrowUpDown } from 'lucide-react';

interface TopRatedPageProps {
  onOpenItem: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
}

export const TopRatedPage: React.FC<TopRatedPageProps> = ({ onOpenItem, onPlay }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get('tab') as 'letterboxd' | 'imdb') || 'letterboxd';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDecade, setSelectedDecade] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rank' | 'rating' | 'newest' | 'oldest'>('rank');
  const [displayCount, setDisplayCount] = useState<number>(36);

  const handleTabChange = (tab: 'letterboxd' | 'imdb') => {
    setSearchParams({ tab });
    setDisplayCount(36);
    setSearchQuery('');
    setSelectedDecade('all');
  };

  const rawList: TopRankedMediaItem[] =
    activeTab === 'letterboxd' ? letterboxdTop500List : imdbTop200SeriesList;

  // Filter & sort logic
  const filteredList = useMemo(() => {
    let result = rawList;

    // 1. Text Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.original_title?.toLowerCase().includes(q)
      );
    }

    // 2. Decade Filter
    if (selectedDecade !== 'all') {
      result = result.filter((m) => {
        const year = parseInt((m.release_date || '').slice(0, 4), 10);
        if (isNaN(year)) return false;
        if (selectedDecade === '2020s') return year >= 2020;
        if (selectedDecade === '2010s') return year >= 2010 && year < 2020;
        if (selectedDecade === '2000s') return year >= 2000 && year < 2010;
        if (selectedDecade === '1990s') return year >= 1990 && year < 2000;
        if (selectedDecade === 'classic') return year < 1990;
        return true;
      });
    }

    // 3. Sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'rank') {
        return (a.rank || 9999) - (b.rank || 9999);
      }
      if (sortBy === 'rating') {
        return (b.vote_average || 0) - (a.vote_average || 0);
      }
      const yearA = parseInt((a.release_date || '').slice(0, 4), 10) || 0;
      const yearB = parseInt((b.release_date || '').slice(0, 4), 10) || 0;
      if (sortBy === 'newest') {
        return yearB - yearA;
      }
      if (sortBy === 'oldest') {
        return yearA - yearB;
      }
      return 0;
    });

    return result;
  }, [rawList, searchQuery, selectedDecade, sortBy]);

  const visibleItems = filteredList.slice(0, displayCount);
  const hasMore = displayCount < filteredList.length;

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans">
      <NetflixNavbar
        activeTab="movie"
        searchQuery=""
        onSearchChange={() => {}}
      />

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 md:px-12 pt-24 pb-24 space-y-6">
        {/* Header Bar matching SearchResults structure */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              {activeTab === 'letterboxd' ? (
                <>
                  <span>Letterboxd Top 500 Movies</span>
                </>
              ) : (
                <>
                  <span>IMDb Top 200 TV Series</span>
                </>
              )}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {activeTab === 'letterboxd'
                ? 'Official Letterboxd Top 500 narrative feature films of all time'
                : 'All-time highest rated television series on IMDb'}
            </p>
          </div>

          {/* Filter Pills matching Search filter styling */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleTabChange('letterboxd')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                activeTab === 'letterboxd'
                  ? 'bg-[#E50914] text-white border-[#E50914]'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <span>Letterboxd Top 500</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('imdb')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                activeTab === 'imdb'
                  ? 'bg-[#E50914] text-white border-[#E50914]'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <span>IMDb Top 200</span>
            </button>
          </div>
        </div>

        {/* Search & Era Sub-filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder={`Filter titles in ${activeTab === 'letterboxd' ? 'Top 500' : 'Top 200'}...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDisplayCount(36);
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-900/80 text-xs text-white placeholder-zinc-500 rounded border border-zinc-800 focus:outline-none focus:border-zinc-600 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Era / Decade Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: 'all', label: 'All Eras' },
              { id: '2020s', label: '2020s' },
              { id: '2010s', label: '2010s' },
              { id: '2000s', label: '2000s' },
              { id: '1990s', label: '1990s' },
              { id: 'classic', label: 'Classic (<1990)' },
            ].map((decade) => (
              <button
                key={decade.id}
                type="button"
                onClick={() => {
                  setSelectedDecade(decade.id);
                  setDisplayCount(36);
                }}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer whitespace-nowrap ${
                  selectedDecade === decade.id
                    ? 'bg-zinc-200 text-black font-semibold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {decade.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <ArrowUpDown className="w-3 h-3 text-zinc-500" />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setDisplayCount(36);
              }}
              className="bg-zinc-900 border border-zinc-800 text-white text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              <option value="rank">Sort by Rank (#1 first)</option>
              <option value="rating">Sort by Rating (Highest)</option>
              <option value="newest">Sort by Year (Newest)</option>
              <option value="oldest">Sort by Year (Oldest)</option>
            </select>
          </div>
        </div>

        {/* Direct Grid matching SearchResults and More Like This */}
        {visibleItems.length === 0 ? (
          <div className="text-center py-20 space-y-3 bg-zinc-950/40 border border-zinc-900 p-8 rounded-[4px]">
            <p className="text-base text-zinc-300">No matching titles found for your filters.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedDecade('all');
              }}
              className="mt-2 px-4 py-2 rounded-[3px] bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {visibleItems.map((item, index) => {
              const badge =
                activeTab === 'letterboxd' ? (
                  <LetterboxdRankBadge rank={item.rank} />
                ) : (
                  <ImdbRankBadge rank={item.rank} rating={item.imdb_rating || item.vote_average} />
                );

              return (
                <NetflixTallCard
                  key={`top-item-${activeTab}-${item.id}-${item.rank || index}`}
                  item={item}
                  imageType="backdrop"
                  className="w-full"
                  onSelect={onOpenItem}
                  onPlay={onPlay}
                  badge={badge}
                />
              );
            })}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && (
          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() => setDisplayCount((prev) => Math.min(prev + 36, filteredList.length))}
              className="px-6 py-2 rounded-[3px] bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold tracking-wide transition cursor-pointer border border-zinc-700"
            >
              Load More Titles ({filteredList.length - visibleItems.length} remaining)
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

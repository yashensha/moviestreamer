import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Film,
  Tv,
  User,
  Star,
  Bookmark,
  History,
  Award,
  Loader2,
  X,
} from 'lucide-react';
import { useCommandMenuStore } from '../store/useCommandMenuStore';
import { useStreamStore } from '../store/useStreamStore';
import { multiSearchWithTMDB, getPosterUrl } from '../services/tmdb';
import type { MediaItem, PersonItem } from '../types/movie';
import { CompactMediaCard } from './CompactMediaCard';
import {
  ICONIC_DIRECTORS,
  getPersonalizedSpotlightCreators,
  type IconicCreator,
} from '../services/creatorSpotlight';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from './ui/command';

// Monogram initials extractor (e.g. "Christopher Nolan" -> "CN")
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Resilient avatar with zero-flicker initials fallback (sharp 0px radius, pure black, borderless)
const ResilientAvatar: React.FC<{
  src: string | null | undefined;
  alt: string;
  name: string;
  className?: string;
}> = ({ src, alt, name, className = 'w-7 h-7 rounded-none' }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initials = getInitials(name);
  const hasError = !src || failedSrc === src;

  return (
    <div
      className={`relative overflow-hidden bg-black border-0 flex-shrink-0 flex items-center justify-center select-none ${className}`}
    >
      {src && !hasError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setFailedSrc(src)}
          className="w-full h-full object-cover rounded-none"
        />
      ) : (
        <span className="text-[10px] font-bold text-zinc-400 font-mono">{initials}</span>
      )}
    </div>
  );
};

type SearchCategory = 'all' | 'people' | 'movies' | 'tv';

export const CommandMenu: React.FC = () => {
  const isOpen = useCommandMenuStore((state) => state.isOpen);
  const initialQuery = useCommandMenuStore((state) => state.initialQuery);
  const close = useCommandMenuStore((state) => state.close);

  // User engagement signals from stream store
  const likedMedia = useStreamStore((state) => state.likedMedia);
  const userRatings = useStreamStore((state) => state.userRatings);
  const watchHistory = useStreamStore((state) => state.watchHistory);

  const [spotlightCreators, setSpotlightCreators] = useState<IconicCreator[]>(ICONIC_DIRECTORS);
  const [isSpotlightPersonalized, setIsSpotlightPersonalized] = useState(false);

  // Compute personalized spotlight creators based on the user's likes & favorites
  useEffect(() => {
    let isCurrent = true;
    getPersonalizedSpotlightCreators(likedMedia, userRatings, watchHistory)
      .then((res) => {
        if (isCurrent) {
          setSpotlightCreators(res.creators);
          setIsSpotlightPersonalized(res.isPersonalized);
        }
      })
      .catch((err) => {
        console.warn('Failed to resolve personalized spotlight creators:', err);
      });

    return () => {
      isCurrent = false;
    };
  }, [likedMedia, userRatings, watchHistory]);

  const [query, setQuery] = useState(initialQuery || '');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [loading, setLoading] = useState(false);
  const [mediaResults, setMediaResults] = useState<MediaItem[]>([]);
  const [peopleResults, setPeopleResults] = useState<PersonItem[]>([]);

  const navigate = useNavigate();

  // Synchronize when opened with an initial query
  useEffect(() => {
    if (isOpen && initialQuery) {
      setQuery(initialQuery);
    }
  }, [isOpen, initialQuery]);

  // Global keydown listeners: Cmd+K / Ctrl+K and '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          useCommandMenuStore.getState().open();
        }
      } else if (e.key === '/' && !isOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          useCommandMenuStore.getState().open();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Debounced TMDB Multi-Search
  useEffect(() => {
    const clean = query.trim();
    if (!clean) {
      setMediaResults([]);
      setPeopleResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await multiSearchWithTMDB(clean);
        setMediaResults(res.media || []);
        setPeopleResults(res.people || []);
      } catch (err) {
        console.error('Command menu search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Filtered views according to category pill
  const filteredPeople = useMemo(() => {
    if (category === 'movies' || category === 'tv') return [];
    return peopleResults;
  }, [peopleResults, category]);

  const filteredMedia = useMemo(() => {
    if (category === 'people') return [];
    if (category === 'movies') return mediaResults.filter((m) => m.media_type === 'movie');
    if (category === 'tv') return mediaResults.filter((m) => m.media_type === 'tv');
    return mediaResults;
  }, [mediaResults, category]);

  const handleSelectPerson = useCallback((person: { id: number; name: string }) => {
    close();
    navigate(`/person/${person.id}`);
  }, [close, navigate]);

  const handleSelectMedia = useCallback((item: MediaItem) => {
    close();
    const targetType = item.media_type || 'movie';
    navigate(`/${targetType}/${item.id}`);
  }, [close, navigate]);

  const handleSelectNavigation = useCallback((path: string) => {
    close();
    navigate(path);
  }, [close, navigate]);

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && close()}>
      {/* Search Header Bar with Input and Clear/Loading Controls */}
      <div className="relative flex items-center pr-3 bg-black">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search movies, TV shows, actors, directors..."
          className="pr-16"
        />

        <div className="absolute right-3 flex items-center gap-1.5 z-10">
          {loading && (
            <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
          )}

          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-zinc-400 hover:text-white transition cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <kbd className="hidden sm:inline-flex items-center text-[10px] text-zinc-400 bg-zinc-900 border-0 px-1.5 py-0.5 rounded-none font-mono">
            ESC
          </kbd>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-900 bg-black overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className={`px-2 py-0.5 rounded-none border-0 text-xs font-medium transition cursor-pointer ${
            category === 'all'
              ? 'bg-white text-black font-semibold'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setCategory('people')}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-none border-0 text-xs font-medium transition cursor-pointer ${
            category === 'people'
              ? 'bg-white text-black font-semibold'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <User className="w-3 h-3" />
          <span>Directors &amp; Cast</span>
          {query.trim() && peopleResults.length > 0 && (
            <span className="text-[10px] opacity-75 font-mono">({peopleResults.length})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setCategory('movies')}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-none border-0 text-xs font-medium transition cursor-pointer ${
            category === 'movies'
              ? 'bg-white text-black font-semibold'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Film className="w-3 h-3" />
          <span>Movies</span>
          {query.trim() && (
            <span className="text-[10px] opacity-75 font-mono">
              ({mediaResults.filter((m) => m.media_type === 'movie').length})
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setCategory('tv')}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-none border-0 text-xs font-medium transition cursor-pointer ${
            category === 'tv'
              ? 'bg-white text-black font-semibold'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Tv className="w-3 h-3" />
          <span>Series</span>
          {query.trim() && (
            <span className="text-[10px] opacity-75 font-mono">
              ({mediaResults.filter((m) => m.media_type === 'tv').length})
            </span>
          )}
        </button>
      </div>

      {/* Main Results List */}
      <CommandList>
        {/* Empty State */}
        {query.trim() && !loading && filteredPeople.length === 0 && filteredMedia.length === 0 && (
          <CommandEmpty>
            <p className="text-zinc-300 font-medium">No results found for &ldquo;{query}&rdquo;</p>
            <p className="text-xs text-zinc-500 mt-1">
              Check spelling or try searching for a director or actor name.
            </p>
          </CommandEmpty>
        )}

        {/* 1. PEOPLE (MAX 2 CLOSEST MATCHES IN ALL MODE) */}
        {filteredPeople.length > 0 && (
          <CommandGroup heading="People">
            {filteredPeople.slice(0, category === 'people' ? 8 : 2).map((person) => {
              const knownWorks = (person.known_for || []).slice(0, 3);

              return (
                <CommandItem
                  key={`person-${person.id}`}
                  value={`person-${person.name}-${person.id}`}
                  onSelect={() => handleSelectPerson(person)}
                  className="flex flex-col items-start gap-1.5 p-2 rounded-none border-0 bg-black hover:bg-zinc-900/60 transition"
                >
                  <div className="flex items-center gap-2.5 w-full">
                    <ResilientAvatar
                      src={person.profile_path ? getPosterUrl(person.profile_path, 'w185') : null}
                      alt={person.name}
                      name={person.name}
                      className="w-7 h-7 rounded-none"
                    />
                    <span className="font-semibold text-sm text-white">{person.name}</span>
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 bg-zinc-900 border-0 px-1.5 py-0.5 rounded-none">
                      {person.known_for_department || 'Creator'}
                    </span>
                    <CommandShortcut>Profile ↵</CommandShortcut>
                  </div>

                  {/* Known Works in Design System Compact Cards */}
                  {knownWorks.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full pt-1">
                      {knownWorks.map((work) => (
                        <CompactMediaCard
                          key={`work-${person.id}-${work.id}`}
                          item={work}
                          subtitle={work.media_type === 'tv' ? 'Series' : 'Featured'}
                          size="sm"
                          onClick={handleSelectMedia}
                        />
                      ))}
                    </div>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {filteredPeople.length > 0 && filteredMedia.length > 0 && <CommandSeparator />}

        {/* 2. MOVIES & SERIES */}
        {filteredMedia.length > 0 && (
          <CommandGroup heading="Titles">
            {filteredMedia.slice(0, 15).map((item) => {
              const year = item.release_date ? item.release_date.slice(0, 4) : '';

              return (
                <CommandItem
                  key={`media-${item.id}`}
                  value={`media-${item.title}-${item.id}`}
                  onSelect={() => handleSelectMedia(item)}
                  className="flex items-center gap-3 py-2 px-2.5 rounded-none border-0"
                >
                  {/* Poster Thumbnail */}
                  <div className="w-6 h-8 rounded-none bg-black border-0 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.poster_path ? (
                      <img
                        src={getPosterUrl(item.poster_path, 'w92')}
                        alt={item.title}
                        className="w-full h-full object-cover rounded-none"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Film className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-white truncate">{item.title}</span>
                      {year && <span className="text-xs text-zinc-400 font-mono">{year}</span>}
                      <span className="text-[9px] uppercase font-mono text-zinc-500 ml-auto flex-shrink-0">
                        {item.media_type === 'tv' ? 'TV' : 'Movie'}
                      </span>
                    </div>
                  </div>

                  {item.vote_average > 0 && (
                    <span className="text-xs text-amber-400 font-medium font-mono flex items-center gap-0.5 flex-shrink-0">
                      ★ {item.vote_average.toFixed(1)}
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* 3. INITIAL EMPTY STATE: SPOTLIGHT CREATORS & QUICK LINKS */}
        {!query.trim() && (
          <>
            <CommandGroup
              heading={
                isSpotlightPersonalized
                  ? 'Spotlight: Creators You Like'
                  : 'Spotlight Creators'
              }
            >
              {spotlightCreators.map((director) => (
                <CommandItem
                  key={`spotlight-${director.id}-${director.name}`}
                  value={`spotlight-${director.name}`}
                  onSelect={() => handleSelectPerson(director)}
                  className="flex flex-col items-start gap-1.5 p-2 rounded-none border-0 bg-black hover:bg-zinc-900/60 transition"
                >
                  <div className="flex items-center gap-2.5 w-full">
                    <ResilientAvatar
                      src={director.profilePath ? getPosterUrl(director.profilePath, 'w185') : null}
                      alt={director.name}
                      name={director.name}
                      className="w-7 h-7 rounded-none"
                    />
                    <span className="font-semibold text-sm text-white">{director.name}</span>
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 bg-zinc-900 border-0 px-1.5 py-0.5 rounded-none">
                      {director.department}
                    </span>
                    {Boolean(director.userLikedCount && director.userLikedCount > 0) && (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        ({director.userLikedCount} liked {director.userLikedCount === 1 ? 'title' : 'titles'})
                      </span>
                    )}
                    <CommandShortcut>Filmography ↵</CommandShortcut>
                  </div>

                  {/* Signature Works in Design System Compact Cards */}
                  {director.signatureWorks && director.signatureWorks.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full pt-1">
                      {director.signatureWorks.map((work) => (
                        <CompactMediaCard
                          key={`spotlight-work-${director.id}-${work.id}`}
                          item={{
                            id: work.id,
                            title: work.title,
                            media_type: work.mediaType,
                            vote_average: work.rating,
                            release_date: work.year,
                            poster_path: work.posterPath || null,
                          } as MediaItem}
                          subtitle={work.mediaType === 'tv' ? 'Series' : 'Featured'}
                          size="sm"
                          onClick={handleSelectMedia}
                        />
                      ))}
                    </div>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Quick Links">
              <CommandItem
                value="nav-letterboxd-top-500"
                onSelect={() => handleSelectNavigation('/top-rated?tab=letterboxd')}
                className="py-2 px-2.5 rounded-none border-0"
              >
                <div className="w-5 h-5 rounded-none bg-emerald-950/60 border-0 flex items-center justify-center text-emerald-400 mr-1.5">
                  <Award className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-sm text-white">Letterboxd Top 500 Movies</span>
                <span className="text-xs text-zinc-500 hidden sm:inline ml-2">All-time highest rated feature films</span>
                <CommandShortcut>Top Rated</CommandShortcut>
              </CommandItem>

              <CommandItem
                value="nav-imdb-top-200"
                onSelect={() => handleSelectNavigation('/top-rated?tab=imdb')}
                className="py-2 px-2.5 rounded-none border-0"
              >
                <div className="w-5 h-5 rounded-none bg-amber-950/60 border-0 flex items-center justify-center text-amber-400 mr-1.5">
                  <Star className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-sm text-white">IMDb Top 200 TV Series</span>
                <span className="text-xs text-zinc-500 hidden sm:inline ml-2">Prestige television classics</span>
                <CommandShortcut>Series</CommandShortcut>
              </CommandItem>

              <CommandItem
                value="nav-watchlist"
                onSelect={() => handleSelectNavigation('/my-list')}
                className="py-2 px-2.5 rounded-none border-0"
              >
                <div className="w-5 h-5 rounded-none bg-zinc-900 border-0 flex items-center justify-center text-zinc-300 mr-1.5">
                  <Bookmark className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-sm text-white">My Watchlist</span>
                <span className="text-xs text-zinc-500 hidden sm:inline ml-2">Saved titles &amp; bookmarks</span>
                <CommandShortcut>List</CommandShortcut>
              </CommandItem>

              <CommandItem
                value="nav-history"
                onSelect={() => handleSelectNavigation('/profile')}
                className="py-2 px-2.5 rounded-none border-0"
              >
                <div className="w-5 h-5 rounded-none bg-zinc-900 border-0 flex items-center justify-center text-zinc-300 mr-1.5">
                  <History className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-sm text-white">Watch History &amp; Ratings</span>
                <span className="text-xs text-zinc-500 hidden sm:inline ml-2">Letterboxd synced logs</span>
                <CommandShortcut>Profile</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Bottom Hint Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-900 bg-black text-[11px] text-zinc-500 font-sans">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="font-mono text-zinc-300 bg-zinc-900 border-0 px-1.5 py-0.5 rounded-none text-[10px]">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono text-zinc-300 bg-zinc-900 border-0 px-1.5 py-0.5 rounded-none text-[10px]">↵</kbd> select
          </span>
          <span>
            <kbd className="font-mono text-zinc-300 bg-zinc-900 border-0 px-1.5 py-0.5 rounded-none text-[10px]">esc</kbd> close
          </span>
        </div>
        <span className="text-zinc-500 font-mono text-[10px]">
          SEVEN
        </span>
      </div>
    </CommandDialog>
  );
};

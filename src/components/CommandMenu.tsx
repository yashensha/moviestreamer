import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  Search,
  Film,
  Tv,
  User,
  Star,
  ArrowRight,
  Bookmark,
  History,
  Award,
  Loader2,
  X,
} from 'lucide-react';
import { useCommandMenuStore } from '../store/useCommandMenuStore';
import { multiSearchWithTMDB, getPosterUrl } from '../services/tmdb';
import type { MediaItem, PersonItem } from '../types/movie';

// Curated list of iconic directors and creators for instant discovery when query is empty
const ICONIC_DIRECTORS: Array<{
  id: number;
  name: string;
  department: string;
  profilePath: string;
  knownFor: string;
}> = [
  {
    id: 525,
    name: 'Christopher Nolan',
    department: 'Directing',
    profilePath: '/xuAIuYSmsUzKlUMBFGVZaWsY3Z5.jpg',
    knownFor: 'Oppenheimer, Interstellar, The Dark Knight, Inception',
  },
  {
    id: 1032,
    name: 'Martin Scorsese',
    department: 'Directing',
    profilePath: '/9U9Y5GQuWX3Ebg39JdkRM52V6b5.jpg',
    knownFor: 'Taxi Driver, GoodFellas, Killers of the Flower Moon',
  },
  {
    id: 138,
    name: 'Quentin Tarantino',
    department: 'Directing & Writing',
    profilePath: '/1gjcpAa99FAQU4MZJZEurRtK8IO.jpg',
    knownFor: 'Pulp Fiction, Django Unchained, Inglourious Basterds',
  },
  {
    id: 137427,
    name: 'Denis Villeneuve',
    department: 'Directing',
    profilePath: '/tz1uO86nLd9jQZ4gJqF9k80iR8.jpg',
    knownFor: 'Dune, Blade Runner 2049, Arrival, Sicario',
  },
  {
    id: 6775,
    name: 'Greta Gerwig',
    department: 'Directing & Writing',
    profilePath: '/2tNq0vW4W2Xo3aL7x2bZ3xJ8vV.jpg',
    knownFor: 'Barbie, Little Women, Lady Bird',
  },
  {
    id: 2037,
    name: 'Cillian Murphy',
    department: 'Acting',
    profilePath: '/2lKs67r7FI4bPu0AXxMUJZxmUXn.jpg',
    knownFor: 'Oppenheimer, Peaky Blinders, 28 Days Later',
  },
  {
    id: 947,
    name: 'Hans Zimmer',
    department: 'Original Music',
    profilePath: '/tpQup1z9596UmQx25WCne4SSO.jpg',
    knownFor: 'Interstellar, Inception, Gladiator, The Lion King',
  },
];

type SearchCategory = 'all' | 'people' | 'movies' | 'tv';

export const CommandMenu: React.FC = () => {
  const isOpen = useCommandMenuStore((state) => state.isOpen);
  const initialQuery = useCommandMenuStore((state) => state.initialQuery);
  const close = useCommandMenuStore((state) => state.close);

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-[#0d0d0d] border border-zinc-800 rounded-[4px] shadow-2xl overflow-hidden font-sans flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          shouldFilter={false}
          className="flex flex-col flex-1 min-h-0 bg-transparent text-white"
        >
          {/* Top Search Input & Controls */}
          <div className="flex items-center px-4 py-3 border-b border-zinc-800/80 bg-zinc-950/60">
            <Search className="w-4 h-4 text-zinc-400 mr-3 flex-shrink-0" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search movies, TV shows, directors, actors..."
              className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none font-medium"
            />

            {loading && (
              <Loader2 className="w-4 h-4 text-zinc-400 animate-spin ml-2 flex-shrink-0" />
            )}

            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 text-zinc-500 hover:text-zinc-200 transition cursor-pointer ml-1"
                title="Clear query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={close}
              className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded-[2px] ml-2 font-mono hover:text-white transition cursor-pointer"
            >
              ESC
            </button>
          </div>

          {/* Quick Filter Category Pills */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-zinc-850/60 bg-zinc-950/30 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`px-2.5 py-1 rounded-[3px] text-xs font-semibold transition cursor-pointer ${
                category === 'all'
                  ? 'bg-zinc-200 text-black font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setCategory('people')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-xs font-semibold transition cursor-pointer ${
                category === 'people'
                  ? 'bg-zinc-200 text-black font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <User className="w-3 h-3" />
              <span>Directors &amp; Cast</span>
            </button>
            <button
              type="button"
              onClick={() => setCategory('movies')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-xs font-semibold transition cursor-pointer ${
                category === 'movies'
                  ? 'bg-zinc-200 text-black font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Film className="w-3 h-3" />
              <span>Movies</span>
            </button>
            <button
              type="button"
              onClick={() => setCategory('tv')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-xs font-semibold transition cursor-pointer ${
                category === 'tv'
                  ? 'bg-zinc-200 text-black font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Tv className="w-3 h-3" />
              <span>Series</span>
            </button>
          </div>

          {/* Scrollable Command Results List */}
          <Command.List className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-800">
            {/* Empty State */}
            {query.trim() && !loading && filteredPeople.length === 0 && filteredMedia.length === 0 && (
              <Command.Empty className="py-14 text-center space-y-2">
                <p className="text-sm text-zinc-300 font-semibold">
                  No matching titles or creators found for &ldquo;{query}&rdquo;
                </p>
                <p className="text-xs text-zinc-500">
                  Try checking spelling or search directly by creator name (e.g. &ldquo;Nolan&rdquo;, &ldquo;Scorsese&rdquo;).
                </p>
              </Command.Empty>
            )}

            {/* ======================================================== */}
            {/* GROUP 1: DIRECTORS, CREW & CAST MEMBERS                  */}
            {/* ======================================================== */}
            {filteredPeople.length > 0 && (
              <Command.Group
                heading="Directors, Creators & Cast"
                className="px-1 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider"
              >
                {filteredPeople.slice(0, 8).map((person) => (
                  <Command.Item
                    key={`person-${person.id}`}
                    value={`person-${person.name}-${person.id}`}
                    onSelect={() => handleSelectPerson(person)}
                    className="flex items-center gap-3 p-2 rounded-[4px] cursor-pointer select-none transition-colors data-[selected=true]:bg-zinc-850 data-[selected=true]:text-white hover:bg-zinc-850/80 group"
                  >
                    {/* Portrait Thumbnail */}
                    <div className="w-9 h-12 rounded-[3px] overflow-hidden bg-zinc-850 flex-shrink-0 border border-zinc-800 shadow-sm">
                      {person.profile_path ? (
                        <img
                          src={getPosterUrl(person.profile_path, 'w185')}
                          alt={person.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs font-bold">
                          {person.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Person Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white group-hover:text-zinc-100 truncate">
                          {person.name}
                        </span>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded-[2px]">
                          {person.known_for_department || 'Creator'}
                        </span>
                      </div>

                      {person.known_for && person.known_for.length > 0 ? (
                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                          Notable: {person.known_for.map((k) => k.title).slice(0, 3).join(', ')}
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-500 mt-0.5">View artist filmography &amp; roles</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-zinc-400 group-hover:text-white transition flex-shrink-0 font-medium">
                      <span>Filmography</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* ======================================================== */}
            {/* GROUP 2: MOVIES & TELEVISION SERIES                      */}
            {/* ======================================================== */}
            {filteredMedia.length > 0 && (
              <Command.Group
                heading="Movies & Series"
                className="px-1 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-3"
              >
                {filteredMedia.slice(0, 12).map((item) => {
                  const year = item.release_date ? item.release_date.slice(0, 4) : '';

                  return (
                    <Command.Item
                      key={`media-${item.id}`}
                      value={`media-${item.title}-${item.id}`}
                      onSelect={() => handleSelectMedia(item)}
                      className="flex items-center gap-3 p-2 rounded-[4px] cursor-pointer select-none transition-colors data-[selected=true]:bg-zinc-850 data-[selected=true]:text-white hover:bg-zinc-850/80 group"
                    >
                      {/* Poster Thumbnail */}
                      <div className="w-9 h-13 rounded-[3px] overflow-hidden bg-zinc-850 flex-shrink-0 border border-zinc-800 shadow-sm">
                        {item.poster_path ? (
                          <img
                            src={getPosterUrl(item.poster_path, 'w185')}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <Film className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Title & Metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white truncate">
                            {item.title}
                          </span>
                          {year && (
                            <span className="text-xs text-zinc-400 font-medium">
                              {year}
                            </span>
                          )}
                          <span className="text-[9px] uppercase font-mono tracking-wider text-zinc-500 ml-auto flex-shrink-0">
                            {item.media_type === 'tv' ? 'TV' : 'MOVIE'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-zinc-400 truncate mt-0.5">
                          {item.vote_average > 0 && (
                            <span className="text-emerald-400 font-bold flex items-center gap-0.5 flex-shrink-0">
                              ★ {item.vote_average.toFixed(1)}
                            </span>
                          )}
                          <span className="truncate">
                            {item.overview || 'Explore streaming options and details'}
                          </span>
                        </div>
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* ======================================================== */}
            {/* INITIAL STATE: ICONIC CREATORS SPOTLIGHT & QUICK NAV     */}
            {/* ======================================================== */}
            {!query.trim() && (
              <>
                <Command.Group
                  heading="Spotlight: Iconic Directors & Creators"
                  className="px-1 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider"
                >
                  {ICONIC_DIRECTORS.map((director) => (
                    <Command.Item
                      key={`featured-${director.id}`}
                      value={`featured-${director.name}`}
                      onSelect={() => handleSelectPerson(director)}
                      className="flex items-center gap-3 p-2 rounded-[4px] cursor-pointer select-none transition-colors data-[selected=true]:bg-zinc-850 data-[selected=true]:text-white hover:bg-zinc-850/80 group"
                    >
                      <div className="w-8 h-10 rounded-[3px] overflow-hidden bg-zinc-850 flex-shrink-0 border border-zinc-800">
                        <img
                          src={getPosterUrl(director.profilePath, 'w185')}
                          alt={director.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{director.name}</span>
                          <span className="text-[10px] uppercase font-semibold text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.2 rounded-[2px]">
                            {director.department}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                          {director.knownFor}
                        </p>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group
                  heading="Quick Navigation"
                  className="px-1 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-3"
                >
                  <Command.Item
                    value="nav-top-letterboxd"
                    onSelect={() => handleSelectNavigation('/top-rated?tab=letterboxd')}
                    className="flex items-center gap-3 p-2 rounded-[4px] cursor-pointer select-none transition-colors data-[selected=true]:bg-zinc-850 data-[selected=true]:text-white hover:bg-zinc-850/80"
                  >
                    <div className="w-8 h-8 rounded-[3px] bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <Award className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-white">Letterboxd Top 500 Movies</p>
                      <p className="text-xs text-zinc-400">All-time highest rated feature films</p>
                    </div>
                  </Command.Item>

                  <Command.Item
                    value="nav-top-imdb"
                    onSelect={() => handleSelectNavigation('/top-rated?tab=imdb')}
                    className="flex items-center gap-3 p-2 rounded-[4px] cursor-pointer select-none transition-colors data-[selected=true]:bg-zinc-850 data-[selected=true]:text-white hover:bg-zinc-850/80"
                  >
                    <div className="w-8 h-8 rounded-[3px] bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-400 flex-shrink-0">
                      <Star className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-white">IMDb Top 200 TV Series</p>
                      <p className="text-xs text-zinc-400">Prestige television classics and series</p>
                    </div>
                  </Command.Item>

                  <Command.Item
                    value="nav-watchlist"
                    onSelect={() => handleSelectNavigation('/my-list')}
                    className="flex items-center gap-3 p-2 rounded-[4px] cursor-pointer select-none transition-colors data-[selected=true]:bg-zinc-850 data-[selected=true]:text-white hover:bg-zinc-850/80"
                  >
                    <div className="w-8 h-8 rounded-[3px] bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 flex-shrink-0">
                      <Bookmark className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-white">My Watchlist</p>
                      <p className="text-xs text-zinc-400">Saved titles and bookmarked watchlist</p>
                    </div>
                  </Command.Item>

                  <Command.Item
                    value="nav-history"
                    onSelect={() => handleSelectNavigation('/profile')}
                    className="flex items-center gap-3 p-2 rounded-[4px] cursor-pointer select-none transition-colors data-[selected=true]:bg-zinc-850 data-[selected=true]:text-white hover:bg-zinc-850/80"
                  >
                    <div className="w-8 h-8 rounded-[3px] bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 flex-shrink-0">
                      <History className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-white">Watch History &amp; Ratings</p>
                      <p className="text-xs text-zinc-400">Past playback sessions and Letterboxd synced logs</p>
                    </div>
                  </Command.Item>
                </Command.Group>
              </>
            )}
          </Command.List>

          {/* Bottom Keyboard Hint Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-850 bg-zinc-950/80 text-[11px] text-zinc-400">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded-[2px]">↑↓</kbd> navigate
              </span>
              <span>
                <kbd className="font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded-[2px]">↵</kbd> open
              </span>
              <span>
                <kbd className="font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-1 py-0.2 rounded-[2px]">esc</kbd> close
              </span>
            </div>
            <span className="text-zinc-500 font-medium hidden sm:inline">
              SEVEN Fast Search
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
};

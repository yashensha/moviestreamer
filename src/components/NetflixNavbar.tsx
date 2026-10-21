import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, X, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { SevenLogo } from './SevenLogo';

interface NetflixNavbarProps {
  activeTab?: 'home' | 'tv' | 'movie' | 'history' | 'profile';
  onSelectTab?: (tab: 'home' | 'tv' | 'movie' | 'history' | 'profile') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  actions?: React.ReactNode;
  autoHide?: boolean;
}

export const NetflixNavbar: React.FC<NetflixNavbarProps> = ({
  activeTab,
  onSelectTab,
  searchQuery,
  onSearchChange,
  actions,
  autoHide = false,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const openLoginModal = useAuthStore((state) => state.openLoginModal);

  const currentTab =
    location.pathname.startsWith('/my-list')
      ? 'watchlist'
      : location.pathname.startsWith('/top-rated')
      ? 'top-rated'
      : location.pathname.startsWith('/profile') || location.pathname.startsWith('/history')
      ? 'profile'
      : location.pathname.startsWith('/tv') || location.pathname.startsWith('/series')
      ? 'tv'
      : location.pathname.startsWith('/movie') || location.pathname.startsWith('/movies')
      ? 'movie'
      : activeTab || 'home';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Global keyboard shortcuts: '/' or 'Cmd+K' / 'Ctrl+K' focuses search; 'Escape' dismisses
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') {
          setIsSearchOpen(false);
          searchInputRef.current?.blur();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSearch = () => {
    if (!isSearchOpen) {
      setIsSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else if (!searchQuery) {
      setIsSearchOpen(false);
    }
  };

  const handleNav = (tab: 'home' | 'tv' | 'movie' | 'history' | 'profile' | 'watchlist', path: string) => {
    onSelectTab?.(tab as any);
    onSearchChange('');
    navigate(path);
  };

  const isForcedVisible = !autoHide || isSearchOpen || Boolean(searchQuery);

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${autoHide ? 'group/nav' : ''}`}>
      {/* Invisible top hover zone */}
      {autoHide && (
        <div className="absolute top-0 left-0 right-0 h-16 pointer-events-auto" />
      )}

      <header
        className={`w-full transition-all duration-300 px-4 md:px-12 py-2 md:py-2.5 flex items-center justify-between ${
          autoHide
            ? isForcedVisible
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-full pointer-events-none group-hover/nav:opacity-100 group-hover/nav:translate-y-0 group-hover/nav:pointer-events-auto'
            : 'opacity-100 translate-y-0 pointer-events-auto'
        } ${
          isScrolled
            ? 'bg-black/95 backdrop-blur-md shadow-2xl shadow-black/80'
            : 'bg-gradient-to-b from-black/90 via-black/50 to-transparent'
        }`}
      >
        {/* Left Side: Brand Logo + Primary Nav Links */}
        <div className="flex items-center gap-5 lg:gap-9">
          {/* SEVEN Brand Logo */}
          <button
            onClick={() => handleNav('home', '/')}
            className="flex items-center focus:outline-none cursor-pointer group"
            aria-label="SEVEN Home"
            title="SEVEN"
          >
            <SevenLogo className="h-5 sm:h-6 md:h-7 w-auto group-hover:scale-105 transition-transform duration-200 drop-shadow-[0_2px_12px_rgba(229,9,20,0.35)]" />
          </button>

          {/* Navigation Links (Matching Netflix UI layout exactly) */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-5 text-xs md:text-sm font-normal">
            <button
              onClick={() => handleNav('home', '/')}
              className={`transition cursor-pointer ${
                currentTab === 'home' && !searchQuery
                  ? 'text-white font-bold cursor-default'
                  : 'text-zinc-300 hover:text-zinc-400'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => handleNav('tv', '/series')}
              className={`transition cursor-pointer ${
                currentTab === 'tv' && !searchQuery
                  ? 'text-white font-bold cursor-default'
                  : 'text-zinc-300 hover:text-zinc-400'
              }`}
            >
              TV Shows
            </button>
            <button
              onClick={() => handleNav('movie', '/movies')}
              className={`transition cursor-pointer ${
                currentTab === 'movie' && !searchQuery
                  ? 'text-white font-bold cursor-default'
                  : 'text-zinc-300 hover:text-zinc-400'
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => handleNav('home', '/')}
              className="text-zinc-300 hover:text-zinc-400 transition cursor-pointer"
            >
              New & Popular
            </button>
            <button
              onClick={() => handleNav('top-rated' as any, '/top-rated')}
              className={`transition cursor-pointer ${
                currentTab === 'top-rated' && !searchQuery
                  ? 'text-white font-bold cursor-default'
                  : 'text-zinc-300 hover:text-zinc-400'
              }`}
            >
              Top Rated
            </button>
            <button
              onClick={() => handleNav('watchlist', '/my-list')}
              className={`transition cursor-pointer ${
                currentTab === 'watchlist' && !searchQuery
                  ? 'text-white font-bold cursor-default'
                  : 'text-zinc-300 hover:text-zinc-400'
              }`}
            >
              My List
            </button>
      
          </nav>
        </div>

        {/* Right Side: Search + Kids + Notifications Bell + Profile Avatar Tile */}
        <div className="flex items-center gap-4 sm:gap-5 md:gap-6">
          {actions}

          {/* Search Bar */}
          <div className="relative flex items-center">
            <div
              className={`flex items-center transition-all duration-300 ${
                isSearchOpen || searchQuery
                  ? 'w-44 sm:w-60 md:w-72 bg-black/90 border border-white/80 px-2.5 py-1.5'
                  : 'w-8 bg-transparent border-transparent'
              }`}
            >
              <button
                type="button"
                onClick={toggleSearch}
                className="text-zinc-200 hover:text-white transition focus:outline-none cursor-pointer"
                title="Search movies and series"
              >
                <Search className="w-4 h-4 md:w-5 md:h-5" />
              </button>

              {(isSearchOpen || searchQuery) && (
                <>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Titles, people, genres..."
                    className="w-full bg-transparent border-none text-xs sm:text-sm text-white placeholder-zinc-400 focus:outline-none ml-2"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        onSearchChange('');
                        searchInputRef.current?.focus();
                      }}
                      className="text-zinc-400 hover:text-white ml-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Profile Square Avatar Tile with Chevron */}
          {user ? (
            <div
              onClick={() => handleNav('profile', '/profile')}
              className="flex items-center gap-1.5 focus:outline-none cursor-pointer group"
              title={`Profile: ${user.name || user.email}`}
            >
              <div
                className={`w-6 h-6 md:w-7 md:h-7 rounded-[3px] bg-[#E50914] flex items-center justify-center text-white text-[11px] font-bold uppercase transition-transform group-hover:scale-105 shadow ${
                  currentTab === 'profile' ? 'ring-2 ring-white' : ''
                }`}
              >
                {user.name ? user.name[0] : user.email[0]}
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-300 group-hover:text-white transition-transform duration-200 group-hover:rotate-180" />
            </div>
          ) : (
            <div
              onClick={openLoginModal}
              className="flex items-center gap-1.5 focus:outline-none cursor-pointer group"
              title="Sign In / Profile"
            >
              <div className="w-6 h-6 md:w-7 md:h-7 rounded-[3px] bg-[#E50914] flex items-center justify-center text-white text-[10px] font-black uppercase transition-transform group-hover:scale-105 shadow">
                7
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-300 group-hover:text-white transition-transform duration-200 group-hover:rotate-180" />
            </div>
          )}
        </div>
      </header>
    </div>
  );
};

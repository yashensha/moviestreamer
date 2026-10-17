import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, X, Film, Tv, Heart, User } from 'lucide-react';
import { useStreamStore } from '../store/useStreamStore';

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
  const likedMedia = useStreamStore((state) => state.likedMedia);

  const currentTab = (
    location.pathname.startsWith('/profile') || location.pathname.startsWith('/history')
      ? 'profile'
      : location.pathname.startsWith('/tv') || location.pathname.startsWith('/series')
      ? 'tv'
      : location.pathname.startsWith('/movie')
      ? 'movie'
      : activeTab || 'home'
  );

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleSearch = () => {
    if (!isSearchOpen) {
      setIsSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else if (!searchQuery) {
      setIsSearchOpen(false);
    }
  };

  const handleNav = (tab: 'home' | 'tv' | 'movie' | 'history' | 'profile', path: string) => {
    onSelectTab?.(tab);
    onSearchChange('');
    navigate(path);
  };

  const isForcedVisible = !autoHide || isSearchOpen || Boolean(searchQuery);

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${autoHide ? 'group/nav' : ''}`}>
      {/* Invisible top hover zone so hovering near top reveals navbar */}
      {autoHide && (
        <div className="absolute top-0 left-0 right-0 h-16 pointer-events-auto" />
      )}

      <header
        className={`w-full transition-all duration-300 px-4 md:px-12 py-3 md:py-4 flex items-center justify-between ${
          autoHide
            ? isForcedVisible
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-full pointer-events-none group-hover/nav:opacity-100 group-hover/nav:translate-y-0 group-hover/nav:pointer-events-auto'
            : 'opacity-100 translate-y-0 pointer-events-auto'
        } ${
          isScrolled
            ? 'bg-[#141414]/95 backdrop-blur-md shadow-2xl shadow-black/80'
            : 'bg-gradient-to-b from-black/95 via-black/70 to-transparent'
        }`}
      >
      {/* Left side: Brand Logo + Nav Links */}
      <div className="flex items-center gap-6 md:gap-10">
        <button
          onClick={() => handleNav('home', '/')}
          className="flex items-center gap-1.5 focus:outline-none cursor-pointer group"
        >
          {/* Brand Wordmark */}
          <span className="text-xl md:text-2xl font-black tracking-tighter text-[#E50914] group-hover:scale-105 transition-transform duration-200">
            MOVIE<span className="text-white ml-1">WATCHER</span>
          </span>
        </button>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
          <button
            onClick={() => handleNav('home', '/')}
            className={`transition cursor-pointer ${
              currentTab === 'home' && !searchQuery
                ? 'text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => handleNav('tv', '/series')}
            className={`flex items-center gap-1.5 transition cursor-pointer ${
              currentTab === 'tv' && !searchQuery
                ? 'text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Tv className="w-3.5 h-3.5" /> Series
          </button>
          <button
            onClick={() => handleNav('movie', '/movies')}
            className={`flex items-center gap-1.5 transition cursor-pointer ${
              currentTab === 'movie' && !searchQuery
                ? 'text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" /> Movies
          </button>
          <button
            onClick={() => handleNav('profile', '/profile')}
            className={`flex items-center gap-1.5 transition cursor-pointer ${
              currentTab === 'profile' && !searchQuery
                ? 'text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Profile
          </button>
        </nav>
      </div>

      {/* Right side: Actions + Search + Profile */}
      <div className="flex items-center gap-3 md:gap-4">
        {actions}

        {/* Dynamic Taste Profile Indicator */}
        {likedMedia.length > 0 && (
          <button
            onClick={() => handleNav('profile', '/profile')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 rounded-none text-xs text-zinc-300 shadow-sm transition cursor-pointer"
            title={`${likedMedia.length} titles liked. Click to view profile & taste`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span className="font-semibold text-rose-400">{likedMedia.length}</span>
            <span className="text-zinc-500 text-[11px]">Taste</span>
          </button>
        )}

        {/* Netflix Search Bar powered by tmdb-ts */}
        <div className="relative flex items-center">
          <div
            className={`flex items-center transition-all duration-300 rounded-full ${
              isSearchOpen || searchQuery
                ? 'w-48 sm:w-64 md:w-80 bg-black/80 border border-zinc-700/80 px-3 py-1.5'
                : 'w-8 bg-transparent border-transparent'
            }`}
          >
            <button
              type="button"
              onClick={toggleSearch}
              className="text-zinc-300 hover:text-white transition focus:outline-none cursor-pointer"
              title="Search movies and series with TMDB"
            >
              <Search className="w-4 h-4" />
            </button>

            {(isSearchOpen || searchQuery) && (
              <>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Titles, people, genres..."
                  className="w-full bg-transparent border-none text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none ml-2"
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

        {/* Profile Avatar Quick Button */}
        <button
          onClick={() => handleNav('profile', '/profile')}
          className={`w-8 h-8 rounded-none bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 flex items-center justify-center text-white border transition cursor-pointer shadow-md ${
            currentTab === 'profile'
              ? 'border-white scale-105'
              : 'border-white/20 hover:border-white/80'
          }`}
          title="Open Profile, Liked Titles & History"
        >
          <User className="w-4 h-4 text-white" />
        </button>
      </div>
    </header>
    </div>
  );
};

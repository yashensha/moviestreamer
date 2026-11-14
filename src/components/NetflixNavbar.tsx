import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCommandMenuStore } from '../store/useCommandMenuStore';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const openLoginModal = useAuthStore((state) => state.openLoginModal);

  // Close mobile menu on location change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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
          setIsMobileMenuOpen(false);
        }
        return;
      }

      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useCommandMenuStore.getState().toggle();
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        useCommandMenuStore.getState().open();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSearch = () => {
    useCommandMenuStore.getState().open(searchQuery);
  };

  const handleNav = (tab: 'home' | 'tv' | 'movie' | 'history' | 'profile' | 'watchlist', path: string) => {
    setIsMobileMenuOpen(false);
    onSelectTab?.(tab as any);
    onSearchChange('');
    navigate(path);
  };

  const isForcedVisible = !autoHide || Boolean(searchQuery);

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
        <div className="flex items-center gap-3 sm:gap-5 lg:gap-9">
          {/* SEVEN Brand Logo */}
          <button
            onClick={() => handleNav('home', '/')}
            className="flex items-center focus:outline-none cursor-pointer group"
            aria-label="SEVEN Home"
            title="SEVEN"
          >
            <SevenLogo className="h-5 sm:h-6 md:h-7 w-auto group-hover:scale-105 transition-transform duration-200 drop-shadow-[0_2px_12px_rgba(229,9,20,0.35)]" />
          </button>

          {/* Mobile "Browse" Trigger Button (Authentic Netflix Mobile UX) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden flex items-center gap-1 text-xs font-semibold text-zinc-200 hover:text-white transition focus:outline-none cursor-pointer px-2 py-1 rounded-[4px] bg-white/5 border border-white/10"
            aria-label="Toggle Browse Menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span>Browse</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isMobileMenuOpen ? 'rotate-180' : ''
              }`}
            />
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

          {/* Universal Fast Command Search (CMDK) */}
          <button
            type="button"
            onClick={toggleSearch}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 transition cursor-pointer"
            title="Search movies, directors, crew (⌘K)"
          >
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400 hidden sm:inline">Search titles, creators...</span>
            <kbd className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded-[2px] border border-zinc-800 hidden md:inline">
              ⌘K
            </kbd>
          </button>

          {/* Profile Square Avatar Tile with Chevron */}
          {user ? (
            <div
              onClick={() => handleNav('profile', '/profile')}
              className="flex items-center gap-1.5 focus:outline-none cursor-pointer group"
              title={`Profile: ${user.name || user.email}`}
            >
              <div
                className={`w-6 h-6 md:w-7 md:h-7 rounded-[4px] bg-[#E50914] flex items-center justify-center text-white text-[11px] font-bold uppercase transition-transform group-hover:scale-105 shadow ${
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
              <div className="w-6 h-6 md:w-7 md:h-7 rounded-[4px] bg-[#E50914] flex items-center justify-center text-white text-[10px] font-black uppercase transition-transform group-hover:scale-105 shadow">
                7
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-300 group-hover:text-white transition-transform duration-200 group-hover:rotate-180" />
            </div>
          )}
        </div>
      </header>

      {/* Mobile Slide-Down Navigation Menu */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 top-12 bg-black/60 backdrop-blur-xs z-30"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Menu Drawer */}
          <div className="md:hidden relative bg-black/95 backdrop-blur-xl border-b border-zinc-800 shadow-2xl z-40 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col py-3 px-6 space-y-1 text-sm font-medium">
              <button
                type="button"
                onClick={() => handleNav('home', '/')}
                className={`py-2.5 text-left transition cursor-pointer ${
                  currentTab === 'home' && !searchQuery
                    ? 'text-white font-bold border-l-2 border-[#E50914] pl-3'
                    : 'text-zinc-400 hover:text-white pl-3.5'
                }`}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => handleNav('tv', '/series')}
                className={`py-2.5 text-left transition cursor-pointer ${
                  currentTab === 'tv' && !searchQuery
                    ? 'text-white font-bold border-l-2 border-[#E50914] pl-3'
                    : 'text-zinc-400 hover:text-white pl-3.5'
                }`}
              >
                TV Shows
              </button>
              <button
                type="button"
                onClick={() => handleNav('movie', '/movies')}
                className={`py-2.5 text-left transition cursor-pointer ${
                  currentTab === 'movie' && !searchQuery
                    ? 'text-white font-bold border-l-2 border-[#E50914] pl-3'
                    : 'text-zinc-400 hover:text-white pl-3.5'
                }`}
              >
                Movies
              </button>
              <button
                type="button"
                onClick={() => handleNav('top-rated' as any, '/top-rated')}
                className={`py-2.5 text-left transition cursor-pointer ${
                  currentTab === 'top-rated' && !searchQuery
                    ? 'text-white font-bold border-l-2 border-[#E50914] pl-3'
                    : 'text-zinc-400 hover:text-white pl-3.5'
                }`}
              >
                Top Rated
              </button>
              <button
                type="button"
                onClick={() => handleNav('watchlist', '/my-list')}
                className={`py-2.5 text-left transition cursor-pointer ${
                  currentTab === 'watchlist' && !searchQuery
                    ? 'text-white font-bold border-l-2 border-[#E50914] pl-3'
                    : 'text-zinc-400 hover:text-white pl-3.5'
                }`}
              >
                My List
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

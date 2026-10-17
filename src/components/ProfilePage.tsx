import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MediaItem } from '../types/movie';
import { useStreamStore } from '../store/useStreamStore';
import { getPosterUrl, GENRE_MAP } from '../services/tmdb';
import { NetflixNavbar } from './NetflixNavbar';
import { SearchResults } from './SearchResults';
import { searchWithTMDB } from '../services/tmdb';
import {
  Play,
  Star,
  Trash2,
  Heart,
  Clock,
  Sparkles,
  User,
  RotateCcw,
  LogOut,
  LogIn
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface ProfilePageProps {
  onOpenItem?: (item: MediaItem) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenItem }) => {
  const navigate = useNavigate();
  const watchHistory = useStreamStore((state) => state.watchHistory);
  const likedMedia = useStreamStore((state) => state.likedMedia);
  const removeFromHistory = useStreamStore((state) => state.removeFromHistory);
  const clearHistory = useStreamStore((state) => state.clearHistory);
  const toggleLike = useStreamStore((state) => state.toggleLike);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const openLoginModal = useAuthStore((state) => state.openLoginModal);

  const [activeTab, setActiveTab] = useState<'all' | 'history' | 'liked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search debounce
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchWithTMDB(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Compute dominant genres from liked and watched items
  const genreWeights: Record<number, number> = {};
  likedMedia.forEach((m) => {
    (m.genre_ids || []).forEach((gid) => {
      genreWeights[gid] = (genreWeights[gid] || 0) + 3;
    });
    (m.genres || []).forEach((g) => {
      genreWeights[g.id] = (genreWeights[g.id] || 0) + 3;
    });
  });

  const dominantGenres = Object.entries(genreWeights)
    .sort((a, b) => b[1] - a[1])
    .map(([gid]) => GENRE_MAP[Number(gid)])
    .filter(Boolean)
    .slice(0, 4);

  const handlePlayItem = (type: 'movie' | 'tv', id: number, season?: number, episode?: number) => {
    const url =
      type === 'tv' && season && episode
        ? `/tv/${id}?season=${season}&episode=${episode}`
        : `/${type}/${id}`;
    navigate(url);
  };

  const handleSelectItem = (item: MediaItem) => {
    if (onOpenItem) {
      onOpenItem(item);
    } else {
      const type = item.media_type || 'movie';
      handlePlayItem(type, item.id, item.season, item.episode);
    }
  };

  return (
    <div className="min-h-screen bg-[#141414] text-zinc-100 flex flex-col selection:bg-rose-600 selection:text-white">
      {/* Top Navbar */}
      <NetflixNavbar
        activeTab="profile"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {searchQuery ? (
        <SearchResults
          query={searchQuery}
          results={searchResults}
          loading={isSearching}
          onSelect={handleSelectItem}
          onClear={() => setSearchQuery('')}
        />
      ) : (
        <main className="flex-grow max-w-7xl mx-auto w-full px-4 md:px-12 pt-28 pb-24 space-y-10">
          {/* Profile Header & Taste Card */}
          <div className="bg-[#181818] border border-zinc-800 p-6 md:p-8 rounded-none shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-5">
                {/* Netflix Style Red Avatar */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 rounded-none flex items-center justify-center text-white shadow-xl shadow-rose-950/40 border-2 border-white/20 flex-shrink-0 text-2xl font-black uppercase">
                  {user ? (user.name ? user.name[0] : user.email[0]) : <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {user ? (user.name || user.email.split('@')[0]) : 'My Profile'}
                    </h1>
                    {user ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 px-2.5 py-0.5 border border-emerald-800 rounded-none">
                        Member
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 px-2 py-0.5 border border-zinc-700 rounded-none">
                        Guest Session
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-400">
                    {user
                      ? `Signed in as ${user.email} • Synced to Cloudflare D1`
                      : 'Viewing as guest. Sign in to permanently save your history and sync across devices.'}
                  </p>
                  <div className="pt-1 flex items-center gap-3">
                    {user ? (
                      <button
                        onClick={() => logout()}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    ) : (
                      <button
                        onClick={openLoginModal}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#E50914] hover:bg-[#c90812] text-xs font-semibold text-white tracking-wide transition cursor-pointer shadow-md shadow-rose-950/30"
                      >
                        <LogIn className="w-3.5 h-3.5" /> Sign In / Register
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Badges */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 text-center rounded-none min-w-[90px]">
                  <span className="block text-xl font-bold text-white">{watchHistory.length}</span>
                  <span className="block text-[10px] uppercase font-bold text-zinc-500">Watched</span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 text-center rounded-none min-w-[90px]">
                  <span className="block text-xl font-bold text-rose-500">{likedMedia.length}</span>
                  <span className="block text-[10px] uppercase font-bold text-zinc-500">Liked</span>
                </div>
                {dominantGenres.length > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-none flex flex-col justify-center">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-rose-400" /> Top Taste
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      {dominantGenres.map((g) => (
                        <span key={g} className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 px-1.5 py-0.5 font-medium">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions Footer inside Header */}
            {(watchHistory.length > 0 || likedMedia.length > 0) && (
              <div className="mt-6 pt-5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
                <span className="text-zinc-500">
                  Preferences here automatically shape your tailored recommendations across Home and Series.
                </span>
                <button
                  onClick={() => {
                    if (window.confirm('Clear all session watch history and likes?')) {
                      clearHistory();
                    }
                  }}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Session Taste & History
                </button>
              </div>
            )}
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer rounded-none border ${
                activeTab === 'all'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              Overview ({watchHistory.length + likedMedia.length})
            </button>
            <button
              onClick={() => setActiveTab('liked')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer rounded-none border ${
                activeTab === 'liked'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              Liked Titles ({likedMedia.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer rounded-none border ${
                activeTab === 'history'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Watch History ({watchHistory.length})
            </button>
          </div>

          {/* Liked Shows & Movies Section */}
          {(activeTab === 'all' || activeTab === 'liked') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                  <span>My Liked Titles</span>
                  <span className="text-xs text-zinc-500 font-normal">({likedMedia.length})</span>
                </h2>
              </div>

              {likedMedia.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/30 border border-dashed border-zinc-800 space-y-2">
                  <Heart className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-sm font-semibold text-zinc-400">No liked titles yet</p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Click the heart icon on any movie or series to like it and help tailor your recommendations.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                  {likedMedia.map((item) => (
                    <div
                      key={item.id}
                      className="group relative bg-[#181818] border border-zinc-800 hover:border-zinc-500 transition-all duration-300 flex flex-col rounded-none overflow-hidden"
                    >
                      <div
                        onClick={() => handleSelectItem(item)}
                        className="relative aspect-[2/3] w-full bg-zinc-900 cursor-pointer overflow-hidden"
                      >
                        <img
                          src={getPosterUrl(item.poster_path)}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-10 h-10 rounded-none bg-white text-black flex items-center justify-center shadow-lg">
                            <Play className="w-5 h-5 fill-black ml-0.5" />
                          </div>
                        </div>

                        {/* Unlike Button on top-right */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(item);
                          }}
                          className="absolute top-2 right-2 w-7 h-7 bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md transition cursor-pointer"
                          title="Remove from Liked"
                        >
                          <Heart className="w-3.5 h-3.5 fill-white text-white" />
                        </button>

                        <div className="absolute top-2 left-2 bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300 uppercase">
                          {item.media_type === 'tv' ? 'TV' : 'Film'}
                        </div>
                      </div>

                      <div className="p-2.5 flex-grow flex flex-col justify-between">
                        <h4
                          onClick={() => handleSelectItem(item)}
                          className="font-bold text-xs text-white truncate cursor-pointer hover:text-rose-400"
                          title={item.title}
                        >
                          {item.title}
                        </h4>
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1.5 pt-1 border-t border-zinc-800/40">
                          <span className="flex items-center gap-1 text-amber-400 font-semibold">
                            <Star className="w-2.5 h-2.5 fill-amber-400" />
                            {item.vote_average ? item.vote_average.toFixed(1) : 'NR'}
                          </span>
                          <span className="text-zinc-500">
                            {item.release_date ? new Date(item.release_date).getFullYear() : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Watch History / Continue Watching Section */}
          {(activeTab === 'all' || activeTab === 'history') && (
            <section className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-rose-500" />
                  <span>Watch History & Continue Watching</span>
                  <span className="text-xs text-zinc-500 font-normal">({watchHistory.length})</span>
                </h2>
              </div>

              {watchHistory.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/30 border border-dashed border-zinc-800 space-y-2">
                  <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-sm font-semibold text-zinc-400">No watch history yet</p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Any movie or series you stream will appear here so you can easily resume right where you left off.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {watchHistory.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="group bg-[#181818] border border-zinc-800 hover:border-zinc-600 transition-all duration-300 p-3.5 flex flex-col justify-between space-y-3"
                    >
                      <div className="flex gap-3">
                        {/* Thumbnail / Poster */}
                        <div
                          onClick={() => handlePlayItem(item.type, item.id, item.season, item.episode)}
                          className="w-20 sm:w-24 aspect-[2/3] bg-zinc-900 flex-shrink-0 cursor-pointer relative overflow-hidden group-hover:scale-102 transition"
                        >
                          <img
                            src={getPosterUrl(item.poster_path)}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <Play className="w-5 h-5 fill-white text-white" />
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                            {item.type === 'tv' ? 'TV Series' : 'Feature Film'}
                          </span>
                          <h4
                            onClick={() => handlePlayItem(item.type, item.id, item.season, item.episode)}
                            className="font-bold text-sm text-white truncate cursor-pointer hover:text-rose-400 transition"
                            title={item.title}
                          >
                            {item.title}
                          </h4>

                          {item.type === 'tv' && item.season && item.episode ? (
                            <div className="text-xs font-semibold text-zinc-200 bg-zinc-800/90 border border-zinc-700/80 px-2 py-1 inline-block mt-1">
                              Season {item.season}, Ep {item.episode}
                            </div>
                          ) : (
                            <div className="text-xs text-zinc-400 mt-1">
                              {item.release_date ? new Date(item.release_date).getFullYear() : 'Movie'}
                            </div>
                          )}

                          <div className="text-[11px] text-zinc-500 pt-1">
                            Updated {new Date(item.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
                        <button
                          onClick={() => handlePlayItem(item.type, item.id, item.season, item.episode)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs transition cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-black" />
                          <span>{item.type === 'tv' ? 'Resume' : 'Watch'}</span>
                        </button>
                        <button
                          onClick={() => removeFromHistory(item.id)}
                          className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 border border-zinc-700 transition cursor-pointer"
                          title="Remove from history"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      )}
    </div>
  );
};

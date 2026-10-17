import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MediaItem, UserRatingItem } from '../types/movie';
import { useStreamStore } from '../store/useStreamStore';
import { getPosterUrl, GENRE_MAP, searchWithTMDB } from '../services/tmdb';
import { NetflixNavbar } from './NetflixNavbar';
import { SearchResults } from './SearchResults';
import { LetterboxdImportModal } from './LetterboxdImportModal';
import { AddWatchedModal } from './AddWatchedModal';
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
  LogIn,
  UploadCloud,
  PlusCircle,
  Film,
  ArrowUpDown,
  Sliders,
  ShieldAlert,
  Cpu,
  BarChart3
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { computeUnifiedInteractionMatrix } from '../services/interactionMatrix';

interface ProfilePageProps {
  onOpenItem?: (item: MediaItem) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenItem }) => {
  const navigate = useNavigate();
  const watchHistory = useStreamStore((state) => state.watchHistory);
  const likedMedia = useStreamStore((state) => state.likedMedia);
  const userRatings = useStreamStore((state) => state.userRatings);
  const removeFromHistory = useStreamStore((state) => state.removeFromHistory);
  const removeUserRating = useStreamStore((state) => state.removeUserRating);
  const clearHistory = useStreamStore((state) => state.clearHistory);
  const toggleLike = useStreamStore((state) => state.toggleLike);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const openLoginModal = useAuthStore((state) => state.openLoginModal);

  const [activeTab, setActiveTab] = useState<'all' | 'watched' | 'liked' | 'history' | 'matrix'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Compute Unified Interaction Matrix & BM25 normalized weights
  const tasteMatrix = useMemo(() => {
    return computeUnifiedInteractionMatrix(watchHistory, likedMedia, userRatings);
  }, [watchHistory, likedMedia, userRatings]);

  // Modals & Drag-and-Drop
  const [isLetterboxdOpen, setIsLetterboxdOpen] = useState(false);
  const [isAddWatchedOpen, setIsAddWatchedOpen] = useState(false);
  const [isPageDragActive, setIsPageDragActive] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  const handlePageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isPageDragActive) setIsPageDragActive(true);
  };

  const handlePageDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsPageDragActive(false);
  };

  const handlePageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPageDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const f = e.dataTransfer.files[0];
      if (f.name.endsWith('.csv')) {
        setDroppedFile(f);
        setIsLetterboxdOpen(true);
      }
    }
  };

  // Watched List Filters & Sorting
  const [watchedFilter, setWatchedFilter] = useState<'all' | 'rated' | 'letterboxd' | 'high'>('all');
  const [watchedSort, setWatchedSort] = useState<'recent' | 'rating' | 'year' | 'title'>('recent');

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

  // Compute dominant genres from BM25 normalized taste matrix
  const dominantGenres = useMemo(() => {
    return tasteMatrix.topGenres.map((g) => g.name).slice(0, 4);
  }, [tasteMatrix]);

  // Rating lookup map for fast UI badges
  const ratingsMap = useMemo(() => {
    const map = new Map<number, UserRatingItem>();
    userRatings.forEach((r) => map.set(r.id, r));
    return map;
  }, [userRatings]);

  // Filtered & Sorted Watched items
  const filteredWatchedItems = useMemo(() => {
    let list = [...watchHistory];

    if (watchedFilter === 'rated') {
      list = list.filter((item) => ratingsMap.has(item.id) && ratingsMap.get(item.id)?.rating);
    } else if (watchedFilter === 'letterboxd') {
      list = list.filter((item) => ratingsMap.get(item.id)?.source === 'letterboxd');
    } else if (watchedFilter === 'high') {
      list = list.filter((item) => {
        const r = ratingsMap.get(item.id)?.rating;
        return r && r >= 4.0;
      });
    }

    if (watchedSort === 'rating') {
      list.sort((a, b) => {
        const rA = ratingsMap.get(a.id)?.rating || a.vote_average || 0;
        const rB = ratingsMap.get(b.id)?.rating || b.vote_average || 0;
        return rB - rA;
      });
    } else if (watchedSort === 'year') {
      list.sort((a, b) => {
        const yA = a.release_date ? parseInt(a.release_date.slice(0, 4), 10) || 0 : 0;
        const yB = b.release_date ? parseInt(b.release_date.slice(0, 4), 10) || 0 : 0;
        return yB - yA;
      });
    } else if (watchedSort === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // 'recent'
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    return list;
  }, [watchHistory, watchedFilter, watchedSort, ratingsMap]);

  // Letterboxd import stats
  const letterboxdCount = useMemo(() => {
    return userRatings.filter((r) => r.source === 'letterboxd').length;
  }, [userRatings]);

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
    <div
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
      className="min-h-screen bg-[#141414] text-zinc-100 flex flex-col selection:bg-rose-600 selection:text-white relative"
    >
      {/* Full-Page Letterboxd Drag-and-Drop Overlay */}
      {isPageDragActive && (
        <div className="fixed inset-0 z-50 bg-black/90 border-4 border-dashed border-[#00E054] flex flex-col items-center justify-center p-8 backdrop-blur-md transition-all pointer-events-none">
          <UploadCloud className="w-16 h-16 text-[#00E054] animate-bounce mb-4" />
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">
            Drop Your Letterboxd CSV Here
          </h2>
          <p className="text-sm text-zinc-300 mt-2 font-mono text-center max-w-md">
            Release ratings.csv, watched.csv, or watchlist.csv to instantly seed your taste matrix and recommendation graph.
          </p>
          <div className="mt-4 px-3 py-1 bg-[#00E054]/20 border border-[#00E054]/60 text-[#00E054] text-xs font-mono">
            Direct Instant Import
          </div>
        </div>
      )}

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
        <main className="flex-grow max-w-7xl mx-auto w-full px-4 md:px-12 pt-28 pb-24 space-y-8">
          {/* Profile Header & Taste Card */}
          <div className="bg-[#181818] border border-zinc-800 p-6 md:p-8 rounded-none shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-48 w-80 h-80 bg-[#00E054]/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-5">
                {/* Netflix Red Avatar */}
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
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 text-center rounded-none min-w-[85px]">
                  <span className="block text-xl font-bold text-white">{watchHistory.length}</span>
                  <span className="block text-[10px] uppercase font-bold text-zinc-500">Watched</span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 text-center rounded-none min-w-[85px]">
                  <span className="block text-xl font-bold text-[#00E054]">{userRatings.length}</span>
                  <span className="block text-[10px] uppercase font-bold text-zinc-500">Rated</span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 text-center rounded-none min-w-[85px]">
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

            {/* Taste Matrix Quick Actions Bar */}
            <div className="mt-6 pt-5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Letterboxd Import Action Button */}
                <button
                  onClick={() => setIsLetterboxdOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#00E054]/15 hover:bg-[#00E054]/25 border border-[#00E054]/50 text-[#00E054] text-xs font-bold transition cursor-pointer shadow-lg shadow-[#00E054]/10"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Import Letterboxd CSV</span>
                  {letterboxdCount > 0 && (
                    <span className="bg-[#00E054] text-black text-[10px] font-black px-1.5 py-0.2 rounded-none">
                      {letterboxdCount}
                    </span>
                  )}
                </button>

                {/* Add Watched Title Action Button */}
                <button
                  onClick={() => setIsAddWatchedOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-rose-950/40"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Watched Title</span>
                </button>
              </div>

              {(watchHistory.length > 0 || likedMedia.length > 0 || userRatings.length > 0) && (
                <button
                  onClick={() => {
                    if (window.confirm('Clear all session watch history, ratings, and likes?')) {
                      clearHistory();
                    }
                  }}
                  className="flex items-center gap-1.5 text-zinc-500 hover:text-rose-400 text-xs transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Taste Data</span>
                </button>
              )}
            </div>
          </div>

          {/* Letterboxd Seed Notice Banner (if user has no ratings yet) */}
          {userRatings.length === 0 && (
            <div className="bg-gradient-to-r from-[#00E054]/10 via-zinc-900/80 to-zinc-900 border border-[#00E054]/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-none bg-[#00E054]/20 border border-[#00E054]/50 flex items-center justify-center text-[#00E054] flex-shrink-0">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Seed Your Taste Matrix with Letterboxd
                    <span className="text-[10px] bg-[#00E054]/20 text-[#00E054] px-1.5 py-0.2 uppercase font-mono">
                      Fast Cold-Start
                    </span>
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Upload your <code className="text-zinc-300">ratings.csv</code> or <code className="text-zinc-300">watched.csv</code> export to instantly populate your watched library and power recommendations.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLetterboxdOpen(true)}
                className="px-4 py-2 bg-[#00E054] hover:bg-[#00c046] text-black text-xs font-black uppercase tracking-wider transition cursor-pointer flex-shrink-0"
              >
                Import CSV Now
              </button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3">
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
              onClick={() => setActiveTab('watched')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer rounded-none border ${
                activeTab === 'watched'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Watched Titles ({watchHistory.length})
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
              Continue Watching
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer rounded-none border ${
                activeTab === 'matrix'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-rose-400" />
              Taste Matrix & Weights ({tasteMatrix.interactions.length})
            </button>
          </div>

          {/* Section: Watched Titles & Letterboxd Ratings */}
          {(activeTab === 'all' || activeTab === 'watched') && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-[#00E054]" />
                  <h2 className="text-xl font-bold text-white">Watched Titles & Ratings</h2>
                  <span className="text-xs text-zinc-500 font-normal">({filteredWatchedItems.length})</span>
                </div>

                {/* Filter and Sort Bar */}
                {watchHistory.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1">
                      <button
                        onClick={() => setWatchedFilter('all')}
                        className={`px-2 py-0.5 font-medium transition cursor-pointer ${
                          watchedFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        All ({watchHistory.length})
                      </button>
                      <button
                        onClick={() => setWatchedFilter('rated')}
                        className={`px-2 py-0.5 font-medium transition cursor-pointer ${
                          watchedFilter === 'rated' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Rated ({userRatings.length})
                      </button>
                      {letterboxdCount > 0 && (
                        <button
                          onClick={() => setWatchedFilter('letterboxd')}
                          className={`px-2 py-0.5 font-medium transition cursor-pointer flex items-center gap-1 ${
                            watchedFilter === 'letterboxd' ? 'bg-[#00E054]/20 text-[#00E054]' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Letterboxd ({letterboxdCount})
                        </button>
                      )}
                      <button
                        onClick={() => setWatchedFilter('high')}
                        className={`px-2 py-0.5 font-medium transition cursor-pointer ${
                          watchedFilter === 'high' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        4★+
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-1 text-zinc-400">
                      <ArrowUpDown className="w-3 h-3" />
                      <select
                        value={watchedSort}
                        onChange={(e) => setWatchedSort(e.target.value as any)}
                        className="bg-transparent text-xs text-zinc-300 focus:outline-none cursor-pointer"
                      >
                        <option value="recent" className="bg-zinc-900">Recently Watched</option>
                        <option value="rating" className="bg-zinc-900">Highest Rating</option>
                        <option value="year" className="bg-zinc-900">Release Year</option>
                        <option value="title" className="bg-zinc-900">Title (A-Z)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {watchHistory.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/30 border border-dashed border-zinc-800 space-y-3">
                  <Film className="w-10 h-10 text-zinc-600 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-400">No watched titles in your library</p>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      Stream any title, click "+ Add Watched Title", or import your Letterboxd export CSV to instantly populate your watched library.
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      onClick={() => setIsLetterboxdOpen(true)}
                      className="px-3.5 py-1.5 bg-[#00E054]/20 border border-[#00E054]/40 text-[#00E054] text-xs font-bold transition cursor-pointer"
                    >
                      Import Letterboxd
                    </button>
                    <button
                      onClick={() => setIsAddWatchedOpen(true)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      + Add Watched Title
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                  {filteredWatchedItems.map((item) => {
                    const ratingInfo = ratingsMap.get(item.id);
                    const isLetterboxd = ratingInfo?.source === 'letterboxd';

                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="group relative bg-[#181818] border border-zinc-800 hover:border-zinc-500 transition-all duration-300 flex flex-col rounded-none overflow-hidden"
                      >
                        {/* Poster Frame */}
                        <div
                          onClick={() => handlePlayItem(item.type, item.id, item.season, item.episode)}
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

                          {/* Rating Badge Overlay */}
                          {ratingInfo?.rating ? (
                            <div className="absolute top-2 left-2 bg-black/85 border border-[#00E054]/60 px-1.5 py-0.5 text-[11px] font-black text-[#00E054] flex items-center gap-1 shadow-md">
                              <Star className="w-2.5 h-2.5 fill-[#00E054] text-[#00E054]" />
                              <span>{ratingInfo.rating}★</span>
                            </div>
                          ) : (
                            <div className="absolute top-2 left-2 bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-300 uppercase">
                              {item.type === 'tv' ? 'TV' : 'Film'}
                            </div>
                          )}

                          {/* Source Tag on Top Right */}
                          {isLetterboxd ? (
                            <div className="absolute top-2 right-2 bg-[#00E054]/90 text-black px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider shadow">
                              LB
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLike(item as any);
                              }}
                              className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-rose-600 text-zinc-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                              title="Toggle Favorite"
                            >
                              <Heart className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Title & Metadata */}
                        <div className="p-2.5 flex-grow flex flex-col justify-between space-y-1.5">
                          <div>
                            <h4
                              onClick={() => handlePlayItem(item.type, item.id, item.season, item.episode)}
                              className="font-bold text-xs text-white truncate cursor-pointer hover:text-rose-400"
                              title={item.title}
                            >
                              {item.title}
                            </h4>
                            <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                              <span className="text-zinc-500">
                                {item.release_date ? new Date(item.release_date).getFullYear() : ''}
                              </span>
                              {item.type === 'tv' && item.season && item.episode ? (
                                <span className="text-[10px] text-zinc-400">
                                  S{item.season} E{item.episode}
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-500">
                                  {ratingInfo?.confidenceWeight ? `${ratingInfo.confidenceWeight.toFixed(1)}x wt` : 'Watched'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                            <button
                              onClick={() => handlePlayItem(item.type, item.id, item.season, item.episode)}
                              className="text-[11px] font-bold text-white hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
                            >
                              <Play className="w-2.5 h-2.5 fill-current" /> Watch
                            </button>
                            <button
                              onClick={() => {
                                removeFromHistory(item.id);
                                removeUserRating(item.id);
                              }}
                              className="text-zinc-500 hover:text-rose-400 p-1 transition cursor-pointer"
                              title="Remove from watched"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Section: Liked Shows & Movies */}
          {(activeTab === 'all' || activeTab === 'liked') && (
            <section className="space-y-4 pt-4">
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

          {/* Section: Continue Watching */}
          {(activeTab === 'all' || activeTab === 'history') && (
            <section className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-rose-500" />
                  <span>Continue Watching & Streaming Sessions</span>
                  <span className="text-xs text-zinc-500 font-normal">
                    ({watchHistory.filter((i) => i.type === 'tv' || (i.progressSeconds && i.progressSeconds < (i.durationSeconds || 7200))).length})
                  </span>
                </h2>
              </div>

              {watchHistory.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/30 border border-dashed border-zinc-800 space-y-2">
                  <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-sm font-semibold text-zinc-400">No active streaming session</p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Any movie or series you stream will appear here so you can easily resume right where you left off.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {watchHistory.slice(0, 8).map((item) => (
                    <div
                      key={`continue-${item.type}-${item.id}`}
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

          {/* Section: Unified Interaction Matrix & Weighting Engine (Step 2) */}
          {(activeTab === 'all' || activeTab === 'matrix') && (
            <section className="space-y-6 pt-6 border-t border-zinc-800/80">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-rose-500" />
                    <span>Unified Interaction Matrix & BM25 Normalization</span>
                    <span className="text-xs bg-rose-600/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 uppercase tracking-wider font-mono">
                      Step 2 Engine
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Mathematical fusion of Letterboxd imports, in-app hearts, streaming dwell duration, and negative hard-filters.
                  </p>
                </div>

                {/* BM25 Dampener Factor Indicator */}
                <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-3 self-start md:self-auto">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      BM25 Dampening Factor
                    </div>
                    <div className="text-lg font-black text-rose-400 font-mono">
                      {tasteMatrix.bm25Dampener.toFixed(2)}×
                    </div>
                  </div>
                  <div className="h-8 w-px bg-zinc-800" />
                  <div className="text-left text-[11px] text-zinc-400">
                    <span className="font-bold text-zinc-200">
                      {tasteMatrix.librarySize > 500
                        ? 'Power Importer (Dampened)'
                        : tasteMatrix.librarySize > 100
                        ? 'Active Viewer'
                        : tasteMatrix.librarySize >= 25
                        ? 'Balanced Profile'
                        : 'Sparse / Cold-Start'}
                    </span>
                    <div className="text-[10px] text-zinc-500">
                      {tasteMatrix.librarySize} total titles in taste base
                    </div>
                  </div>
                </div>
              </div>

              {/* Formula & Weight Tiers Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
                {/* 5.0★ Tier */}
                <div className="bg-[#181818] border border-zinc-800 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">5.0 Weight</span>
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {tasteMatrix.signalsCount.heart + tasteMatrix.signalsCount.letterboxd_5}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Letterboxd 5★ or In-App Heart
                  </div>
                </div>

                {/* 4.0★ Tier */}
                <div className="bg-[#181818] border border-zinc-800 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">4.0 Weight</span>
                    <Star className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {tasteMatrix.signalsCount.letterboxd_4}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Letterboxd 4★–4.5★ Ratings
                  </div>
                </div>

                {/* 3.5★ Tier */}
                <div className="bg-[#181818] border border-zinc-800 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">3.5 Weight</span>
                    <Play className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {tasteMatrix.signalsCount.completed}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Completed Stream / Episode
                  </div>
                </div>

                {/* 2.5★ Tier */}
                <div className="bg-[#181818] border border-zinc-800 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">2.5 Weight</span>
                    <Star className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {tasteMatrix.signalsCount.letterboxd_3}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Letterboxd 3★ Average
                  </div>
                </div>

                {/* 2.0★ Tier */}
                <div className="bg-[#181818] border border-zinc-800 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">2.0 Weight</span>
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {tasteMatrix.signalsCount.dwell_stream}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Stream Started (&gt;10m dwell)
                  </div>
                </div>

                {/* 1.5★ Tier */}
                <div className="bg-[#181818] border border-zinc-800 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">1.5 Weight</span>
                    <Film className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {tasteMatrix.signalsCount.watchlist}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Letterboxd Watchlist Intent
                  </div>
                </div>

                {/* 0.0★ Hard Filter Tier */}
                <div className="bg-[#181818] border border-red-900/40 p-3 flex flex-col justify-between bg-gradient-to-b from-red-950/20 to-transparent">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">0.0 Filter</span>
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                  <div className="mt-2 text-lg font-black text-rose-400">
                    {tasteMatrix.hardFilteredIds.length}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight mt-1">
                    Letterboxd 1★–2★ (Hard Excluded)
                  </div>
                </div>
              </div>

              {/* BM25 Normalization Explanation & Genre Affinities */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mathematical Engine Details */}
                <div className="bg-[#181818] border border-zinc-800 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-rose-400" />
                      <span>BM25 Length Normalization Math</span>
                    </h3>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 border border-zinc-800">
                      k₁ = 1.2, b = 0.75, L_ref = 50
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Standard recommender systems suffer when avid movie lovers import 1,000+ ratings from Letterboxd: raw frequency sums completely drown out recent activity and casual viewers.
                  </p>

                  <div className="bg-black/60 p-3 border border-zinc-800/80 font-mono text-[11px] text-zinc-300 space-y-1">
                    <div className="text-zinc-500 text-[10px]">// Okapi BM25 Document Length Scaling Formula:</div>
                    <div className="text-rose-400">
                      Scale(L) = (k₁ + 1) / (1 + k₁ · (1 - b + b · (L / L_ref)))
                    </div>
                    <div className="text-zinc-400 text-[10px] pt-1">
                      Active: ({1.2 + 1}) / (1 + 1.2 · (0.25 + 0.75 · ({tasteMatrix.librarySize} / 50))) = <strong className="text-white">{tasteMatrix.bm25Dampener.toFixed(3)}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-zinc-900/60 p-2 border border-zinc-800">
                      <div className="text-[10px] text-zinc-500 uppercase">Casual (L=10)</div>
                      <div className="text-white font-bold font-mono">1.48×</div>
                      <div className="text-[9px] text-emerald-400">Boosts Sparse</div>
                    </div>
                    <div className="bg-zinc-900/60 p-2 border border-zinc-800">
                      <div className="text-[10px] text-zinc-500 uppercase">Average (L=50)</div>
                      <div className="text-white font-bold font-mono">1.00×</div>
                      <div className="text-[9px] text-zinc-400">Neutral Baseline</div>
                    </div>
                    <div className="bg-zinc-900/60 p-2 border border-zinc-800">
                      <div className="text-[10px] text-zinc-500 uppercase">Power (L=1,000+)</div>
                      <div className="text-white font-bold font-mono">0.11×</div>
                      <div className="text-[9px] text-amber-400">Dampens Skew</div>
                    </div>
                  </div>
                </div>

                {/* Normalized Genre Affinities */}
                <div className="bg-[#181818] border border-zinc-800 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-rose-400" />
                      <span>Normalized Genre Affinities</span>
                    </h3>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Top {tasteMatrix.topGenres.length} Genres
                    </span>
                  </div>

                  {tasteMatrix.topGenres.length === 0 ? (
                    <div className="p-6 text-center text-zinc-500 text-xs">
                      No genre interactions registered yet. Rate movies or import Letterboxd to populate affinities.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tasteMatrix.topGenres.slice(0, 5).map((genre) => {
                        const maxScore = tasteMatrix.topGenres[0]?.score || 1;
                        const pct = Math.min(100, Math.round((genre.score / maxScore) * 100));
                        return (
                          <div key={genre.id} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-zinc-200">{genre.name}</span>
                              <span className="font-mono text-zinc-400 text-[11px]">
                                {genre.score.toFixed(1)} pts
                              </span>
                            </div>
                            <div className="w-full bg-zinc-900 h-2 border border-zinc-800 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-rose-600 to-amber-500 h-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Content Graph Seeds & Latent Semantic Representation */}
              <div className="bg-[#181818] border border-zinc-800 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-rose-500" />
                    <h3 className="text-sm font-bold text-white">
                      Learned Taste Vectors & Content Graph Seeds
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5">
                    128-D Latent Semantic Space Active
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  High-precision candidate generation extracts director, key cast, and thematic tags (like "time travel", "cyberpunk", "heist") from your top-weighted seeds to construct parallel candidate pools across TMDB recommendations and targeted discover queries.
                </p>

                {tasteMatrix.positiveSeeds.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500">
                    No positive seeds yet. Like titles or rate movies 3.5★–5.0★ to train your content graph.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {tasteMatrix.positiveSeeds.slice(0, 4).map((seed, idx) => (
                      <div
                        key={`seed-${seed.id}-${idx}`}
                        className="bg-zinc-900/80 border border-zinc-800 p-3 space-y-2 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-rose-400">
                              Seed #{idx + 1}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-amber-400">
                              {seed.normalizedWeight.toFixed(2)} pts
                            </span>
                          </div>
                          <h5 className="font-bold text-xs text-white truncate mt-1" title={seed.title}>
                            {seed.title}
                          </h5>
                          <div className="text-[10px] text-zinc-400 capitalize mt-0.5">
                            Signal: {seed.primarySignal.replace('_', ' ')}
                          </div>
                        </div>

                        <div className="text-[10px] text-zinc-500 font-mono pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                          <span>Graph Vector</span>
                          <span className="text-emerald-400 font-semibold">Active</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hard Filter Penalties (0.0 Weight) Table */}
              {tasteMatrix.hardFilteredIds.length > 0 && (
                <div className="bg-red-950/20 border border-red-900/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-500" />
                      <h4 className="text-sm font-bold text-rose-200">
                        Hard-Filtered Disliked Titles ({tasteMatrix.hardFilteredIds.length})
                      </h4>
                    </div>
                    <span className="text-[10px] uppercase font-mono text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2 py-0.5">
                      Excluded from Re-ranking
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Titles rated 1★–2★ on Letterboxd receive a mathematical weight of 0.0 and are completely excluded from candidate suggestions, preventing similar titles or unwanted director styles from cluttering your home feed.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {tasteMatrix.interactions
                      .filter((i) => i.isHardFiltered)
                      .slice(0, 16)
                      .map((item) => (
                        <span
                          key={`hardfilter-${item.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/60 border border-red-900/60 text-zinc-300 text-xs font-mono"
                        >
                          <span className="text-rose-500 font-bold">✕</span>
                          <span>{item.title}</span>
                          <span className="text-[10px] text-zinc-500">({item.userRating ? `${item.userRating}★` : '1-2★'})</span>
                        </span>
                      ))}
                    {tasteMatrix.hardFilteredIds.length > 16 && (
                      <span className="px-2.5 py-1 bg-zinc-900 text-zinc-500 text-xs font-mono">
                        +{tasteMatrix.hardFilteredIds.length - 16} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      )}

      {/* Letterboxd Import Modal */}
      <LetterboxdImportModal
        isOpen={isLetterboxdOpen}
        onClose={() => {
          setIsLetterboxdOpen(false);
          setDroppedFile(null);
        }}
        initialFile={droppedFile}
      />

      {/* Manual Add Watched Modal */}
      <AddWatchedModal
        isOpen={isAddWatchedOpen}
        onClose={() => setIsAddWatchedOpen(false)}
      />
    </div>
  );
};

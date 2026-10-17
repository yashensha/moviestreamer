import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import type { MediaItem } from './types/movie';
import {
  fetchTrendingMedia,
  fetchPopularSeries,
  searchWithTMDB,
  CURATED_MOVIES,
  CURATED_SERIES,
  ALL_CURATED_MEDIA,
} from './services/tmdb';
import { NetflixNavbar } from './components/NetflixNavbar';
import { NetflixHero } from './components/NetflixHero';
import { MovieRow } from './components/MovieRow';
import { TailoredRecommendationsRow } from './components/TailoredRecommendationsRow';
import { InnerDetailPage } from './components/InnerDetailPage';
import { SearchResults } from './components/SearchResults';
import { ProfilePage } from './components/ProfilePage';
import { useStreamStore } from './store/useStreamStore';

function BrowseView({
  tab,
  trending,
  seriesList,
  moviesList,
  onOpenItem,
}: {
  tab: 'home' | 'tv' | 'movie' | 'profile';
  trending: MediaItem[];
  seriesList: MediaItem[];
  moviesList: MediaItem[];
  onOpenItem: (item: MediaItem) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const watchHistory = useStreamStore((state) => state.watchHistory);

  // Search with debounce using tmdb-ts
  useEffect(() => {
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

  // Map watch history to MediaItems for the Hero banner
  const continueWatchingMedia = useMemo<MediaItem[]>(() => {
    return watchHistory.map((item) => ({
      id: item.id,
      title: item.title,
      overview: item.overview || '',
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      release_date: item.release_date || '',
      vote_average: item.vote_average ?? 8.0,
      media_type: item.type,
      number_of_seasons: item.number_of_seasons,
      season: item.season,
      episode: item.episode,
    }));
  }, [watchHistory]);

  const featuredList = useMemo(() => {
    if (tab === 'tv') {
      return seriesList.slice(0, 8);
    }
    if (tab === 'movie') {
      return moviesList.slice(0, 8);
    }
    // On home: feature continue watching if available, otherwise trending
    if (continueWatchingMedia.length > 0) {
      return continueWatchingMedia.slice(0, 8);
    }
    return trending.slice(0, 8);
  }, [tab, seriesList, moviesList, continueWatchingMedia, trending]);

  const top10Items = trending.slice(0, 10);

  return (
    <div className="min-h-screen bg-[#141414] text-zinc-100 flex flex-col selection:bg-rose-600 selection:text-white">
      {/* Netflix Top Navigation */}
      <NetflixNavbar
        activeTab={tab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {searchQuery ? (
        /* Search Results (tmdb-ts) */
        <SearchResults
          query={searchQuery}
          results={searchResults}
          loading={isSearching}
          onSelect={onOpenItem}
          onClear={() => setSearchQuery('')}
        />
      ) : (
        /* Netflix Browse Home / Category Views */
        <main className="flex-grow">
          {/* Billboard Hero Banner */}
          {featuredList.length > 0 && (
            <NetflixHero
              items={featuredList}
              onPlay={onOpenItem}
              onMoreInfo={onOpenItem}
            />
          )}

          {/* Carousel Rows Container starting cleanly below the 100vh hero */}
          <div className="relative z-20 pt-6 space-y-6 pb-20">
            {/* Dynamic TMDB Taste Tailored Recommendations Row - adapts to current page preference */}
            <TailoredRecommendationsRow
              onSelect={onOpenItem}
              mediaType={tab === 'tv' ? 'tv' : tab === 'movie' ? 'movie' : undefined}
              title={
                tab === 'tv'
                  ? 'Top Series Tailored for You'
                  : tab === 'movie'
                  ? 'Top Movies Tailored for You'
                  : 'Top Picks for You'
              }
            />

            {/* Trending Now */}
            {(tab === 'home' || tab === 'movie') && (
              <MovieRow
                title="Trending Now"
                items={trending}
                onSelect={onOpenItem}
              />
            )}

            {/* Top 10 in the World Today with stylized rank numbers */}
            {tab === 'home' && (
              <MovieRow
                title="Top 10 Today"
                items={top10Items}
                onSelect={onOpenItem}
                isTop10
              />
            )}

            {/* Popular TV Shows & Series */}
            {(tab === 'home' || tab === 'tv') && (
              <MovieRow
                title="Critically Acclaimed TV Shows & Series"
                items={seriesList}
                onSelect={onOpenItem}
              />
            )}

            {/* Blockbuster Movies */}
            {(tab === 'home' || tab === 'movie') && (
              <MovieRow
                title="Blockbuster Movies"
                items={moviesList}
                onSelect={onOpenItem}
              />
            )}
          </div>
        </main>
      )}

      {/* Netflix Footer */}
      <footer className="border-t border-zinc-900 bg-[#0f0f0f] py-12 px-4 md:px-12 text-zinc-500 text-xs space-y-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <p className="font-semibold text-zinc-400">
            Questions? Call 1-800-019-8877
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-zinc-500">
            <span>FAQ</span>
            <span>Help Center</span>
            <span>Account</span>
            <span>Media Center</span>
            <span>Terms of Use</span>
            <span>Privacy</span>
            <span>Cookie Preferences</span>
            <span>Corporate Information</span>
          </div>
          <div className="pt-4 border-t border-zinc-900 text-[11px] text-zinc-600 flex flex-wrap justify-between gap-2">
            <span>&copy; 2026 MovieWatcher</span>
            <span>All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  const navigate = useNavigate();
  const [trending, setTrending] = useState<MediaItem[]>(CURATED_MOVIES);
  const [seriesList, setSeriesList] = useState<MediaItem[]>(CURATED_SERIES);
  const [moviesList, setMoviesList] = useState<MediaItem[]>(CURATED_MOVIES);

  // Initial load
  const loadMedia = async () => {
    const [trend, popularTv] = await Promise.all([
      fetchTrendingMedia(),
      fetchPopularSeries(),
    ]);

    if (trend && trend.length > 0) {
      setTrending(trend);
      const filteredMovies = trend.filter((m) => m.media_type === 'movie');
      if (filteredMovies.length > 0) setMoviesList(filteredMovies);
    }
    if (popularTv && popularTv.length > 0) {
      setSeriesList(popularTv);
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  const handleOpenItem = (item: MediaItem) => {
    const type = item.media_type || 'movie';
    const targetUrl =
      type === 'tv' && item.season && item.episode
        ? `/tv/${item.id}?season=${item.season}&episode=${item.episode}`
        : `/${type}/${item.id}`;
    navigate(targetUrl);
  };

  const allAvailableMedia = [...trending, ...seriesList, ...ALL_CURATED_MEDIA];

  return (
    <Routes>
      <Route
        path="/"
        element={
          <BrowseView
            tab="home"
            trending={trending}
            seriesList={seriesList}
            moviesList={moviesList}
            onOpenItem={handleOpenItem}
          />
        }
      />
      <Route
        path="/series"
        element={
          <BrowseView
            tab="tv"
            trending={trending}
            seriesList={seriesList}
            moviesList={moviesList}
            onOpenItem={handleOpenItem}
          />
        }
      />
      <Route
        path="/tv"
        element={
          <BrowseView
            tab="tv"
            trending={trending}
            seriesList={seriesList}
            moviesList={moviesList}
            onOpenItem={handleOpenItem}
          />
        }
      />
      <Route
        path="/movies"
        element={
          <BrowseView
            tab="movie"
            trending={trending}
            seriesList={seriesList}
            moviesList={moviesList}
            onOpenItem={handleOpenItem}
          />
        }
      />
      <Route
        path="/movie"
        element={
          <BrowseView
            tab="movie"
            trending={trending}
            seriesList={seriesList}
            moviesList={moviesList}
            onOpenItem={handleOpenItem}
          />
        }
      />
      <Route
        path="/profile"
        element={<ProfilePage onOpenItem={handleOpenItem} />}
      />
      <Route
        path="/history"
        element={<ProfilePage onOpenItem={handleOpenItem} />}
      />
      <Route
        path="/tv/:id"
        element={<InnerDetailPage allMedia={allAvailableMedia} />}
      />
      <Route
        path="/series/:id"
        element={<InnerDetailPage allMedia={allAvailableMedia} />}
      />
      <Route
        path="/movie/:id"
        element={<InnerDetailPage allMedia={allAvailableMedia} />}
      />
      <Route
        path="/watch/:type/:id"
        element={<InnerDetailPage allMedia={allAvailableMedia} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

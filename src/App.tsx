import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import type { MediaItem, PersonItem } from './types/movie';
import {
  fetchTrendingMedia,
  fetchPopularSeries,
  multiSearchWithTMDB,
  CURATED_MOVIES,
  CURATED_SERIES,
} from './services/tmdb';
import { NetflixNavbar } from './components/NetflixNavbar';
import { NetflixHero } from './components/NetflixHero';
import { TailoredRecommendationsRow } from './components/TailoredRecommendationsRow';
import { NetflixDetailPage } from './components/NetflixDetailPage';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { SearchResults } from './components/SearchResults';
import { ProfilePage } from './components/ProfilePage';
import { AuthModal } from './components/AuthModal';
import { ContinueWatchingRow } from './components/ContinueWatchingRow';
import { PopularOnNetflixRow } from './components/PopularOnNetflixRow';
import { useStreamStore } from './store/useStreamStore';
import { useAuthStore } from './store/useAuthStore';
import { getSavedPlaybackTime } from './services/playbackStorage';
import { generateFullRecommendationPipeline } from './services/recommendationPipeline';

function BrowseView({
  tab,
  trending,
  seriesList,
  moviesList,
  onOpenItem,
  onPlayHero,
}: {
  tab: 'home' | 'tv' | 'movie' | 'profile';
  trending: MediaItem[];
  seriesList: MediaItem[];
  moviesList: MediaItem[];
  onOpenItem: (item: MediaItem) => void;
  onPlayHero: (item: MediaItem, season?: number, episode?: number) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [searchPeople, setSearchPeople] = useState<PersonItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const watchHistory = useStreamStore((state) => state.watchHistory);
  const isWatched = useStreamStore((state) => state.isWatched);
  const likedMedia = useStreamStore((state) => state.likedMedia) || [];
  const userRatings = useStreamStore((state) => state.userRatings) || [];
  const dislikedMedia = useStreamStore((state) => state.dislikedMedia) || [];
  const dismissedHistoryIds = useStreamStore((state) => state.dismissedHistoryIds) || [];

  // High Match recommendations based on User Taste DNA algorithm for Hero bottom row
  const [tasteHighMatch, setTasteHighMatch] = useState<MediaItem[]>([]);

  useEffect(() => {
    let isCurrent = true;
    generateFullRecommendationPipeline(watchHistory, likedMedia, userRatings, dislikedMedia, {
      preferredType: tab === 'tv' ? 'tv' : tab === 'movie' ? 'movie' : undefined,
    })
      .then((res) => {
        if (!isCurrent) return;
        if (res.topPicks && res.topPicks.length > 0) {
          const unhit = res.topPicks
            .filter((p) => !isWatched(p.item.id))
            .map((p) => p.item);
          if (unhit.length > 0) {
            setTasteHighMatch(unhit);
          }
        }
      })
      .catch(() => {});

    return () => {
      isCurrent = false;
    };
  }, [watchHistory, likedMedia, userRatings, dislikedMedia, tab, isWatched]);

  // Multi-entity search with debounce using tmdb-ts
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchPeople([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const res = await multiSearchWithTMDB(searchQuery);
      setSearchResults(res.media);
      setSearchPeople(res.people);
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter out ANY watched titles (movies & shows) from Home page rows
  const homeTrending = useMemo(() => {
    if (tab === 'home') {
      return trending.filter((item) => !isWatched(item.id));
    }
    return trending;
  }, [trending, isWatched, tab]);

  const homeMoviesList = useMemo(() => {
    if (tab === 'home') {
      return moviesList.filter((item) => !isWatched(item.id));
    }
    return moviesList;
  }, [moviesList, isWatched, tab]);

  // Active continue watching items (strictly excluding completed/watched items & dismissed items, requiring actual progress)
  const activeContinueWatching = useMemo(() => {
    const dismissedSet = new Set(dismissedHistoryIds);
    return watchHistory.filter((item) => {
      if (dismissedSet.has(item.id)) return false;
      if (isWatched(item.id)) return false;
      const savedRec = getSavedPlaybackTime(item.id, item.type, item.season, item.episode);
      const sec = savedRec?.seconds ?? item.progressSeconds ?? 0;
      return sec > 5;
    });
  }, [watchHistory, isWatched, dismissedHistoryIds]);

  // Map active continue watching to MediaItems for the Hero banner (strictly no episodes for movies)
  const continueWatchingMedia = useMemo<MediaItem[]>(() => {
    return activeContinueWatching.map((item) => ({
      id: item.id,
      title: item.title,
      overview: item.overview || '',
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      release_date: item.release_date || '',
      vote_average: item.vote_average ?? 8.0,
      media_type: item.type,
      number_of_seasons: item.number_of_seasons,
      season: item.type === 'tv' ? item.season : undefined,
      episode: item.type === 'tv' ? item.episode : undefined,
    }));
  }, [activeContinueWatching]);

  const featuredList = useMemo(() => {
    if (tab === 'tv') {
      return seriesList.slice(0, 8);
    }
    if (tab === 'movie') {
      return moviesList.slice(0, 8);
    }
    // On home: feature continue watching FIRST if available, then trending
    if (continueWatchingMedia.length > 0) {
      const cwIds = new Set(continueWatchingMedia.map((c) => c.id));
      const remainingTrending = homeTrending.filter((h) => !cwIds.has(h.id));
      return [...continueWatchingMedia, ...remainingTrending].slice(0, 10);
    }
    return homeTrending.slice(0, 8);
  }, [tab, seriesList, moviesList, continueWatchingMedia, homeTrending]);

  // Curated 16:9 backdrop items for Popular on Netflix row
  const popularNetflixList = useMemo(() => {
    const source =
      tab === 'tv'
        ? seriesList
        : tab === 'movie'
        ? moviesList
        : [...seriesList, ...trending];
    const seen = new Set<number>();
    return source.filter((item) => {
      if (!item.backdrop_path || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [tab, seriesList, moviesList, trending]);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col selection:bg-rose-600 selection:text-white">
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
          people={searchPeople}
          loading={isSearching}
          onSelect={onOpenItem}
          onClear={() => setSearchQuery('')}
        />
      ) : (
        /* Netflix Browse Home / Category Views */
        <main className="flex-grow">
          {/* Billboard Hero Banner with Popular on Netflix within 100vh */}
          {featuredList.length > 0 && (
            <NetflixHero
              items={featuredList}
              onPlay={onPlayHero}
              onMoreInfo={onOpenItem}
              bottomRow={
                <PopularOnNetflixRow
                  title={
                    tasteHighMatch.length > 0
                      ? 'High Match Based on Your Taste'
                      : 'Popular on Netflix'
                  }
                  items={tasteHighMatch.length > 0 ? tasteHighMatch : popularNetflixList}
                  onSelect={onOpenItem}
                  onPlay={onPlayHero}
                />
              }
            />
          )}

          {/* Carousel Rows Container starting cleanly below the 100vh hero */}
          <div className="relative z-20 pt-6 space-y-6 pb-20">
            {/* Continue Watching Row (Directly below Hero on Home) */}
            {tab === 'home' && activeContinueWatching.length > 0 && (
              <ContinueWatchingRow onSelect={onOpenItem} />
            )}

            {/* Dynamic TMDB Taste Tailored Recommendations Row */}
            <TailoredRecommendationsRow
              onSelect={onOpenItem}
              onPlay={onPlayHero}
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
              <PopularOnNetflixRow
                title="Trending Now"
                items={homeTrending}
                onSelect={onOpenItem}
              />
            )}

            {/* Popular TV Shows & Series */}
            {tab === 'tv' && (
              <PopularOnNetflixRow
                title="Critically Acclaimed TV Shows & Series"
                items={seriesList}
                onSelect={onOpenItem}
              />
            )}

            {/* Blockbuster Movies */}
            {(tab === 'home' || tab === 'movie') && (
              <PopularOnNetflixRow
                title="Blockbuster Movies"
                items={homeMoviesList}
                onSelect={onOpenItem}
              />
            )}
          </div>
        </main>
      )}

      {/* Netflix Footer */}
      <footer className="border-t border-zinc-900 bg-black py-12 px-4 md:px-12 text-zinc-500 text-xs space-y-4">
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
            <span>&copy; 2026 SEVEN</span>
            <span>All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function WatchRedirect() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [searchParams] = useSearchParams();
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');
  const query = new URLSearchParams();
  query.set('play', '1');
  if (season) query.set('season', season);
  if (episode) query.set('episode', episode);
  const targetType = type === 'tv' ? 'tv' : 'movie';
  return <Navigate to={`/${targetType}/${id}?${query.toString()}`} replace />;
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [trending, setTrending] = useState<MediaItem[]>(CURATED_MOVIES);
  const [seriesList, setSeriesList] = useState<MediaItem[]>(CURATED_SERIES);
  const [moviesList, setMoviesList] = useState<MediaItem[]>(CURATED_MOVIES);

  const checkSession = useAuthStore((state) => state.checkSession);

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
    checkSession();
  }, [checkSession]);

  // Navigates to the show / movie full detail page (not a popup modal!)
  const handleOpenItem = (item: MediaItem) => {
    const type = item.media_type || 'movie';
    navigate(`/${type}/${item.id}`);
  };

  // Direct In-Place Player Modal for Hero
  const [heroModalItem, setHeroModalItem] = useState<{
    mediaId: number;
    mediaType: 'movie' | 'tv';
    title: string;
    season?: number;
    episode?: number;
  } | null>(null);

  // Pressing Play/Resume on the Hero directly opens the popup modal right on the current page
  const handlePlayHero = (item: MediaItem, season?: number, episode?: number) => {
    const resolvedType = item.media_type || 'movie';
    const s = season || item.season || 1;
    const e = episode || item.episode || 1;
    if (resolvedType === 'tv') {
      useStreamStore.getState().saveSeriesEpisode(item.id, s, e, {
        title: item.title,
        overview: item.overview,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        release_date: item.release_date,
        vote_average: item.vote_average,
        number_of_seasons: item.number_of_seasons,
        seasons: item.seasons,
      });
    } else {
      useStreamStore.getState().saveMovieToHistory(item);
    }
    setHeroModalItem({
      mediaId: item.id,
      mediaType: resolvedType,
      title: item.title,
      season: s,
      episode: e,
    });
  };

  return (
    <>
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
              onPlayHero={handlePlayHero}
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
              onPlayHero={handlePlayHero}
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
              onPlayHero={handlePlayHero}
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
              onPlayHero={handlePlayHero}
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
              onPlayHero={handlePlayHero}
            />
          }
        />
        <Route
          path="/new"
          element={
            <BrowseView
              tab="home"
              trending={trending}
              seriesList={seriesList}
              moviesList={moviesList}
              onOpenItem={handleOpenItem}
              onPlayHero={handlePlayHero}
            />
          }
        />
        <Route
          path="/latest"
          element={
            <BrowseView
              tab="home"
              trending={trending}
              seriesList={seriesList}
              moviesList={moviesList}
              onOpenItem={handleOpenItem}
              onPlayHero={handlePlayHero}
            />
          }
        />
        <Route
          path="/languages"
          element={
            <BrowseView
              tab="home"
              trending={trending}
              seriesList={seriesList}
              moviesList={moviesList}
              onOpenItem={handleOpenItem}
              onPlayHero={handlePlayHero}
            />
          }
        />
        <Route
          path="/my-list"
          element={<ProfilePage initialTab="watchlist" onOpenItem={handleOpenItem} />}
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
          element={<NetflixDetailPage key={location.pathname} />}
        />
        <Route
          path="/series/:id"
          element={<NetflixDetailPage key={location.pathname} />}
        />
        <Route
          path="/movie/:id"
          element={<NetflixDetailPage key={location.pathname} />}
        />
        <Route
          path="/watch/:type/:id"
          element={<WatchRedirect />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AuthModal />

      {/* Hero Direct In-Place Video Player Modal (sharp edges, backdrop exit) */}
      {heroModalItem && (
        <VideoPlayerModal
          mediaId={heroModalItem.mediaId}
          mediaType={heroModalItem.mediaType}
          title={heroModalItem.title}
          season={heroModalItem.season}
          episode={heroModalItem.episode}
          onClose={() => setHeroModalItem(null)}
        />
      )}
    </>
  );
}

export default App;

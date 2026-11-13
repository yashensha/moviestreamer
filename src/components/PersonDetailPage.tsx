import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { PersonDetails, PersonCreditItem, MediaItem } from '../types/movie';
import {
  fetchPersonDetails,
  fetchPersonFullCredits,
  getPosterUrl,
  getBackdropUrl,
} from '../services/tmdb';
import { NetflixNavbar } from './NetflixNavbar';
import { VideoPlayerModal } from './VideoPlayerModal';
import { NetflixTallCard } from './NetflixTallCard';
import {
  ArrowLeft,
  Film,
  Tv,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clapperboard,
  UserCheck,
} from 'lucide-react';

export const PersonDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const personId = id ? parseInt(id, 10) : 0;

  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [castCredits, setCastCredits] = useState<PersonCreditItem[]>([]);
  const [crewCredits, setCrewCredits] = useState<PersonCreditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);

  // Active filter tab: 'all' | 'acting' | 'crew'
  const [activeTab, setActiveTab] = useState<'all' | 'acting' | 'crew'>('all');
  const [sortBy, setSortBy] = useState<'popularity' | 'year_desc' | 'year_asc'>('popularity');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'movie' | 'tv'>('all');

  // Direct In-Place Video Player Modal
  const [playerItem, setPlayerItem] = useState<{
    mediaId: number;
    mediaType: 'movie' | 'tv';
    title: string;
  } | null>(null);

  useEffect(() => {
    if (!personId) return;

    let isCurrent = true;
    setLoading(true);

    Promise.all([
      fetchPersonDetails(personId),
      fetchPersonFullCredits(personId),
    ])
      .then(([details, credits]) => {
        if (!isCurrent) return;
        setPerson(details);
        setCastCredits(credits.cast);
        setCrewCredits(credits.crew);

        // Auto-select tab based on primary department
        if (details?.known_for_department === 'Directing' || (credits.crew.length > credits.cast.length && credits.cast.length === 0)) {
          setActiveTab('crew');
        } else {
          setActiveTab(credits.cast.length > 0 ? 'acting' : 'all');
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Failed to load person profile', err);
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [personId]);

  // Combine and deduplicate credits according to active tab
  const displayedCredits = useMemo(() => {
    let list: PersonCreditItem[] = [];

    if (activeTab === 'acting') {
      list = [...castCredits];
    } else if (activeTab === 'crew') {
      list = [...crewCredits];
    } else {
      // 'all' tab: merge cast and crew while preserving role tags
      const map = new Map<number, PersonCreditItem>();
      castCredits.forEach((c) => map.set(c.id, c));
      crewCredits.forEach((c) => {
        if (!map.has(c.id)) {
          map.set(c.id, c);
        } else {
          // If in both (e.g. Director and Actor), combine role descriptions
          const existing = map.get(c.id)!;
          if (c.job && existing.character) {
            existing.job = `${c.job} & Actor`;
          }
        }
      });
      list = Array.from(map.values());
    }

    // Media type filter
    if (mediaFilter !== 'all') {
      list = list.filter((item) => item.media_type === mediaFilter);
    }

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === 'popularity') {
        return (b.vote_count || 0) - (a.vote_count || 0);
      }
      const yearA = parseInt((a.release_date || '').slice(0, 4), 10) || 0;
      const yearB = parseInt((b.release_date || '').slice(0, 4), 10) || 0;
      if (sortBy === 'year_desc') return yearB - yearA;
      if (sortBy === 'year_asc') return yearA - yearB;
      return 0;
    });
  }, [castCredits, crewCredits, activeTab, mediaFilter, sortBy]);

  // Top career highlights (Top 4 most celebrated works)
  const careerHighlights = useMemo(() => {
    const combined = [...castCredits, ...crewCredits];
    const seen = new Set<number>();
    const top: PersonCreditItem[] = [];
    for (const item of combined) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      top.push(item);
      if (top.length >= 4) break;
    }
    return top;
  }, [castCredits, crewCredits]);

  // Top backdrop image for atmospheric hero glow
  const heroBackdrop = useMemo(() => {
    const topWithBackdrop = careerHighlights.find((h) => h.backdrop_path);
    return topWithBackdrop ? getBackdropUrl(topWithBackdrop.backdrop_path, 'original') : '';
  }, [careerHighlights]);

  // Calculate age if birthday is available
  const ageDisplay = useMemo(() => {
    if (!person?.birthday) return null;
    const birthYear = parseInt(person.birthday.slice(0, 4), 10);
    if (isNaN(birthYear)) return null;
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;
    return `${person.birthday} (${age} yrs)`;
  }, [person?.birthday]);

  const handleOpenItem = (item: MediaItem) => {
    const targetType = item.media_type || 'movie';
    navigate(`/${targetType}/${item.id}`);
  };

  const handlePlayMedia = (item: MediaItem) => {
    const resolvedType = item.media_type || 'movie';
    setPlayerItem({
      mediaId: item.id,
      mediaType: resolvedType,
      title: item.title,
    });
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-rose-600 selection:text-white">
      <NetflixNavbar searchQuery="" onSearchChange={() => {}} />

      {loading ? (
        <div className="flex-grow flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="w-10 h-10 text-[#E50914] animate-spin" />
          <p className="text-sm text-zinc-400 font-medium">Loading creator profile & filmography...</p>
        </div>
      ) : !person ? (
        <div className="flex-grow flex flex-col items-center justify-center py-32 space-y-4">
          <p className="text-base text-zinc-300">Person profile not found.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 rounded-[4px] text-xs font-semibold text-white transition cursor-pointer"
          >
            Go Back
          </button>
        </div>
      ) : (
        <main className="flex-grow pb-24">
          {/* ======================================================== */}
          {/* 1. ATMOSPHERIC CREATOR HERO BILLBOARD                    */}
          {/* ======================================================== */}
          <div className="relative w-full min-h-[460px] md:min-h-[520px] bg-black overflow-hidden flex items-end">
            {/* Cinematic Ambient Background Glow */}
            {heroBackdrop && (
              <img
                src={heroBackdrop}
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-top filter brightness-[0.22] contrast-[1.1] scale-105 pointer-events-none"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent pointer-events-none" />

            {/* Quiet Ghost Back Button (Zero border slop) */}
            <div className="absolute top-20 left-4 md:left-12 z-20">
              <button
                onClick={() => navigate(-1)}
                className="group/back inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 group-hover/back:-translate-x-1 transition-transform" />
                <span>Back</span>
              </button>
            </div>

            {/* Hero Main Content Container */}
            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-12 pt-28 pb-8 flex flex-col md:flex-row gap-6 md:gap-10 items-start md:items-end">
              {/* Person Portrait Poster */}
              <div className="flex-shrink-0 w-36 sm:w-44 md:w-56 aspect-[3/4] rounded-[4px] overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl shadow-black group">
                <img
                  src={getPosterUrl(person.profile_path, 'w500')}
                  alt={person.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Bio & Details Column */}
              <div className="flex-1 space-y-3 md:space-y-4">
                {/* Clean Editorial Metadata Line (Zero badge clutter) */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-medium">
                  <span className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px]">
                    {person.known_for_department || 'Creator'}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span>{castCredits.length + crewCredits.length} Credits</span>
                  {ageDisplay && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span>{ageDisplay}</span>
                    </>
                  )}
                  {person.place_of_birth && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span>{person.place_of_birth}</span>
                    </>
                  )}
                </div>

                {/* Person Full Name */}
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-none drop-shadow-md">
                  {person.name}
                </h1>

                {/* Biography with Anti-Slop Read More */}
                {person.biography && (
                  <div className="pt-1">
                    <p
                      className={`text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-3xl font-normal transition-all duration-300 ${
                        bioExpanded ? '' : 'line-clamp-2 md:line-clamp-3'
                      }`}
                    >
                      {person.biography}
                    </p>
                    {person.biography.length > 220 && (
                      <button
                        onClick={() => setBioExpanded(!bioExpanded)}
                        className="mt-1 text-xs text-zinc-400 hover:text-white font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                      >
                        <span>{bioExpanded ? 'Show less' : 'Read full biography'}</span>
                        {bioExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 2. KNOWN FOR SHELF                                       */}
          {/* ======================================================== */}
          {careerHighlights.length > 0 && (
            <div className="w-full max-w-7xl mx-auto px-4 md:px-12 pt-8 pb-4">
              <h2 className="text-xs uppercase font-bold tracking-wider text-zinc-400 mb-3">
                Known For
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {careerHighlights.map((item) => {
                  const roleText =
                    item.character
                      ? `as ${item.character}`
                      : item.job
                      ? item.job
                      : item.media_type === 'tv'
                      ? 'Series Regular'
                      : 'Lead Cast';

                  const year = item.release_date ? item.release_date.slice(0, 4) : '';

                  return (
                    <div
                      key={`highlight-${item.id}`}
                      onClick={() => handleOpenItem(item)}
                      className="group/card relative bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-[4px] overflow-hidden p-3 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-lg hover:shadow-black"
                    >
                      <div className="flex gap-3 items-center">
                        {/* Thumbnail Artwork */}
                        <div className="relative w-14 h-20 rounded-[4px] overflow-hidden bg-zinc-800 flex-shrink-0 shadow">
                          <img
                            src={getPosterUrl(item.poster_path || item.backdrop_path, 'w185')}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform"
                            loading="lazy"
                          />
                        </div>

                        {/* Title, Year & Specific Role */}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                            {year && <span>{year}</span>}
                            {item.vote_average > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-400 font-bold">
                                  ★ {item.vote_average.toFixed(1)}
                                </span>
                              </>
                            )}
                          </div>

                          <h3 className="text-sm font-bold text-white group-hover/card:text-zinc-200 transition truncate">
                            {item.title}
                          </h3>

                          {/* Anti-slop Role Typography: pure text, zero border/pill */}
                          <p className="text-xs text-zinc-400 font-normal truncate" title={roleText}>
                            {roleText}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. COMPLETE FILMOGRAPHY & EXPLORER WITH ROLE CARDS       */}
          {/* ======================================================== */}
          <div className="w-full max-w-7xl mx-auto px-4 md:px-12 pt-8 space-y-6">
            {/* Filter and Tab Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
              {/* Department Tabs: All / Acting / Directing & Crew */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3.5 py-1.5 rounded-[4px] text-xs font-bold transition cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-white text-black shadow'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  All Works ({castCredits.length + crewCredits.length})
                </button>

                {castCredits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('acting')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-bold transition cursor-pointer ${
                      activeTab === 'acting'
                        ? 'bg-white text-black shadow'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Acting ({castCredits.length})</span>
                  </button>
                )}

                {crewCredits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('crew')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-bold transition cursor-pointer ${
                      activeTab === 'crew'
                        ? 'bg-white text-black shadow'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    <Clapperboard className="w-3.5 h-3.5" />
                    <span>Directing & Crew ({crewCredits.length})</span>
                  </button>
                )}
              </div>

              {/* Media Type & Sort Filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Media Type Filter */}
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-[4px] p-0.5">
                  <button
                    type="button"
                    onClick={() => setMediaFilter('all')}
                    className={`px-2.5 py-1 rounded-[3px] font-semibold transition cursor-pointer ${
                      mediaFilter === 'all' ? 'bg-zinc-750 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaFilter('movie')}
                    className={`px-2.5 py-1 rounded-[3px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                      mediaFilter === 'movie' ? 'bg-zinc-750 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Film className="w-3 h-3" />
                    <span>Movies</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaFilter('tv')}
                    className={`px-2.5 py-1 rounded-[3px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                      mediaFilter === 'tv' ? 'bg-zinc-750 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Tv className="w-3 h-3" />
                    <span>Shows</span>
                  </button>
                </div>

                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-[4px] px-3 py-1.5 font-semibold focus:outline-none focus:border-zinc-600 cursor-pointer"
                >
                  <option value="popularity">Most Acclaimed</option>
                  <option value="year_desc">Newest First</option>
                  <option value="year_asc">Oldest First</option>
                </select>
              </div>
            </div>

            {/* Filmography Cards Grid using NetflixTallCard with role variant */}
            {displayedCredits.length === 0 ? (
              <div className="text-center py-20 text-zinc-400 text-sm">
                No titles matching the selected filters.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
                {displayedCredits.map((item) => {
                  const roleText = item.character
                    ? `as ${item.character}`
                    : item.job || (item.media_type === 'tv' ? 'Series' : 'Featured');

                  return (
                    <NetflixTallCard
                      key={`credit-${item.id}-${item.credit_id || item.character || item.job}`}
                      item={item}
                      role={roleText}
                      imageType="poster"
                      className="w-full"
                      onSelect={handleOpenItem}
                      onPlay={handlePlayMedia}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}

      {/* Direct In-Place Video Player Modal */}
      {playerItem && (
        <VideoPlayerModal
          mediaId={playerItem.mediaId}
          mediaType={playerItem.mediaType}
          title={playerItem.title}
          onClose={() => setPlayerItem(null)}
        />
      )}
    </div>
  );
};


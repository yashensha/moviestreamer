import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { Episode } from '../types/movie';
import {
  savePlaybackTime,
  getSavedPlaybackTime,
  syncPlaybackToDbOnExit,
} from '../services/playbackStorage';

export interface VideoPlayerModalProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title?: string;
  season?: number;
  episode?: number;
  totalSeasons?: number;
  episodes?: Episode[];
  onEpisodeChange?: (newSeason: number, newEpisode: number) => void;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  mediaId,
  mediaType,
  title,
  season = 1,
  episode = 1,
  totalSeasons = 1,
  episodes = [],
  onEpisodeChange,
  onClose,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentSeason, setCurrentSeason] = useState(season);
  const [currentEpisode, setCurrentEpisode] = useState(episode);

  const activeEpisodeRef = useRef({ season: currentSeason, episode: currentEpisode });
  const isSwitchingEpisodeRef = useRef(false);

  // Sync state if props change
  useEffect(() => {
    if (season !== currentSeason) setCurrentSeason(season);
  }, [season]);

  useEffect(() => {
    if (episode !== currentEpisode) setCurrentEpisode(episode);
  }, [episode]);

  useEffect(() => {
    activeEpisodeRef.current = { season: currentSeason, episode: currentEpisode };
  }, [currentSeason, currentEpisode]);

  // Initial playback position lookup strictly for this season & episode
  const initialSaved = useMemo(() => {
    return getSavedPlaybackTime(mediaId, mediaType, currentSeason, currentEpisode);
  }, [mediaId, mediaType, currentSeason, currentEpisode]);

  const playFromSeconds = initialSaved && initialSaved.seconds > 5 ? Math.floor(initialSaved.seconds) : 0;

  const currentPositionRef = useRef<number>(playFromSeconds);
  const durationRef = useRef<number | undefined>(initialSaved?.duration);

  // Synchronize position and duration refs whenever active episode or saved progress changes
  useEffect(() => {
    currentPositionRef.current = playFromSeconds;
    durationRef.current = initialSaved?.duration;
  }, [currentSeason, currentEpisode, playFromSeconds, initialSaved]);

  // Build stream URL with official Vidbolt autoPlay and startAt parameters.
  // CRITICAL: Always explicitly specify startAt (0 if unwatched or new episode) so Vidbolt cannot resume previous episode's timestamp!
  const streamUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('autoPlay', 'true');
    const startSec = playFromSeconds > 5 ? playFromSeconds : 0;
    params.set('startAt', String(startSec));
    params.set('playfrom', String(startSec));
    const query = params.toString();
    return mediaType === 'tv'
      ? `https://vidbolt.xyz/tv/${mediaId}/${currentSeason}/${currentEpisode}?${query}`
      : `https://vidbolt.xyz/movie/${mediaId}?${query}`;
  }, [mediaId, mediaType, currentSeason, currentEpisode, playFromSeconds]);

  // Seek handshake for continuing playback once ready - explicitly seeks to target position (or 0 for new episode)
  const sendHandshake = () => {
    try {
      const targetTime = playFromSeconds > 5 ? playFromSeconds : 0;
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'seek', time: targetTime },
        '*'
      );
    } catch {}
  };

  // Set or remove playfrom attribute directly on the DOM iframe element
  useEffect(() => {
    if (iframeRef.current) {
      const targetTime = playFromSeconds > 5 ? playFromSeconds : 0;
      try {
        iframeRef.current.setAttribute('playfrom', String(targetTime));
        iframeRef.current.setAttribute('data-playfrom', String(targetTime));
      } catch {}
    }
  }, [playFromSeconds, streamUrl]);

  // Exit saving handler
  const handleExit = () => {
    if (currentPositionRef.current > 5) {
      savePlaybackTime(
        mediaId,
        mediaType,
        currentPositionRef.current,
        durationRef.current,
        activeEpisodeRef.current.season,
        activeEpisodeRef.current.episode,
        true
      );
    }
    syncPlaybackToDbOnExit();
    onClose();
  };

  // Switch episode & update URL without refresh
  const changeEpisode = (s: number, e: number) => {
    // 1. Save progress of the episode we are leaving with its exact season and episode
    const oldSeason = activeEpisodeRef.current.season;
    const oldEpisode = activeEpisodeRef.current.episode;
    if (currentPositionRef.current > 5) {
      savePlaybackTime(
        mediaId,
        mediaType,
        currentPositionRef.current,
        durationRef.current,
        oldSeason,
        oldEpisode,
        true
      );
    }

    // 2. Lock transition so lingering postMessages from previous episode do not pollute new episode
    isSwitchingEpisodeRef.current = true;

    // 3. Strictly lookup saved progress for the target episode
    const nextSaved = getSavedPlaybackTime(mediaId, 'tv', s, e);
    const newPlayFrom = nextSaved && nextSaved.seconds > 5 ? Math.floor(nextSaved.seconds) : 0;

    activeEpisodeRef.current = { season: s, episode: e };
    currentPositionRef.current = newPlayFrom;
    durationRef.current = nextSaved?.duration;

    if (iframeRef.current) {
      try {
        iframeRef.current.setAttribute('playfrom', String(newPlayFrom));
        iframeRef.current.setAttribute('data-playfrom', String(newPlayFrom));
      } catch {}
    }

    setCurrentSeason(s);
    setCurrentEpisode(e);

    // Trigger URL change in parent without reload
    onEpisodeChange?.(s, e);
  };

  const advanceNextEpisode = () => {
    if (mediaType !== 'tv') return;
    const currentIndex = episodes.findIndex((ep) => ep.episode_number === currentEpisode);
    if (currentIndex >= 0 && currentIndex < episodes.length - 1) {
      const nextEp = episodes[currentIndex + 1];
      changeEpisode(currentSeason, nextEp.episode_number);
    } else {
      if (currentSeason < totalSeasons) {
        changeEpisode(currentSeason + 1, 1);
      }
    }
  };

  // Vidbolt postMessage event bridge
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin || !event.origin.includes('vidbolt')) return;
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {}
      }
      if (!data) return;

      // 1. Detect internal episode changer from player FIRST before any time updates
      const nextS =
        typeof data.season === 'number'
          ? data.season
          : typeof data.data?.season === 'number'
          ? data.data.season
          : typeof data.s === 'number'
          ? data.s
          : typeof data.data?.s === 'number'
          ? data.data.s
          : null;
      const nextE =
        typeof data.episode === 'number'
          ? data.episode
          : typeof data.data?.episode === 'number'
          ? data.data.episode
          : typeof data.e === 'number'
          ? data.e
          : typeof data.data?.e === 'number'
          ? data.data.e
          : null;

      let urlS: number | null = null;
      let urlE: number | null = null;
      const urlCandidate =
        typeof data.url === 'string'
          ? data.url
          : typeof data.path === 'string'
          ? data.path
          : typeof data.href === 'string'
          ? data.href
          : typeof data.data?.url === 'string'
          ? data.data.url
          : null;
      if (urlCandidate) {
        const tvMatch = urlCandidate.match(/\/tv\/\d+\/(\d+)\/(\d+)/i);
        if (tvMatch) {
          urlS = parseInt(tvMatch[1], 10);
          urlE = parseInt(tvMatch[2], 10);
        }
      }

      const finalNextS = nextS || urlS;
      const finalNextE = nextE || urlE;

      if (finalNextS && finalNextE && (finalNextS !== currentSeason || finalNextE !== currentEpisode)) {
        changeEpisode(finalNextS, finalNextE);
        return;
      }

      // 2. When player is ready, trigger play and perform seek handshake
      if (data.type === 'ready' || data.event === 'ready' || data === 'ready') {
        isSwitchingEpisodeRef.current = false;
        try {
          iframeRef.current?.contentWindow?.postMessage({ type: 'play' }, '*');
        } catch {}
        sendHandshake();
      }

      // 3. Time updates for the current episode
      // Strictly ignore time updates while switching episodes to prevent cross-episode time bleed
      if (isSwitchingEpisodeRef.current) return;

      const time =
        typeof data.currentTime === 'number'
          ? data.currentTime
          : typeof data.time === 'number'
          ? data.time
          : typeof data.seconds === 'number'
          ? data.seconds
          : typeof data.position === 'number'
          ? data.position
          : typeof data.data?.currentTime === 'number'
          ? data.data.currentTime
          : typeof data.data?.time === 'number'
          ? data.data.time
          : null;

      const duration =
        typeof data.duration === 'number'
          ? data.duration
          : typeof data.data?.duration === 'number'
          ? data.data.duration
          : undefined;

      if (typeof time === 'number' && time >= 0) {
        currentPositionRef.current = Math.floor(time);
        if (duration) durationRef.current = Math.floor(duration);

        if (currentPositionRef.current > 5) {
          savePlaybackTime(
            mediaId,
            mediaType,
            currentPositionRef.current,
            durationRef.current,
            activeEpisodeRef.current.season,
            activeEpisodeRef.current.episode
          );
        }
      }

      // 4. Next episode / ended
      if (
        data.type === 'next_episode' ||
        data.type === 'next' ||
        data.type === 'ended' ||
        data.event === 'ended'
      ) {
        advanceNextEpisode();
      }

      // 5. Back / close event from Vidbolt native player UI
      if (
        data.type === 'back' ||
        data.event === 'back' ||
        data.type === 'close' ||
        data.event === 'close'
      ) {
        handleExit();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mediaId, mediaType, currentSeason, currentEpisode, episodes, totalSeasons, playFromSeconds]);

  // Support Escape key to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSeason, currentEpisode]);

  return (
    <div
      onClick={(e) => {
        // Exit when user clicks on outside modal
        if (e.target === e.currentTarget) {
          handleExit();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-8 bg-black/85 backdrop-blur-md animate-fadeIn select-none cursor-pointer"
    >
      {/* 16:9 Pure Iframe Container - SHARP EDGES (rounded-none), NO CLOSE BUTTON */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-6xl aspect-video bg-black rounded-none overflow-hidden shadow-2xl border border-zinc-800 cursor-default"
      >
        <iframe
          key={`vidbolt-${mediaId}-${mediaType}-${currentSeason}-${currentEpisode}`}
          ref={iframeRef}
          id="vidbolt-player"
          src={streamUrl}
          data-playfrom={playFromSeconds > 5 ? playFromSeconds : 0}
          width="100%"
          height="100%"
          className="w-full h-full border-0 bg-black rounded-none"
          allowFullScreen
          allow="autoplay *; fullscreen *; encrypted-media *; picture-in-picture *"
          title={title || 'Video Player'}
          onLoad={() => {
            isSwitchingEpisodeRef.current = false;
            setTimeout(sendHandshake, 600);
          }}
        />
      </div>
    </div>
  );
};

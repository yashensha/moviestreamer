import React, { useState, useEffect } from 'react';
import type { StreamItem } from '../types/movie';
import { X, Copy, Check, ExternalLink, Star, Calendar, Tv, Film } from 'lucide-react';

interface VideoPlayerModalProps {
  item: StreamItem | null;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ item, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);

  useEffect(() => {
    if (item?.season) setSeason(item.season);
    if (item?.episode) setEpisode(item.episode);
  }, [item]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  // Build stream URL according to Vidbolt documentation
  const streamUrl =
    item.type === 'tv'
      ? `https://vidbolt.xyz/tv/${item.tmdbId}/${season}/${episode}`
      : `https://vidbolt.xyz/movie/${item.tmdbId}`;

  const iframeSnippet = `<iframe
  id="vidbolt-player"
  src="${streamUrl}"
  width="100%"
  height="100%"
  frameborder="0"
  allowfullscreen
  allow="autoplay; encrypted-media; picture-in-picture"
></iframe>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(iframeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-[#0e111a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-800 bg-[#121520]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {item.type === 'tv' ? <Tv className="w-4 h-4" /> : <Film className="w-4 h-4" />}
            </span>
            <div className="truncate">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {item.title || `TMDB #${item.tmdbId}`}
              </h2>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span>TMDB ID: <span className="font-mono text-zinc-300">{item.tmdbId}</span></span>
                {item.type === 'tv' && (
                  <span className="text-amber-400 font-medium">S{season} E{episode}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium transition cursor-pointer"
              title="Copy embed iframe snippet"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied Iframe!' : 'Copy Embed'}</span>
            </button>

            <a
              href={streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition"
              title="Open stream in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-rose-600 text-zinc-400 hover:text-white border border-zinc-700 transition cursor-pointer"
              title="Close Player (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TV Season/Episode selector if applicable */}
        {item.type === 'tv' && (
          <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-2.5 bg-zinc-900/90 border-b border-zinc-800 text-xs text-zinc-300">
            <span className="text-zinc-400 font-medium">Episode Controls:</span>
            <div className="flex items-center gap-1.5">
              <label htmlFor="season-input" className="text-zinc-400">Season:</label>
              <input
                id="season-input"
                type="number"
                min="1"
                value={season}
                onChange={(e) => setSeason(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-white text-center text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label htmlFor="episode-input" className="text-zinc-400">Episode:</label>
              <input
                id="episode-input"
                type="number"
                min="1"
                value={episode}
                onChange={(e) => setEpisode(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-white text-center text-xs"
              />
            </div>
          </div>
        )}

        {/* The Vidbolt Iframe Player */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center">
          <iframe
            id="vidbolt-player"
            src={streamUrl}
            width="100%"
            height="100%"
            className="w-full h-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            title={item.title || 'Vidbolt Video Player'}
          />
        </div>

        {/* Player Details & Embed Information */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 bg-[#0d0f17]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              {item.release_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {item.release_date}
                </span>
              )}
              {item.vote_average !== undefined && item.vote_average > 0 && (
                <span className="flex items-center gap-1 text-amber-400 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  <Star className="w-3 h-3 fill-amber-400" />
                  {item.vote_average.toFixed(1)} TMDB
                </span>
              )}
              <span className="text-[11px] font-mono text-zinc-500">Vidbolt Embed Active</span>
            </div>

            <span className="text-xs font-mono text-zinc-400 truncate max-w-full sm:max-w-md bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800">
              {streamUrl}
            </span>
          </div>

          {item.overview && (
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {item.overview}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

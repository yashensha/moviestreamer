import React, { useState } from 'react';
import type { StreamItem } from '../types/movie';
import { X, Play, Copy, Check, Tv, Film } from 'lucide-react';

interface QuickStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStream: (item: StreamItem) => void;
}

export const QuickStreamModal: React.FC<QuickStreamModalProps> = ({
  isOpen,
  onClose,
  onStream,
}) => {
  const [type, setType] = useState<'movie' | 'tv'>('movie');
  const [tmdbId, setTmdbId] = useState('1007757');
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentStreamUrl =
    type === 'tv'
      ? `https://vidbolt.xyz/tv/${tmdbId.trim() || '{tmdb_id}'}/${season}/${episode}`
      : `https://vidbolt.xyz/movie/${tmdbId.trim() || '{tmdb_id}'}`;

  const iframeCode = `<iframe
  id="vidbolt-player"
  src="${currentStreamUrl}"
  width="100%"
  height="100%"
  frameborder="0"
  allowfullscreen
  allow="autoplay; encrypted-media; picture-in-picture"
></iframe>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartStream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tmdbId.trim()) return;

    onStream({
      type,
      tmdbId: tmdbId.trim(),
      season: type === 'tv' ? season : undefined,
      episode: type === 'tv' ? episode : undefined,
      title: `${type === 'movie' ? 'Movie' : 'TV Show'} (TMDB #${tmdbId.trim()})`,
    });
    onClose();
  };

  const presets = [
    { label: 'Parthenope', id: '1007757', type: 'movie' as const },
    { label: 'Dune: Part Two', id: '693134', type: 'movie' as const },
    { label: 'Deadpool & Wolverine', id: '533535', type: 'movie' as const },
    { label: 'Oppenheimer', id: '872585', type: 'movie' as const },
    { label: 'Stranger Things', id: '66732', type: 'tv' as const },
    { label: 'Breaking Bad', id: '1396', type: 'tv' as const },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#111420] border border-zinc-800 rounded-2xl shadow-2xl p-6 text-zinc-200">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div>
            <h3 className="text-lg font-bold text-white">Stream Any Title</h3>
            <p className="text-xs text-zinc-400">Play directly by ID</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleStartStream} className="space-y-4 pt-4">
          {/* Stream Type Tabs */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Stream Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('movie')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  type === 'movie'
                    ? 'bg-rose-600/20 text-rose-400 border-rose-500/40'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                <Film className="w-4 h-4" /> Movie
              </button>
              <button
                type="button"
                onClick={() => setType('tv')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  type === 'tv'
                    ? 'bg-rose-600/20 text-rose-400 border-rose-500/40'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                <Tv className="w-4 h-4" /> TV Show
              </button>
            </div>
          </div>

          {/* Title ID input */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              {type === 'movie' ? 'Movie' : 'Show'} ID
            </label>
            <input
              type="text"
              value={tmdbId}
              onChange={(e) => setTmdbId(e.target.value)}
              placeholder="e.g. 1007757"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-rose-500 transition"
            />
          </div>

          {/* TV Season & Episode */}
          {type === 'tv' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Season</label>
                <input
                  type="number"
                  min="1"
                  value={season}
                  onChange={(e) => setSeason(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Episode</label>
                <input
                  type="number"
                  min="1"
                  value={episode}
                  onChange={(e) => setEpisode(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {/* Presets */}
          <div>
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-2">
              Quick Examples
            </span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setType(preset.type);
                    setTmdbId(preset.id);
                  }}
                  className="text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg border border-zinc-800 transition cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Embed Preview */}
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-850 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-400">Embed URL:</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied Iframe!' : 'Copy Iframe'}
              </button>
            </div>
            <p className="text-xs font-mono text-amber-400/90 break-all bg-black/40 p-2 rounded border border-zinc-800/60">
              {currentStreamUrl}
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs shadow-lg transition cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              Stream Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

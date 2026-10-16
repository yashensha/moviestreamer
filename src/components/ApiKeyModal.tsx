import React, { useState } from 'react';
import { X, Key, ExternalLink, Trash2, CheckCircle2 } from 'lucide-react';
import { getStoredTmdbKey, setStoredTmdbKey } from '../services/tmdb';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdated: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeyUpdated,
}) => {
  const [apiKey, setApiKey] = useState(getStoredTmdbKey());
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredTmdbKey(apiKey);
    setSaved(true);
    onKeyUpdated();
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  const handleClear = () => {
    setApiKey('');
    setStoredTmdbKey('');
    onKeyUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#111420] border border-zinc-800 rounded-2xl shadow-2xl p-6 text-zinc-200">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">TMDB API Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 pt-4">
          <p className="text-xs text-zinc-300 leading-relaxed">
            Connect your TMDB account to stream from the full live TheMovieDatabase catalog, or leave blank to enjoy the built-in curated library.
          </p>

          <a
            href="https://developer.themoviedb.org/docs/getting-started"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium transition"
          >
            <span>Get your TMDB API Key in developer docs</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              API Key or Read Access Token (v3 / v4)
            </label>
            <textarea
              rows={3}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your TMDB API Key or Bearer Token..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono text-xs focus:outline-none focus:border-rose-500 transition resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {apiKey ? (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-rose-400 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Key
              </button>
            ) : <span />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition cursor-pointer"
              >
                {saved && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                {saved ? 'Saved!' : 'Save & Reload'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

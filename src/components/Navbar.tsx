import React from 'react';
import { Film, PlaySquare, Key, Sparkles } from 'lucide-react';

interface NavbarProps {
  onOpenQuickStream: () => void;
  onOpenApiKeyModal: () => void;
  hasApiKey: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenQuickStream,
  onOpenApiKeyModal,
  hasApiKey,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#090b10]/90 backdrop-blur-md border-b border-zinc-800/80 px-4 md:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-600 to-violet-600 flex items-center justify-center shadow-lg shadow-rose-900/20">
          <Film className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg md:text-xl text-white tracking-tight">MovieWatcher</span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              Vidbolt Stream
            </span>
          </div>
          <p className="text-xs text-zinc-400 hidden sm:block">TMDB Catalog & Instant Streaming</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenQuickStream}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 text-sm font-medium transition cursor-pointer"
          title="Stream any movie or TV show by TMDB ID"
        >
          <PlaySquare className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Stream by ID</span>
          <span className="sm:hidden">ID Stream</span>
        </button>

        <button
          onClick={onOpenApiKeyModal}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition cursor-pointer ${
            hasApiKey
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/50'
              : 'bg-zinc-800/90 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white'
          }`}
          title="Configure TMDB API Key"
        >
          <Key className="w-4 h-4" />
          <span className="hidden md:inline">
            {hasApiKey ? 'TMDB Connected' : 'TMDB API Key'}
          </span>
          {hasApiKey && <Sparkles className="w-3.5 h-3.5 text-emerald-400 hidden sm:inline" />}
        </button>
      </div>
    </header>
  );
};

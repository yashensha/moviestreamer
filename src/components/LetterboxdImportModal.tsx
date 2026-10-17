import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Star,
  Sparkles,
  ArrowRight,
  Film
} from 'lucide-react';
import {
  parseLetterboxdCSV,
  batchResolveLetterboxd,
  type BatchImportProgress,
  type BatchImportResult
} from '../services/letterboxd';
import type { LetterboxdRawEntry } from '../types/movie';
import { useStreamStore } from '../store/useStreamStore';

interface LetterboxdImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (result: BatchImportResult) => void;
  initialFile?: File | null;
}

export const LetterboxdImportModal: React.FC<LetterboxdImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  initialFile,
}) => {
  const bulkAddRatings = useStreamStore((state) => state.bulkAddRatings);

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedEntries, setParsedEntries] = useState<LetterboxdRawEntry[]>([]);
  const [detectedType, setDetectedType] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Resolution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchImportProgress | null>(null);
  const [importResult, setImportResult] = useState<BatchImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialFile && isOpen) {
      processFile(initialFile);
    }
  }, [initialFile, isOpen]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please upload a Letterboxd export CSV file (e.g. ratings.csv, watched.csv, or watchlist.csv).');
      return;
    }

    try {
      setError(null);
      setFile(selectedFile);
      const text = await selectedFile.text();
      const { type, entries } = parseLetterboxdCSV(text);

      if (entries.length === 0) {
        setError('No valid movie entries found in this CSV. Please verify it is a Letterboxd export.');
        return;
      }

      setParsedEntries(entries);
      setDetectedType(type);
    } catch (err: any) {
      setError(err?.message || 'Failed to read CSV file.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleStartImport = async () => {
    if (parsedEntries.length === 0) return;
    setIsProcessing(true);
    setError(null);

    try {
      const result = await batchResolveLetterboxd(parsedEntries, (p) => {
        setProgress({ ...p });
      });

      // Save into Zustand store & Cloudflare D1 / dev database
      bulkAddRatings(result.ratings, true);

      setImportResult(result);
      if (onImportComplete) {
        onImportComplete(result);
      }
    } catch (err: any) {
      setError(err?.message || 'Error occurred while resolving titles with TMDB.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedEntries([]);
    setDetectedType('');
    setError(null);
    setProgress(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 !== 0;

    return (
      <span className="flex items-center text-[#00E054] text-xs font-semibold gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={i} className="w-3 h-3 fill-[#00E054] text-[#00E054]" />
        ))}
        {hasHalf && <span className="text-[10px] ml-0.5 font-bold">½</span>}
        <span className="text-zinc-400 text-[11px] ml-1">({rating}★)</span>
      </span>
    );
  };

  const progressPercent = progress
    ? Math.round((progress.processed / Math.max(progress.total, 1)) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#181818] border border-zinc-800 w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden text-zinc-100">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#141414]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-[#00E054]/15 border border-[#00E054]/40 flex items-center justify-center text-[#00E054]">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-wide">
                  Letterboxd Taste Matrix Importer
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wider bg-[#00E054]/20 text-[#00E054] border border-[#00E054]/30">
                  Step 1
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Instantly map your Letterboxd ratings & watched history to TMDB IDs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* State 1: Success Complete Screen */}
          {importResult ? (
            <div className="space-y-6 py-2 text-center">
              <div className="w-16 h-16 bg-[#00E054]/15 border border-[#00E054]/50 rounded-none mx-auto flex items-center justify-center text-[#00E054] shadow-lg shadow-[#00E054]/10">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <h4 className="text-xl font-bold text-white">Import Complete!</h4>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                  Your Letterboxd taste data has been mapped with TMDB identifiers and saved to your profile and taste matrix.
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 text-left">
                <div className="bg-zinc-900 border border-zinc-800 p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">Total Matched</span>
                  <div className="text-xl font-black text-white">
                    {importResult.ratings.length}
                  </div>
                  <span className="text-[11px] text-[#00E054]">Added to Watched</span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">Taste Seeds</span>
                  <div className="text-xl font-black text-rose-500">
                    {importResult.ratings.filter((r) => r.confidenceWeight >= 4.0).length}
                  </div>
                  <span className="text-[11px] text-zinc-400">4★+ Favorites</span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">TMDB Mapped</span>
                  <div className="text-xl font-black text-emerald-400">
                    {Math.round((importResult.ratings.length / Math.max(importResult.totalParsed, 1)) * 100)}%
                  </div>
                  <span className="text-[11px] text-zinc-400">Precision Match</span>
                </div>
              </div>

              {/* Unmatched Titles Note if any */}
              {importResult.unmatchedTitles.length > 0 && (
                <div className="bg-zinc-900/60 border border-zinc-800 p-3 text-left text-xs text-zinc-400 space-y-1.5">
                  <div className="font-semibold text-zinc-300">
                    {importResult.unmatchedTitles.length} titles could not be matched on TMDB:
                  </div>
                  <div className="text-[11px] text-zinc-500 max-h-20 overflow-y-auto space-y-0.5 font-mono">
                    {importResult.unmatchedTitles.slice(0, 10).map((t, i) => (
                      <div key={i}>• {t}</div>
                    ))}
                    {importResult.unmatchedTitles.length > 10 && (
                      <div>...and {importResult.unmatchedTitles.length - 10} more</div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-[#E50914] hover:bg-[#c90812] text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  View in My Profile
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
                >
                  Import Another File
                </button>
              </div>
            </div>
          ) : isProcessing ? (
            /* State 2: Processing / Mapping Screen */
            <div className="space-y-6 py-6 text-center">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-[#00E054] animate-spin" />
                <Sparkles className="w-5 h-5 text-white absolute" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-white">
                  Mapping Letterboxd Titles to TMDB IDs...
                </h4>
                <p className="text-xs text-zinc-400">
                  Querying TMDB movie database with in-memory caching and generating recommendation weights.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 max-w-md mx-auto">
                <div className="h-2.5 w-full bg-zinc-900 border border-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-[#00E054] transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span className="truncate max-w-[240px] text-zinc-300 font-mono text-[11px]">
                    {progress?.currentTitle ? `“${progress.currentTitle}”` : 'Resolving titles...'}
                  </span>
                  <span className="font-bold text-[#00E054] font-mono">
                    {progress?.processed || 0} / {progress?.total || parsedEntries.length} ({progressPercent}%)
                  </span>
                </div>
              </div>
            </div>
          ) : parsedEntries.length > 0 ? (
            /* State 3: File Parsed Preview Screen */
            <div className="space-y-5">
              <div className="bg-zinc-900 border border-zinc-800 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-[#00E054]" />
                  <div>
                    <h4 className="text-sm font-bold text-white">{file?.name}</h4>
                    <p className="text-xs text-zinc-400">
                      Detected as <strong className="text-white uppercase">{detectedType}</strong> export •{' '}
                      <span className="text-[#00E054] font-semibold">{parsedEntries.length} films ready</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                >
                  Change file
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Preview ({Math.min(parsedEntries.length, 5)} of {parsedEntries.length})</span>
                  <span className="text-[11px] text-zinc-500 font-normal">Title • Year • Rating</span>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 divide-y divide-zinc-900 max-h-48 overflow-y-auto">
                  {parsedEntries.slice(0, 10).map((entry, idx) => (
                    <div key={idx} className="p-2.5 text-xs flex items-center justify-between">
                      <div className="truncate pr-4">
                        <span className="font-semibold text-white">{entry.title}</span>
                        {entry.year && <span className="text-zinc-500 ml-1.5">({entry.year})</span>}
                      </div>
                      <div className="flex-shrink-0">
                        {entry.rating ? (
                          renderStars(entry.rating)
                        ) : (
                          <span className="text-[10px] text-zinc-500 uppercase font-semibold">Watched</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800/80 p-3 text-xs text-zinc-400 space-y-1">
                <span className="font-semibold text-zinc-300">How this seeds your taste matrix:</span>
                <ul className="list-disc list-inside space-y-0.5 text-zinc-400 text-[11px]">
                  <li>All matched films are added to your Profile's <strong>Watched Titles</strong> list.</li>
                  <li>Films rated <strong>4★ and above</strong> are automatically added to your <strong>Favorites</strong>.</li>
                  <li>Confidence weights (0.5 to 5.0) are calculated to train hybrid recommendations.</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartImport}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#00E054] hover:bg-[#00c046] text-black font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-[#00E054]/20"
                >
                  <span>Start TMDB Identifier Mapping</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* State 4: Drag & Drop Upload Zone */
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed p-8 md:p-12 text-center transition cursor-pointer flex flex-col items-center justify-center space-y-4 ${
                  dragActive
                    ? 'border-[#00E054] bg-[#00E054]/5'
                    : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white">
                  <UploadCloud className="w-7 h-7 text-[#00E054]" />
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">
                    Drop your Letterboxd export CSV here or click to browse
                  </p>
                  <p className="text-xs text-zinc-500">
                    Supports <span className="text-zinc-300 font-mono">ratings.csv</span>,{' '}
                    <span className="text-zinc-300 font-mono">watched.csv</span>, or{' '}
                    <span className="text-zinc-300 font-mono">watchlist.csv</span>
                  </p>
                </div>

                <div className="text-[11px] text-zinc-400 bg-zinc-900/80 border border-zinc-800 px-3 py-1 font-mono">
                  Export from: Letterboxd &gt; Settings &gt; Data &gt; Export Your Data
                </div>
              </div>

              {/* Informational feature box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-zinc-400 pt-2">
                <div className="bg-zinc-900/50 border border-zinc-800/80 p-3 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#00E054]" />
                    <span>Zero Cold-Start</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Eliminates the empty-profile state. Recommendations immediately know your exact taste from day one.
                  </p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800/80 p-3 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>TMDB Canonical IDs</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Maps your Letterboxd titles to verified TMDB movies with posters, genres, and metadata automatically.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

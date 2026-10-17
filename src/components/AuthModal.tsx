import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalMode,
    isLoading,
    error,
    closeAuthModal,
    openLoginModal,
    openRegisterModal,
    login,
    register,
    clearError,
  } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  // Reset form when modal opens or mode changes
  useEffect(() => {
    if (isAuthModalOpen) {
      clearError();
    }
  }, [isAuthModalOpen, authModalMode, clearError]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (authModalMode === 'login') {
      await login(email, password);
    } else {
      await register(email, password, name);
    }
  };

  const isLogin = authModalMode === 'login';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity"
        onClick={closeAuthModal}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-[#161616] border border-zinc-800 shadow-2xl p-6 sm:p-8 z-10 text-white animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 transition cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="mb-6">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xl font-black tracking-tighter text-[#E50914]">
              MOVIE<span className="text-white ml-0.5">WATCHER</span>
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {isLogin ? 'Sign In' : 'Create an Account'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {isLogin
              ? 'Access your saved history, likes, and tailored recommendations across any device.'
              : 'Sign up to sync your preferences and unlock personalized movie picks.'}
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-5 p-3 bg-red-950/70 border border-red-800/80 rounded-none flex items-start gap-2.5 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Your Name <span className="text-zinc-500">(Optional)</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full bg-zinc-900/90 border border-zinc-700 focus:border-white focus:outline-none pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-zinc-900/90 border border-zinc-700 focus:border-white focus:outline-none pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-zinc-900/90 border border-zinc-700 focus:border-white focus:outline-none pl-9 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition p-0.5 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 bg-[#E50914] hover:bg-[#c90812] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-sm text-white tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-900/30"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isLogin ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <span>{isLogin ? 'Sign In' : 'Create Free Account'}</span>
            )}
          </button>
        </form>

        {/* Footer Toggle */}
        <div className="mt-6 pt-5 border-t border-zinc-800/80 text-xs text-zinc-400 flex items-center justify-between">
          {isLogin ? (
            <div>
              <span>New to MovieWatcher? </span>
              <button
                type="button"
                onClick={openRegisterModal}
                className="text-white hover:underline font-semibold cursor-pointer ml-1"
              >
                Sign up now.
              </button>
            </div>
          ) : (
            <div>
              <span>Already have an account? </span>
              <button
                type="button"
                onClick={openLoginModal}
                className="text-white hover:underline font-semibold cursor-pointer ml-1"
              >
                Sign in.
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

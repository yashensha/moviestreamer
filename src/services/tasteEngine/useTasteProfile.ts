import { useMemo } from 'react';
import { useStreamStore } from '../../store/useStreamStore';
import { buildUserTasteProfile } from './tasteProfile';
import type { UserTasteProfile } from './types';

/**
 * React Hook providing the reactive UserTasteProfile
 */
export function useUserTasteProfile(): UserTasteProfile {
  const watchHistory = useStreamStore((s) => s.watchHistory);
  const likedMedia = useStreamStore((s) => s.likedMedia);
  const userRatings = useStreamStore((s) => s.userRatings);
  const dislikedMedia = useStreamStore((s) => s.dislikedMedia);
  const watchlist = useStreamStore((s) => s.watchlist);

  return useMemo(() => {
    return buildUserTasteProfile(
      watchHistory,
      likedMedia,
      userRatings,
      dislikedMedia,
      watchlist
    );
  }, [watchHistory, likedMedia, userRatings, dislikedMedia, watchlist]);
}

/**
 * Non-hook getter for active user taste profile
 */
export function getActiveTasteProfile(): UserTasteProfile {
  const state = useStreamStore.getState();
  return buildUserTasteProfile(
    state.watchHistory,
    state.likedMedia,
    state.userRatings,
    state.dislikedMedia,
    state.watchlist
  );
}

import { useMemo, useState, useEffect } from 'react';
import { useStreamStore } from '../../store/useStreamStore';
import { buildUserTasteProfile } from './tasteProfile';
import { onGenomeDatasetLoaded } from './genome';
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

  // Re-trigger profile computation as soon as themes & microgenres datasets finish loading
  const [datasetVersion, setDatasetVersion] = useState(0);
  useEffect(() => {
    return onGenomeDatasetLoaded(() => {
      setDatasetVersion((v) => v + 1);
    });
  }, []);

  return useMemo(() => {
    return buildUserTasteProfile(
      watchHistory,
      likedMedia,
      userRatings,
      dislikedMedia,
      watchlist
    );
  }, [watchHistory, likedMedia, userRatings, dislikedMedia, watchlist, datasetVersion]);
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

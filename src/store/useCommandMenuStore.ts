import { create } from 'zustand';

interface CommandMenuState {
  isOpen: boolean;
  initialQuery?: string;
  open: (initialQuery?: string) => void;
  close: () => void;
  toggle: () => void;
}

export const useCommandMenuStore = create<CommandMenuState>((set) => ({
  isOpen: false,
  initialQuery: '',
  open: (initialQuery = '') => set({ isOpen: true, initialQuery }),
  close: () => set({ isOpen: false, initialQuery: '' }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));


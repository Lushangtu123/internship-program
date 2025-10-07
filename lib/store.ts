import { create } from 'zustand';

interface UIState {
  isMuted: boolean;
  showCaptions: boolean;
  activeVideoId: string | null;
  commentsOpen: boolean;
  debugMode: boolean;
  
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
  setShowCaptions: (show: boolean) => void;
  toggleCaptions: () => void;
  setActiveVideoId: (id: string | null) => void;
  setCommentsOpen: (open: boolean) => void;
  toggleComments: () => void;
  setDebugMode: (debug: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isMuted: false,
  showCaptions: false,
  activeVideoId: null,
  commentsOpen: false,
  debugMode: false,

  setMuted: (muted) => set({ isMuted: muted }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setShowCaptions: (show) => set({ showCaptions: show }),
  toggleCaptions: () => set((state) => ({ showCaptions: !state.showCaptions })),
  setActiveVideoId: (id) => set({ activeVideoId: id }),
  setCommentsOpen: (open) => set({ commentsOpen: open }),
  toggleComments: () => set((state) => ({ commentsOpen: !state.commentsOpen })),
  setDebugMode: (debug) => set({ debugMode: debug }),
}));


import { create } from 'zustand';

export type SSEConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'closed';

interface SSEState {
  connectionState: SSEConnectionState;
  setConnectionState: (s: SSEConnectionState) => void;
}

export const useSSEStore = create<SSEState>((set) => ({
  connectionState: 'connecting',
  setConnectionState: (s) => set({ connectionState: s }),
}));

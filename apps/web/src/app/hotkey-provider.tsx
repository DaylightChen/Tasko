import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

// No-op stub. Real hotkey wiring lands in task-18.
export function HotkeyProvider({ children }: Props) {
  return <>{children}</>;
}

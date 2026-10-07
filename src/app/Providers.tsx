import type { ReactNode } from 'react';

/** App-wide providers (the dining store is added here). */
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

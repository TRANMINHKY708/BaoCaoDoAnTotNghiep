import { createContext, useContext, useSyncExternalStore } from 'react';
import type { WorkspaceSession } from '../features/auth/session';
import type { Capability } from '../features/auth/accounts';

export const WorkspaceContext = createContext<WorkspaceSession | null>(null);
export function useWorkspace() {
  const session = useContext(WorkspaceContext);
  if (!session) throw new Error('Workspace provider is missing');
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return {
    session,
    ...snapshot,
    hasCapability: (cap: Capability) =>
      snapshot.status === 'connected' &&
      (snapshot.mode === 'accounts'
        ? !!snapshot.capabilities?.includes(cap)
        : cap !== 'users.manage' && snapshot.mode === 'secured' && snapshot.role === 'operator'),
    canWrite:
      snapshot.status === 'connected' &&
      (snapshot.mode === 'accounts'
        ? !!snapshot.capabilities?.includes('customers.write')
        : snapshot.mode === 'secured' && snapshot.role === 'operator'),
  };
}

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};
const getSlot = () => document.getElementById('editor-toolbar-slot');

/**
 * The editor header's toolbar slot element (portal target). Read through
 * useSyncExternalStore so the editor re-renders once the slot is mounted.
 */
export function useToolbarSlot(): HTMLElement | null {
  return useSyncExternalStore(noopSubscribe, getSlot, () => null);
}

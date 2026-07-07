import { useCallback, useSyncExternalStore } from "react";
import type { MindMap, MindMapStore } from "clarity-mind";

/** Subscribe a component to a {@link MindMapStore}; re-renders on every change. */
export function useMindMap(store: MindMapStore): MindMap {
  const subscribe = useCallback(
    (cb: () => void) => store.subscribe(cb),
    [store],
  );
  const getSnapshot = useCallback(() => store.map, [store]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

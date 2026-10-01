import { useCallback, useLayoutEffect, useRef } from "react";

// Returns a function with a permanent identity that always calls the latest closure, so memoized children
// receiving it as a prop are not re-rendered every time the parent's state changes.
export function useStableCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result): (...args: Args) => Result {
  const latest = useRef(callback);
  useLayoutEffect(() => { latest.current = callback; });
  return useCallback((...args: Args) => latest.current(...args), []);
}

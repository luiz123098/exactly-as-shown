import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

// Reload a query whenever its screen comes back into view (e.g. after an admin
// approved something on another device). Skips the first focus, which already loads.
export function useRefetchOnFocus(refetch: () => unknown) {
  const latest = useRef(refetch);
  useEffect(() => {
    latest.current = refetch;
  }, [refetch]);
  const first = useRef(true);
  useFocusEffect(useCallback(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    latest.current();
  }, []));
}

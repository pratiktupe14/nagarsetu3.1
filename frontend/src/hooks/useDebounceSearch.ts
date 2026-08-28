import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for debounced search input.
 * Prevents unnecessary API calls and avoids reset-on-blur behavior.
 *
 * @param initialValue - Initial search query value
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns [inputValue, debouncedValue, setInputValue]
 */
export function useDebounceSearch(
  initialValue: string = '',
  delay: number = 300
): [string, string, (value: string) => void] {
  const [inputValue, setInputValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [inputValue, delay]);

  const setValue = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  return [inputValue, debouncedValue, setValue];
}

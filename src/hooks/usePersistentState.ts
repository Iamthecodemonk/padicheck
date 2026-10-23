import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) as T : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {

      // Storage may be full or blocked; state still works for this session.
    }}, [key, value]);

  return [value, setValue];
}
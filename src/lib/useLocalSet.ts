import { useEffect, useState } from 'react';

export function useLocalSet(key: string): [Set<string>, (id: string) => void] {
  const [value, setValue] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(key);
      return new Set(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify([...value]));
    } catch {
      // Storage can be unavailable in private mode; the UI still works.
    }
  }, [key, value]);

  const toggle = (id: string) => {
    setValue((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return [value, toggle];
}

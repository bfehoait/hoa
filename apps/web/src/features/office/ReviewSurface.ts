import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

// Presentation and draft protection only; every desk retains its server checks.
export const ReviewSurface = createContext<{
  onLockChange: (locked: boolean) => void;
  state: Map<string, unknown>;
  recordId?: string;
  page?: number;
  clearRecord?: () => void;
} | null>(null);
export const useReviewSurface = () => useContext(ReviewSurface);

// Keep the originally inspected version during an inline review. Background
// polling must not silently replace a decision's optimistic concurrency token.
export function useReviewRecord<T extends { id: string }>(
  rows: T[] | undefined,
) {
  const surface = useReviewSurface();
  const candidate = rows?.find((row) => row.id === surface?.recordId);
  const [snapshot, setSnapshot] = useState<T | null>(null);
  if (candidate && !snapshot) setSnapshot(candidate);
  return surface?.recordId ? (snapshot ?? candidate) : undefined;
}

// Only non-sensitive view state lives here, for this inbox mount. No form
// content, roles or approvals are persisted. Other routes use normal state.
export function useReviewState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const surface = useReviewSurface();
  const [value, setValue] = useState<T>(() =>
    surface?.state.has(key)
      ? (surface.state.get(key) as T)
      : typeof initial === "function"
        ? (initial as () => T)()
        : initial,
  );
  const update: Dispatch<SetStateAction<T>> = (next) => {
    setValue((previous) => {
      const result =
        typeof next === "function"
          ? (next as (current: T) => T)(previous)
          : next;
      surface?.state.set(key, result);
      return result;
    });
  };
  return [value, update];
}

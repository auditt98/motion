import { useEffect, useRef, useState } from "react";
import type * as Y from "yjs";

export type SyncStatus = "saved" | "saving";

export function useSyncStatus(ydoc: Y.Doc, debounceMs = 800): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>("saved");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = () => {
      setStatus("saving");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus("saved"), debounceMs);
    };

    ydoc.on("update", handler);
    return () => {
      ydoc.off("update", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [ydoc, debounceMs]);

  return status;
}

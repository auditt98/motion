import { useEffect, useState, useCallback } from "react";
import type YPartyKitProvider from "y-partykit/provider";

export interface CellCursor {
  clientId: number;
  name: string;
  color: string;
  rowId: string;
  columnId: string;
}

/**
 * Track which database cell each collaborator is focused on via Yjs awareness.
 */
export function useDatabaseCursors(provider: YPartyKitProvider) {
  const [cursors, setCursors] = useState<CellCursor[]>([]);

  useEffect(() => {
    const awareness = provider.awareness;

    function update() {
      const localId = awareness.clientID;
      const result: CellCursor[] = [];

      awareness.getStates().forEach((state, clientId) => {
        if (clientId === localId) return;
        const user = state.user;
        const dbCursor = state.dbCursor;
        if (!user || !dbCursor) return;
        result.push({
          clientId,
          name: user.name || "Anonymous",
          color: user.color || "#6b7280",
          rowId: dbCursor.rowId,
          columnId: dbCursor.columnId,
        });
      });

      setCursors(result);
    }

    awareness.on("change", update);
    update();

    return () => {
      awareness.off("change", update);
    };
  }, [provider]);

  const setLocalCursor = useCallback(
    (rowId: string | null, columnId: string | null) => {
      if (rowId && columnId) {
        provider.awareness.setLocalStateField("dbCursor", { rowId, columnId });
      } else {
        provider.awareness.setLocalStateField("dbCursor", null);
      }
    },
    [provider],
  );

  return { cursors, setLocalCursor };
}

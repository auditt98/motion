import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import YPartyKitProvider from "y-partykit/provider";
import { PARTYKIT_HOST } from "@/lib/partykit";
import { USER_COLORS } from "@motion/shared";

function getRandomColor() {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useYjsProvider(documentId: string, userName: string) {
  const colorRef = useRef(getRandomColor());

  const { ydoc, provider, idbPersistence } = useMemo(() => {
    const ydoc = new Y.Doc();

    const idbPersistence = new IndexeddbPersistence(
      `motion-doc-${documentId}`,
      ydoc,
    );

    const provider = new YPartyKitProvider(PARTYKIT_HOST, documentId, ydoc, {
      connect: true,
    });

    return { ydoc, provider, idbPersistence };
  }, [documentId]);

  // Keep awareness name in sync — useMemo only runs once per documentId,
  // but userName may resolve after auth loads
  useEffect(() => {
    provider.awareness.setLocalStateField("user", {
      name: userName,
      color: colorRef.current,
      isAgent: false,
      clientId: provider.awareness.clientID,
    });
  }, [provider, userName]);

  const [idbSynced, setIdbSynced] = useState(() => idbPersistence.synced);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>(() =>
      provider.wsconnected ? "connected" : "connecting",
    );

  // Track IndexedDB sync status
  useEffect(() => {
    if (idbPersistence.synced) {
      setIdbSynced(true);
      return;
    }
    setIdbSynced(false);
    const onSynced = () => setIdbSynced(true);
    idbPersistence.on("synced", onSynced);
    return () => {
      idbPersistence.off("synced", onSynced);
    };
  }, [idbPersistence]);

  // Track PartyKit connection status
  useEffect(() => {
    if (provider.wsconnected) {
      setConnectionStatus("connected");
    }
    const onStatus = ({ status }: { status: string }) => {
      setConnectionStatus(status as ConnectionStatus);
    };
    provider.on("status", onStatus);
    return () => {
      provider.off("status", onStatus);
    };
  }, [provider]);

  // Cleanup on unmount or documentId change
  useEffect(() => {
    return () => {
      provider.destroy();
      idbPersistence.destroy();
      ydoc.destroy();
    };
  }, [provider, idbPersistence, ydoc]);

  return { ydoc, provider, idbSynced, connectionStatus };
}

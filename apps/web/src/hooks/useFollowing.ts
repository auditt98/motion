import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor as TipTapEditor } from "@tiptap/react";
import type YPartyKitProvider from "y-partykit/provider";
import type { PeerState } from "./usePresence";

interface UseFollowingOptions {
  provider: YPartyKitProvider;
  editor: TipTapEditor | null;
  peers: PeerState[];
}

interface UseFollowingReturn {
  followingPeer: PeerState | null;
  followPeer: (clientId: number) => void;
  goToPeer: (clientId: number) => void;
  stopFollowing: () => void;
}

function scrollToCursor(clientId: number, behavior: ScrollBehavior = "smooth") {
  const cursorEl = document.querySelector(
    `.collaboration-cursor__caret[data-client-id="${clientId}"]`,
  );
  if (cursorEl) {
    cursorEl.scrollIntoView({ behavior, block: "center" });
    return true;
  }
  return false;
}

export function useFollowing({
  provider,
  editor,
  peers,
}: UseFollowingOptions): UseFollowingReturn {
  const [followingClientId, setFollowingClientId] = useState<number | null>(
    null,
  );
  const followingRef = useRef<number | null>(null);
  // Track whether we should suppress the next local selectionUpdate
  const suppressSelectionStop = useRef(false);

  // Keep ref in sync for use in callbacks
  followingRef.current = followingClientId;

  const followingPeer =
    peers.find((p) => p.clientId === followingClientId) ?? null;

  const stopFollowing = useCallback(() => {
    setFollowingClientId(null);
  }, []);

  const followPeer = useCallback(
    (clientId: number) => {
      if (followingRef.current === clientId) {
        stopFollowing();
        return;
      }
      setFollowingClientId(clientId);
      // Immediately scroll to the peer's cursor
      suppressSelectionStop.current = true;
      requestAnimationFrame(() => {
        scrollToCursor(clientId, "smooth");
        // Reset suppression after a short delay
        setTimeout(() => {
          suppressSelectionStop.current = false;
        }, 300);
      });
    },
    [stopFollowing],
  );

  const goToPeer = useCallback((clientId: number) => {
    scrollToCursor(clientId, "smooth");
  }, []);

  // Follow: scroll on awareness changes
  useEffect(() => {
    if (!followingClientId || !provider) return;

    const awareness = provider.awareness;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    function onAwarenessChange() {
      if (!followingRef.current) return;

      // Check if followed peer still exists
      const state = awareness.getStates().get(followingRef.current);
      if (!state) {
        // Peer disconnected
        setFollowingClientId(null);
        return;
      }

      // Debounce scroll updates
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (followingRef.current) {
          scrollToCursor(followingRef.current, "smooth");
        }
      }, 100);
    }

    awareness.on("change", onAwarenessChange);
    return () => {
      awareness.off("change", onAwarenessChange);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [followingClientId, provider]);

  // Auto-stop following when the local user types
  useEffect(() => {
    if (!followingClientId || !editor) return;

    function onTransaction({
      transaction,
    }: {
      transaction: { docChanged: boolean; getMeta: (key: string) => unknown };
    }) {
      if (!followingRef.current) return;
      // Only stop if the doc changed from a local edit (not a remote Yjs sync)
      if (transaction.docChanged && !transaction.getMeta("y-sync$")) {
        setFollowingClientId(null);
      }
    }

    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [followingClientId, editor]);

  // Auto-stop following when the local user clicks in the editor
  useEffect(() => {
    if (!followingClientId || !editor) return;

    function onSelectionUpdate() {
      if (!followingRef.current) return;
      if (suppressSelectionStop.current) return;
      setFollowingClientId(null);
    }

    // Use a small delay so the initial follow scroll doesn't trigger this
    const timer = setTimeout(() => {
      editor.on("selectionUpdate", onSelectionUpdate);
    }, 500);

    return () => {
      clearTimeout(timer);
      editor.off("selectionUpdate", onSelectionUpdate);
    };
  }, [followingClientId, editor]);

  return { followingPeer, followPeer, goToPeer, stopFollowing };
}

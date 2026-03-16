import { useEffect, useState } from "react";
import type YPartyKitProvider from "y-partykit/provider";

export interface PeerState {
  clientId: number;
  name: string;
  color: string;
  isAgent: boolean;
  agentId?: string;
  status?: string;
}

export function usePresence(provider: YPartyKitProvider): PeerState[] {
  const [peers, setPeers] = useState<PeerState[]>([]);

  useEffect(() => {
    const awareness = provider.awareness;

    function update() {
      const localId = awareness.clientID;
      const states: PeerState[] = [];

      console.log("[awareness] update triggered, localId:", localId);
      awareness.getStates().forEach((state, clientId) => {
        console.log("[awareness] client", clientId, clientId === localId ? "(self)" : "(peer)", state);
        if (clientId === localId) return;
        const user = state.user;
        if (!user) return;
        states.push({
          clientId,
          name: user.name || "Anonymous",
          color: user.color || "#6b7280",
          isAgent: user.isAgent || false,
          agentId: user.agentId,
          status: user.status,
        });
      });

      console.log("[awareness] peers after filter:", states.length, states.map(p => p.name));
      setPeers(states);
    }

    awareness.on("change", (...args: any[]) => {
      console.log("[awareness] change event", args);
      update();
    });
    update(); // initial read

    // Re-sync when tab regains focus
    function onVisibilityChange() {
      console.log("[awareness] visibilitychange:", document.visibilityState);
      if (document.visibilityState === "visible") {
        awareness.setLocalStateField("user", awareness.getLocalState()?.user);
        update();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      awareness.off("change", update);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [provider]);

  return peers;
}

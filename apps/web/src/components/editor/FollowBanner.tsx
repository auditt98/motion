import { Button } from "@weave-design-system/react";
import type { PeerState } from "@/hooks/usePresence";

interface FollowBannerProps {
  peer: PeerState;
  onStop: () => void;
}

export function FollowBanner({ peer, onStop }: FollowBannerProps) {
  return (
    <div
      className="follow-banner"
      style={{
        background: `${peer.color}18`,
        borderBottom: `2px solid ${peer.color}`,
        color: "var(--color-textPrimary)",
      }}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: peer.color }}
      />
      <span>
        Following <strong>{peer.name}</strong>
      </span>
      <div className="flex-1" />
      <Button variant="ghost" size="sm" onClick={onStop}>
        Stop following
      </Button>
    </div>
  );
}

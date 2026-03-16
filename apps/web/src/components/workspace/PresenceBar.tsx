import type { PeerState } from "@/hooks/usePresence";

interface PresenceBarProps {
  peers: PeerState[];
  followingClientId: number | null;
  onFollowPeer: (clientId: number) => void;
  onGoToPeer: (clientId: number) => void;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function PresenceBar({
  peers,
  followingClientId,
  onFollowPeer,
  onGoToPeer,
}: PresenceBarProps) {
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {peers.map((peer) => {
          const isFollowing = followingClientId === peer.clientId;
          return (
            <div key={peer.clientId} className="relative group">
              <button
                type="button"
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-semibold text-white transition-shadow ${
                  isFollowing ? "presence-avatar-following" : ""
                }`}
                style={{
                  backgroundColor: peer.color,
                  borderColor: isFollowing ? peer.color : "white",
                  color: isFollowing ? peer.color : undefined,
                  cursor: "pointer",
                }}
                onClick={() => onFollowPeer(peer.clientId)}
                title={isFollowing ? "Stop following" : `Follow ${peer.name}`}
              >
                {getInitials(peer.name)}
              </button>
              {peer.isAgent && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-purple-500 rounded-full border-[1.5px] border-white flex items-center justify-center">
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
                  </svg>
                </div>
              )}
              {/* Tooltip with go-to-cursor option */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1.5 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50 flex flex-col items-center gap-1">
                <span>
                  {peer.name}
                  {peer.isAgent ? ` — ${peer.status || "idle"}` : ""}
                </span>
                <button
                  type="button"
                  className="text-[10px] text-blue-300 hover:text-blue-200 underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGoToPeer(peer.clientId);
                  }}
                >
                  Go to cursor
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

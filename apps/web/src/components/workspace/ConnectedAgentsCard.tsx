import { Card, Table, Button } from "@weave-design-system/react";
import { Bot, ShieldCheck } from "@/components/shared/icons";
import type { AgentGrant } from "@/hooks/useAgentGrants";

/** Presentational table of OAuth agent grants (scope·role·mode·expiry·status + revoke). */
export function ConnectedAgentsCard({
  grants,
  isAdmin,
  onRevoke,
}: {
  grants: AgentGrant[];
  isAdmin: boolean;
  onRevoke: (grantId: string) => void;
}) {
  return (
    <Card className="mb-6">
      <Card.Header>
        <div className="flex items-center gap-2">
          <Bot size={18} style={{ color: "var(--color-teal)" }} />
          <h2 className="text-lg font-medium" style={{ color: "var(--color-textPrimary)" }}>
            Connected agents
          </h2>
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--color-textSecondary)" }}>
          Agents authorized over OAuth — scoped, expiring, and revocable anytime.
        </p>
      </Card.Header>
      <Card.Content>
        {grants.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-textSecondary)" }}>
            No agents connected yet. Add Motion as a connector in Claude or Codex, then authorize.
          </p>
        ) : (
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Agent</Table.HeaderCell>
                <Table.HeaderCell>Scope</Table.HeaderCell>
                <Table.HeaderCell>Access</Table.HeaderCell>
                <Table.HeaderCell>Mode</Table.HeaderCell>
                <Table.HeaderCell>Expires</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {grants.map((g) => {
                const initials = (g.agent_name || "AI")
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const active = g.status === "active";
                const revoked = g.status === "revoked";
                const exp = g.refresh_expires_at
                  ? new Date(g.refresh_expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  : "No expiry";
                const suggest = g.mode === "suggest";
                return (
                  <Table.Row key={g.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex items-center justify-center"
                          style={{ width: 30, height: 30, borderRadius: 999, background: "var(--color-teal-light)", color: "var(--color-teal)", fontSize: 11, fontWeight: 600 }}
                        >
                          {initials}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: "var(--color-textPrimary)" }}>{g.agent_name}</span>
                          <span className="inline-flex items-center gap-1" style={{ padding: "1px 6px", borderRadius: 4, background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                            <ShieldCheck size={11} style={{ color: "var(--color-forest)" }} />
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-textSecondary)" }}>OAuth</span>
                          </span>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm capitalize" style={{ color: "var(--color-textSecondary)" }}>{g.scope_type}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm capitalize" style={{ color: "var(--color-textPrimary)" }}>{g.role}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: suggest ? "var(--color-gold-light)" : "var(--color-rust-light)", color: suggest ? "var(--color-gold)" : "var(--color-rust-dark)" }}
                      >
                        {suggest ? "Suggesting" : "Direct"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm" style={{ color: "var(--color-textSecondary)" }}>{exp}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="inline-flex items-center gap-1.5">
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: active ? "var(--color-teal)" : revoked ? "var(--color-textSecondary)" : "var(--color-gold)" }} />
                        <span className="text-sm capitalize" style={{ color: active ? "var(--color-teal)" : "var(--color-textSecondary)" }}>{g.status}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {!revoked && isAdmin && (
                        <Button variant="destructive" size="sm" onClick={() => onRevoke(g.id)}>
                          Revoke
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        )}
      </Card.Content>
    </Card>
  );
}

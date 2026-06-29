import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useWorkspaceMembers, type MemberWithUser } from "@/hooks/useWorkspaceMembers";
import { useInvitations } from "@/hooks/useInvitations";
import { useInviteLinks } from "@/hooks/useInviteLinks";
import { useAgentTokens } from "@/hooks/useAgentTokens";
import { useAgentGrants } from "@/hooks/useAgentGrants";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  Card,
  Button,
  InputGroup,
  SelectGroup,
  Badge,
  Avatar,
  Table,
  Modal,
  AlertBanner,
  useToast,
} from "@weave-design-system/react";
import { ConnectedAgentsCard } from "./ConnectedAgentsCard";
import { StateView } from "@/components/shared/StateView";

const ROLE_OPTIONS = ["owner", "admin", "member", "guest"] as const;

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "general", label: "General" },
  { id: "members", label: "Members & agents" },
  { id: "integrations", label: "Integrations" },
  { id: "billing", label: "Billing" },
  { id: "audit", label: "Audit log" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];
const SECTION_LABELS = Object.fromEntries(SECTIONS.map((s) => [s.id, s.label])) as Record<SectionId, string>;

function SettingsNav({ section, onSelect, onBack }: { section: SectionId; onSelect: (s: SectionId) => void; onBack: () => void }) {
  return (
    <nav className="flex flex-col shrink-0" style={{ width: 248, borderRight: "1px solid var(--color-border)", background: "var(--color-surface)", padding: "20px 14px", gap: 3 }}>
      <button onClick={onBack} className="flex items-center hover:opacity-80" style={{ gap: 6, fontSize: 13, color: "var(--color-textSecondary)", padding: "6px 8px", marginBottom: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Back to workspace
      </button>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: 1.2, color: "var(--color-textTertiary)", padding: "4px 8px 6px" }}>SETTINGS</div>
      {SECTIONS.map((s) => {
        const active = section === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="text-left transition-colors"
            style={{ padding: "8px 10px", borderRadius: 8, fontSize: 14, fontWeight: active ? 600 : 500, background: active ? "var(--color-rustLight)" : "transparent", color: active ? "var(--color-rust)" : "var(--color-textPrimary)" }}
          >
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}

export function SettingsPage() {
  const { workspaceId, currentUserRole, workspaceName, workspaces, renameWorkspace, deleteWorkspace } = useWorkspaceContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const { members, loading: membersLoading, updateRole, removeMember } =
    useWorkspaceMembers(workspaceId);
  const { invitations, sendInvitation, revokeInvitation } =
    useInvitations(workspaceId);
  const { links, createLink, toggleLink, deleteLink } =
    useInviteLinks(workspaceId);
  const { tokens: agentTokens, createToken, revokeToken } =
    useAgentTokens(workspaceId);
  const { grants: agentGrants, revokeGrant } = useAgentGrants(workspaceId);

  const { displayName, resolvedDisplayName, updateDisplayName, defaultWorkspaceId, updateDefaultWorkspace } = useUserProfile(user?.id, user?.email);
  const navigate = useNavigate();
  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";
  const isOwner = currentUserRole === "owner";

  const [section, setSection] = useState<SectionId>("members");
  const [profileName, setProfileName] = useState("");
  const [profileNameLoaded, setProfileNameLoaded] = useState(false);
  useEffect(() => {
    if (!profileNameLoaded && displayName !== null) {
      setProfileName(displayName);
      setProfileNameLoaded(true);
    }
  }, [displayName, profileNameLoaded]);

  const [wsName, setWsName] = useState(workspaceName || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "guest">("member");
  const [inviteError, setInviteError] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState("");

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteSending(true);
    setInviteError("");

    const result = await sendInvitation(inviteEmail.trim(), inviteRole);

    if (result && "error" in result && result.error) {
      setInviteError(
        result.error.includes("duplicate")
          ? "This email has already been invited."
          : result.error,
      );
    } else {
      setInviteEmail("");
      toast({ title: "Invitation sent", variant: "success" });
    }

    setInviteSending(false);
  }

  async function handleCreateLink() {
    const link = await createLink("member");
    if (link) {
      copyInviteUrl(link.token);
    }
  }

  function copyInviteUrl(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast({ title: "Link copied to clipboard", variant: "success" });
    setTimeout(() => setCopiedToken(null), 2000);
  }

  if (!workspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: "var(--color-textSecondary)" }}>
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden" style={{ background: "var(--color-bg)" }}>
      <SettingsNav section={section} onSelect={setSection} onBack={() => navigate("/")} />
      <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-12">
        <h1 className="mb-8" style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, color: "var(--color-textPrimary)" }}>{SECTION_LABELS[section]}</h1>

        {section === "profile" && (
        <>
        {/* Account */}
        <Card className="mb-6">
          <Card.Header>
            <h2 className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--color-textPrimary)" }}>Account</h2>
          </Card.Header>
          <Card.Content>
            <div className="flex gap-2">
              <div className="flex-1">
                <InputGroup
                  label="Display name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder={user?.email?.split("@")[0] || "Your name"}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="primary"
                  disabled={profileName.trim() === (displayName || "")}
                  onClick={async () => {
                    const { error } = await updateDisplayName(profileName);
                    if (error) {
                      toast({ title: "Failed to update name", variant: "error" });
                    } else {
                      toast({ title: "Display name updated", variant: "success" });
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
            {workspaces.length > 1 && (
              <div className="flex gap-2 mt-4">
                <div className="flex-1">
                  <SelectGroup
                    label="Default workspace"
                    value={defaultWorkspaceId || ""}
                    onChange={(e) => {
                      const value = e.target.value || null;
                      updateDefaultWorkspace(value).then(({ error }) => {
                        if (error) {
                          toast({ title: "Failed to update default workspace", variant: "error" });
                        } else {
                          toast({ title: "Default workspace updated", variant: "success" });
                        }
                      });
                    }}
                  >
                    <option value="">Auto-select</option>
                    {workspaces.map((ws) => (
                      <option key={ws.workspace_id} value={ws.workspace_id}>
                        {ws.name}
                      </option>
                    ))}
                  </SelectGroup>
                </div>
              </div>
            )}
          </Card.Content>
        </Card>
        </>
        )}

        {/* Workspace name */}
        {section === "general" && isAdmin && (
          <Card className="mb-6">
            <Card.Header>
              <h2 className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--color-textPrimary)" }}>Workspace</h2>
            </Card.Header>
            <Card.Content>
              <div className="flex gap-2">
                <div className="flex-1">
                  <InputGroup
                    label="Workspace name"
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="primary"
                    disabled={!wsName.trim() || wsName === workspaceName}
                    onClick={async () => {
                      if (wsName.trim() && wsName !== workspaceName) {
                        await renameWorkspace(wsName.trim());
                        toast({ title: "Workspace renamed", variant: "success" });
                      }
                    }}
                  >
                    Rename
                  </Button>
                </div>
              </div>
            </Card.Content>
          </Card>
        )}

        {section === "members" && (
        <>
        {/* Members */}
        <Card className="mb-6">
          <Card.Header>
            <div className="flex items-center gap-2">
              <h2 className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--color-textPrimary)" }}>Members</h2>
              <Badge variant="secondary">{members.length}</Badge>
            </div>
          </Card.Header>
          <Card.Content>
            {membersLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-12 rounded animate-pulse" style={{ background: "var(--color-surface)" }} />
                ))}
              </div>
            ) : (
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>Member</Table.HeaderCell>
                    <Table.HeaderCell>Role</Table.HeaderCell>
                    {isAdmin && <Table.HeaderCell className="w-24">Actions</Table.HeaderCell>}
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {members.map((member) => {
                    const displayName = member.user.display_name || member.user.email.split("@")[0];
                    const isCurrentUser = member.user_id === user?.id;
                    const canManage = isAdmin && member.role !== "owner";

                    return (
                      <Table.Row key={member.id}>
                        <Table.Cell>
                          <div className="flex items-center gap-3">
                            <Avatar name={displayName} src={member.user.avatar_url || undefined} size="sm" />
                            <div>
                              <div className="text-sm" style={{ color: "var(--color-textPrimary)" }}>
                                {displayName}
                                {isCurrentUser && <span className="text-xs ml-1" style={{ color: "var(--color-textSecondary)" }}>(you)</span>}
                              </div>
                              <div className="text-xs" style={{ color: "var(--color-textSecondary)" }}>{member.user.email}</div>
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          {canManage ? (
                            <select
                              value={member.role}
                              onChange={(e) => updateRole(member.id, e.target.value as MemberWithUser["role"])}
                              className="px-2 py-1 text-xs border rounded"
                              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-textPrimary)" }}
                            >
                              {ROLE_OPTIONS.filter((r) => r !== "owner").map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          ) : (
                            <Badge variant={member.role === "owner" ? "primary" : member.role === "admin" ? "info" : "secondary"}>
                              {member.role}
                            </Badge>
                          )}
                        </Table.Cell>
                        {isAdmin && (
                          <Table.Cell>
                            {canManage && (
                              <Button variant="destructive" size="sm" onClick={() => removeMember(member.id)}>
                                Remove
                              </Button>
                            )}
                          </Table.Cell>
                        )}
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table>
            )}
          </Card.Content>
        </Card>

        {/* Invite by Email */}
        {isAdmin && (
          <Card className="mb-6">
            <Card.Header>
              <h2 className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--color-textPrimary)" }}>Invite by email</h2>
            </Card.Header>
            <Card.Content>
              <form onSubmit={handleSendInvite} className="flex gap-2">
                <div className="flex-1">
                  <InputGroup
                    label="Email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    error={inviteError}
                  />
                </div>
                <div>
                  <SelectGroup
                    label="Role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="guest">Guest</option>
                  </SelectGroup>
                </div>
                <div className="flex items-end">
                  <Button variant="primary" type="submit" loading={inviteSending}>
                    Invite
                  </Button>
                </div>
              </form>

              {invitations.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2" style={{ color: "var(--color-textSecondary)" }}>
                    Pending invitations
                  </h3>
                  <Table>
                    <Table.Body>
                      {invitations.map((inv) => (
                        <Table.Row key={inv.id}>
                          <Table.Cell>
                            <span className="text-sm" style={{ color: "var(--color-textPrimary)" }}>{inv.email}</span>
                            <Badge variant="secondary" className="ml-2">{inv.role}</Badge>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => copyInviteUrl(inv.token)}>
                              {copiedToken === inv.token ? "Copied!" : "Copy link"}
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => revokeInvitation(inv.id)}>
                              Revoke
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </div>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Invite Links */}
        {isAdmin && (
          <Card className="mb-6">
            <Card.Header>
              <div className="flex items-center justify-between">
                <h2 className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--color-textPrimary)" }}>Invite links</h2>
                <Button variant="outline" size="sm" onClick={handleCreateLink}>Create link</Button>
              </div>
            </Card.Header>
            <Card.Content>
              {links.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-textSecondary)" }}>
                  No invite links yet. Create one to share with others.
                </p>
              ) : (
                <Table>
                  <Table.Body>
                    {links.map((link) => (
                      <Table.Row key={link.id}>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: link.is_active ? "var(--color-success)" : "var(--color-border)" }} />
                            <Badge variant={link.is_active ? "success" : "secondary"}>{link.role}</Badge>
                            <span className="text-xs" style={{ color: "var(--color-textSecondary)" }}>
                              {link.use_count} use{link.use_count !== 1 ? "s" : ""}
                              {link.max_uses ? ` / ${link.max_uses}` : ""}
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => copyInviteUrl(link.token)}>
                              {copiedToken === link.token ? "Copied!" : "Copy"}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => toggleLink(link.id, !link.is_active)}>
                              {link.is_active ? "Disable" : "Enable"}
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteLink(link.id)}>
                              Delete
                            </Button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Connected agents (OAuth grants) */}
        <ConnectedAgentsCard grants={agentGrants} isAdmin={isAdmin} onRevoke={revokeGrant} />

        {/* Agent Tokens (legacy) */}
        {isAdmin && (
          <Card className="mb-6">
            <Card.Header>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--color-textPrimary)" }}>Agent tokens</h2>
                  <p className="text-xs mt-1" style={{ color: "var(--color-textSecondary)" }}>
                    Tokens grant full workspace access to AI agents.
                  </p>
                </div>
              </div>
            </Card.Header>
            <Card.Content>
              <div className="flex gap-2 mb-4">
                <div className="flex-1">
                  <InputGroup
                    label="Token name"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="e.g. Claude, Cursor Agent"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="primary"
                    disabled={!newTokenName.trim()}
                    onClick={async () => {
                      const token = await createToken(newTokenName.trim());
                      if (token) {
                        navigator.clipboard.writeText(token.token);
                        toast({ title: "Token created and copied to clipboard", variant: "success" });
                        setNewTokenName("");
                      }
                    }}
                  >
                    Generate
                  </Button>
                </div>
              </div>

              {agentTokens.length > 0 && (
                <Table>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Name</Table.HeaderCell>
                      <Table.HeaderCell>Status</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {agentTokens.map((t) => {
                      const isRevoked = !!t.revoked_at;
                      return (
                        <Table.Row key={t.id}>
                          <Table.Cell>
                            <span className="text-sm" style={{ color: "var(--color-textPrimary)" }}>{t.name}</span>
                            <div className="text-xs font-mono mt-0.5" style={{ color: "var(--color-textSecondary)" }}>
                              {t.token.slice(0, 8)}...{t.token.slice(-4)}
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge variant={isRevoked ? "secondary" : "success"}>
                              {isRevoked ? "Revoked" : "Active"}
                            </Badge>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {!isRevoked && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(t.token);
                                      setCopiedToken(t.id);
                                      toast({ title: "Token copied", variant: "success" });
                                      setTimeout(() => setCopiedToken(null), 2000);
                                    }}
                                  >
                                    {copiedToken === t.id ? "Copied!" : "Copy"}
                                  </Button>
                                  <Button variant="destructive" size="sm" onClick={() => revokeToken(t.id)}>
                                    Revoke
                                  </Button>
                                </>
                              )}
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>
              )}
            </Card.Content>
          </Card>
        )}

        </>
        )}

        {/* Integrations */}
        {section === "integrations" && (
          <StateView
            tone="gold"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>}
            title="No integrations yet"
            description="Connectors like GitHub sync will appear here once available."
          />
        )}

        {/* Billing */}
        {section === "billing" && (
          <StateView
            tone="teal"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>}
            title="Billing isn't set up"
            description="This workspace is on the free plan. Billing controls will live here."
          />
        )}

        {/* Audit log */}
        {section === "audit" && (
          <StateView
            tone="forest"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></svg>}
            title="No audit events yet"
            description="A record of workspace activity will appear here when audit logging is enabled."
          />
        )}

        {/* Danger zone */}
        {section === "general" && isOwner && (
          <Card>
            <Card.Header>
              <h2 className="text-lg font-medium" style={{ color: "var(--color-error)" }}>Danger zone</h2>
            </Card.Header>
            <Card.Content>
              <AlertBanner
                message="Deleting this workspace will permanently remove all its pages and members."
                variant="warning"
              />
              <div className="mt-4">
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: "var(--color-error)" }}>Are you sure?</span>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        await deleteWorkspace();
                        navigate("/");
                      }}
                    >
                      Yes, delete
                    </Button>
                    <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                    Delete workspace
                  </Button>
                )}
              </div>
            </Card.Content>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}

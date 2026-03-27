import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useWorkspaceMembers, type MemberWithUser } from "@/hooks/useWorkspaceMembers";
import { useInvitations } from "@/hooks/useInvitations";
import { useInviteLinks } from "@/hooks/useInviteLinks";
import { useAgentTokens } from "@/hooks/useAgentTokens";
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

const ROLE_OPTIONS = ["owner", "admin", "member", "guest"] as const;

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

  const { displayName, resolvedDisplayName, updateDisplayName, defaultWorkspaceId, updateDefaultWorkspace } = useUserProfile(user?.id, user?.email);
  const navigate = useNavigate();
  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";
  const isOwner = currentUserRole === "owner";

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
    <div className="flex-1 overflow-y-auto" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto px-8 py-12">
        <h1 className="text-2xl font-semibold mb-8" style={{ color: "var(--color-textPrimary)" }}>Settings</h1>

        {/* Account */}
        <Card className="mb-6">
          <Card.Header>
            <h2 className="text-lg font-medium" style={{ color: "var(--color-textPrimary)" }}>Account</h2>
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

        {/* Workspace name */}
        {isAdmin && (
          <Card className="mb-6">
            <Card.Header>
              <h2 className="text-lg font-medium" style={{ color: "var(--color-textPrimary)" }}>Workspace</h2>
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

        {/* Members */}
        <Card className="mb-6">
          <Card.Header>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium" style={{ color: "var(--color-textPrimary)" }}>Members</h2>
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
              <h2 className="text-lg font-medium" style={{ color: "var(--color-textPrimary)" }}>Invite by email</h2>
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
                <h2 className="text-lg font-medium" style={{ color: "var(--color-textPrimary)" }}>Invite links</h2>
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
                            <div className={`w-2 h-2 rounded-full ${link.is_active ? "bg-green-400" : "bg-theme-surface"}`} />
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

        {/* Agent Tokens */}
        {isAdmin && (
          <Card className="mb-6">
            <Card.Header>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium" style={{ color: "var(--color-textPrimary)" }}>Agent tokens</h2>
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

        {/* Danger zone */}
        {isOwner && (
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
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/header";
import Link from "next/link";
import {
  Building2,
  Users,
  Loader2,
  Trash2,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  Crown,
  Shield,
  User as UserIcon,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
} from "lucide-react";

interface Member {
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER";
  isMe: boolean;
  joinedAt: string;
}

interface PendingInvite {
  id: string;
  email: string | null;
  role: "ADMIN" | "MEMBER";
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface OrgDetails {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    createdAt: string;
  };
  myRole: "OWNER" | "ADMIN" | "MEMBER";
  members: Member[];
}

const ROLE_META = {
  OWNER: { label: "Владелец", icon: Crown, color: "text-amber-600" },
  ADMIN: { label: "Админ", icon: Shield, color: "text-primary" },
  MEMBER: { label: "Участник", icon: UserIcon, color: "text-muted" },
};

export default function OrganizationSettingsPage() {
  // Used after delete-workspace and leave-workspace to refresh the JWT
  // so the next page load doesn't keep using a cookie that points to the
  // workspace we just removed ourselves from.
  const { update } = useSession();
  const [orgs, setOrgs] = useState<{
    activeOrgId: string;
    organizations: Array<{ id: string; name: string; isActive: boolean }>;
  } | null>(null);
  const [details, setDetails] = useState<OrgDetails | null>(null);
  const [invites, setInvites] = useState<PendingInvite[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Load active org id + details + invites
  useEffect(() => {
    async function load() {
      try {
        const orgsRes = await fetch("/api/organizations");
        if (!orgsRes.ok) throw new Error("orgs");
        const orgsData = await orgsRes.json();
        setOrgs(orgsData);

        const detRes = await fetch(`/api/organizations/${orgsData.activeOrgId}`);
        if (detRes.ok) {
          setDetails(await detRes.json());
        }

        const invRes = await fetch(
          `/api/organizations/${orgsData.activeOrgId}/invites`
        );
        if (invRes.ok) {
          const inv = await invRes.json();
          setInvites(inv.invites);
        } else if (invRes.status === 403) {
          setInvites(null); // member can't see invites; that's fine
        }
      } catch {
        // ignored
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const canManage = details?.myRole === "OWNER" || details?.myRole === "ADMIN";
  const isOwner = details?.myRole === "OWNER";

  const handleRename = async () => {
    if (!details) return;
    const newName = window.prompt("Новое название workspace:", details.organization.name);
    if (!newName || newName.trim() === details.organization.name) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/organizations/${details.organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setDetails({ ...details, organization: data.organization });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Ошибка при переименовании");
      }
    } finally {
      setRenaming(false);
    }
  };

  const handleCreateInvite = async (role: "ADMIN" | "MEMBER") => {
    if (!details) return;
    setCreatingInvite(true);
    try {
      const res = await fetch(
        `/api/organizations/${details.organization.id}/invites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setInvites((prev) => [
          {
            id: data.invite.id,
            email: data.invite.email,
            role: data.invite.role,
            token: data.invite.token,
            expiresAt: data.invite.expiresAt,
            createdAt: new Date().toISOString(),
          },
          ...(prev ?? []),
        ]);
        // Auto-copy the URL to clipboard for convenience.
        try {
          await navigator.clipboard.writeText(data.invite.url);
          setCopied(data.invite.id);
          setTimeout(() => setCopied(null), 2000);
        } catch {
          // ignored — user can copy manually
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Не удалось создать приглашение");
      }
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!details) return;
    if (!confirm("Отозвать приглашение?")) return;
    const res = await fetch(
      `/api/organizations/${details.organization.id}/invites/${inviteId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setInvites((prev) => prev?.filter((i) => i.id !== inviteId) ?? null);
    }
  };

  const handleRemoveMember = async (member: Member) => {
    if (!details) return;
    const action = member.isMe ? "Покинуть workspace?" : `Удалить ${member.name || member.email}?`;
    if (!confirm(action)) return;
    const res = await fetch(
      `/api/organizations/${details.organization.id}/members/${member.userId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      if (member.isMe) {
        // Leaving the workspace flips activeOrgId on the server. Refresh
        // the JWT first so the cookie stops pointing to the workspace we
        // just left, then hard-navigate so all client state resets.
        try {
          await update();
        } catch {
          // non-fatal — server has the new value, JWT will catch up
        }
        window.location.href = "/dashboard";
      } else {
        setDetails({
          ...details,
          members: details.members.filter((m) => m.userId !== member.userId),
        });
      }
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Не удалось удалить участника");
    }
  };

  const handleDeleteOrg = async () => {
    if (!details) return;
    const confirmation = window.prompt(
      `Это удалит весь workspace «${details.organization.name}» и все документы в нём. Чтобы подтвердить, введите название:`
    );
    if (confirmation !== details.organization.name) return;
    const res = await fetch(`/api/organizations/${details.organization.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      // Refresh JWT so the cookie stops pointing to the deleted workspace,
      // then hard navigate so every cached client component (OrgSwitcher,
      // dashboard list, usage widget) re-initialises against the fallback
      // workspace the server just switched us into.
      try {
        await update();
      } catch {
        // non-fatal — server has the new value
      }
      window.location.href = "/dashboard";
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Не удалось удалить workspace");
    }
  };

  const copyToken = async (token: string, inviteId: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(inviteId);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignored
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-full flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!details || !orgs) {
    return (
      <div className="flex min-h-full flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted">Не удалось загрузить настройки workspace.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Настройки workspace
              </h1>
              <p className="text-sm text-muted">
                {details.organization.name}
              </p>
            </div>
          </div>

          {/* General */}
          <section className="mb-6 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Основное
            </h2>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">
                  Название
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-sm text-foreground">
                  {details.organization.name}
                  {canManage && (
                    <button
                      onClick={handleRename}
                      disabled={renaming}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      {renaming ? "..." : "Изменить"}
                    </button>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">
                  Тариф
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {details.organization.plan}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">
                  Ваша роль
                </dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {(() => {
                    const meta = ROLE_META[details.myRole];
                    const Icon = meta.icon;
                    return (
                      <>
                        <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                        {meta.label}
                      </>
                    );
                  })()}
                </dd>
              </div>
            </dl>
          </section>

          {/* Admin / Owner navigation tiles. Hidden for plain MEMBERs
              since these views show team-wide data. */}
          {canManage && (
            <section className="mb-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/settings/organization/usage"
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-primary-light/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary-dark">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">
                    Использование
                  </p>
                  <p className="text-xs text-muted">
                    Кто сколько потратил квоты в этом месяце
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
              <Link
                href="/settings/organization/audit"
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-primary-light/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary-dark">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">
                    Журнал событий
                  </p>
                  <p className="text-xs text-muted">
                    Кто, когда, что изменил в workspace
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            </section>
          )}

          {/* Members */}
          <section
            id="members"
            className="mb-6 rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Users className="h-5 w-5 text-muted" />
                Участники ({details.members.length})
              </h2>
              {canManage && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCreateInvite("MEMBER")}
                    disabled={creatingInvite}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {creatingInvite ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Пригласить
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => handleCreateInvite("ADMIN")}
                      disabled={creatingInvite}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Пригласить админа
                    </button>
                  )}
                </div>
              )}
            </div>

            <ul className="divide-y divide-border">
              {details.members.map((m) => {
                const meta = ROLE_META[m.role];
                const Icon = meta.icon;
                return (
                  <li
                    key={m.userId}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">
                        {(m.name || m.email)[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {m.name || m.email}
                          {m.isMe && (
                            <span className="ml-2 text-xs text-muted">(вы)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex items-center gap-1 text-xs font-medium ${meta.color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                      {(canManage || m.isMe) && (
                        <button
                          onClick={() => handleRemoveMember(m)}
                          className="text-muted transition-colors hover:text-danger"
                          title={m.isMe ? "Покинуть workspace" : "Удалить"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Pending invites */}
          {canManage && invites && invites.length > 0 && (
            <section className="mb-6 rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Активные приглашения ({invites.length})
              </h2>
              <ul className="divide-y divide-border">
                {invites.map((inv) => {
                  const expiresIn = Math.ceil(
                    (new Date(inv.expiresAt).getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24)
                  );
                  return (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {inv.email ?? "Открытая ссылка"}
                          <span className="ml-2 text-xs uppercase tracking-wide text-muted">
                            · {inv.role === "ADMIN" ? "Админ" : "Участник"}
                          </span>
                        </p>
                        <p className="text-xs text-muted">
                          Истекает через {expiresIn}{" "}
                          {expiresIn === 1
                            ? "день"
                            : expiresIn < 5
                              ? "дня"
                              : "дней"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => copyToken(inv.token, inv.id)}
                          className="flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                        >
                          {copied === inv.id ? (
                            <>
                              <Check className="h-3 w-3 text-success" />
                              Скопировано
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Копировать ссылку
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="text-muted transition-colors hover:text-danger"
                          title="Отозвать"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Danger zone — owner only */}
          {isOwner && (
            <section className="rounded-xl border border-danger/30 bg-red-50/50 p-6">
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-danger">
                <AlertTriangle className="h-5 w-5" />
                Опасная зона
              </h2>
              <p className="mb-4 text-sm text-muted">
                Удаление workspace необратимо. Все документы, чаты, история
                использования будут удалены навсегда.
              </p>
              <button
                onClick={handleDeleteOrg}
                className="flex items-center gap-2 rounded-lg border border-danger bg-white px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
                Удалить workspace
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

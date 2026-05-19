"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/button";
import {
  Users,
  Search,
  UserPlus,
  Check,
  X,
  Clock,
  Loader2,
  Save,
  Briefcase,
  FileText,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  BadgeCheck,
  ShieldCheck,
  Building2,
} from "lucide-react";

type ConnState = "none" | "connected" | "incoming" | "outgoing" | "declined";

interface DirEntry {
  userId: string;
  displayName: string;
  headline: string | null;
  specialization: string | null;
  bio: string | null;
  image: string | null;
  connection: ConnState;
}

interface ConnEntry {
  connectionId: string;
  userId: string;
  displayName: string;
  headline: string | null;
  image: string | null;
  message: string | null;
  createdAt: string;
}

interface Profile {
  discoverable: boolean;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  specialization: string | null;
  // ИНН linking — see InnSection.
  inn: string | null;
  innStatus: string;
  innCompanyName: string | null;
  innClaimedAt: string | null;
  innVerifiedAt: string | null;
  innDocUrl: string | null;
  innRejectionNote: string | null;
}

interface ShareSummary {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "COMPLETED";
  message: string | null;
  createdAt: string;
  commentCount: number;
  documentName: string;
  counterpart: { displayName: string; image: string | null };
}

type Tab = "directory" | "connections" | "shares" | "profile";

function Avatar({
  name,
  image,
  size = 40,
}: {
  name: string;
  image: string | null;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  if (image) {
    // Catalogue avatars are small remote thumbnails; next/image adds no
    // value for a 40px provider image, so a plain img is intentional.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export default function NetworkPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("directory");

  // Directory
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState<DirEntry[]>([]);
  const [dirLoading, setDirLoading] = useState(false);

  // Connections
  const [connected, setConnected] = useState<ConnEntry[]>([]);
  const [incoming, setIncoming] = useState<ConnEntry[]>([]);
  const [outgoing, setOutgoing] = useState<ConnEntry[]>([]);

  // Shares (contracts sent for review)
  const [sharesReceived, setSharesReceived] = useState<ShareSummary[]>([]);
  const [sharesSent, setSharesSent] = useState<ShareSummary[]>([]);

  // Profile
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Initial load: connections, shares and own profile.
  useEffect(() => {
    void refreshConnections();
    void refreshShares();
    void (async () => {
      try {
        const r = await fetch("/api/network/profile");
        if (r.ok) setProfile((await r.json()).profile);
      } catch {
        // non-fatal — profile tab shows a retry-free empty form
      }
    })();
  }, []);

  // Directory search — debounced so each keystroke doesn't hit the API.
  useEffect(() => {
    const handle = setTimeout(() => void loadDirectory(query), 300);
    return () => clearTimeout(handle);
  }, [query]);

  async function loadDirectory(q: string) {
    setDirLoading(true);
    try {
      const r = await fetch(
        `/api/network/directory?q=${encodeURIComponent(q)}`
      );
      if (r.ok) setDirectory((await r.json()).results);
    } catch {
      setError("Не удалось загрузить каталог");
    } finally {
      setDirLoading(false);
    }
  }

  async function refreshConnections() {
    try {
      const r = await fetch("/api/network/connections");
      if (r.ok) {
        const d = await r.json();
        setConnected(d.connected);
        setIncoming(d.incoming);
        setOutgoing(d.outgoing);
      }
    } catch {
      // non-fatal
    }
  }

  async function refreshShares() {
    try {
      const r = await fetch("/api/network/shares");
      if (r.ok) {
        const d = await r.json();
        setSharesReceived(d.received);
        setSharesSent(d.sent);
      }
    } catch {
      // non-fatal
    }
  }

  async function connect(userId: string) {
    setBusy(userId);
    setError(null);
    try {
      const r = await fetch("/api/network/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: userId }),
      });
      if (!r.ok) {
        setError((await r.json()).error ?? "Не удалось отправить запрос");
        return;
      }
      setDirectory((prev) =>
        prev.map((e) =>
          e.userId === userId ? { ...e, connection: "outgoing" } : e
        )
      );
      void refreshConnections();
    } finally {
      setBusy(null);
    }
  }

  async function respond(connectionId: string, action: "accept" | "decline") {
    setBusy(connectionId);
    try {
      const r = await fetch(`/api/network/connections/${connectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (r.ok) await refreshConnections();
    } finally {
      setBusy(null);
    }
  }

  async function removeConnection(connectionId: string) {
    setBusy(connectionId);
    try {
      const r = await fetch(`/api/network/connections/${connectionId}`, {
        method: "DELETE",
      });
      if (r.ok) await refreshConnections();
    } finally {
      setBusy(null);
    }
  }

  async function messageUser(userId: string) {
    setBusy(userId);
    setError(null);
    try {
      const r = await fetch("/api/network/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: userId }),
      });
      if (r.ok) {
        const { conversationId } = await r.json();
        router.push(`/network/messages/${conversationId}`);
      } else {
        setError((await r.json()).error ?? "Не удалось открыть переписку");
      }
    } finally {
      setBusy(null);
    }
  }

  async function saveProfile() {
    if (!profile) return;
    setSavingProfile(true);
    setProfileSaved(false);
    setError(null);
    try {
      const r = await fetch("/api/network/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!r.ok) {
        setError((await r.json()).error ?? "Не удалось сохранить профиль");
        return;
      }
      setProfile((await r.json()).profile);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } finally {
      setSavingProfile(false);
    }
  }

  const pendingShares = sharesReceived.filter(
    (s) => s.status === "PENDING"
  ).length;
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "directory", label: "Каталог" },
    {
      id: "connections",
      label: "Связи",
      badge: incoming.length || undefined,
    },
    { id: "shares", label: "Ревью", badge: pendingShares || undefined },
    { id: "profile", label: "Мой профиль" },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Сеть"
        description="Находите коллег, объединяйтесь в команды и отправляйте договоры на ревью."
        actions={
          <Link
            href="/network/messages"
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Сообщения</span>
          </Link>
        }
      />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

          {/* Tabs */}
          <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative -mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {t.label}
                {t.badge ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-fg">
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {tab === "directory" && (
            <DirectoryTab
              query={query}
              setQuery={setQuery}
              loading={dirLoading}
              entries={directory}
              busy={busy}
              onConnect={connect}
            />
          )}

          {tab === "connections" && (
            <ConnectionsTab
              connected={connected}
              incoming={incoming}
              outgoing={outgoing}
              busy={busy}
              onRespond={respond}
              onRemove={removeConnection}
              onMessage={messageUser}
            />
          )}

          {tab === "shares" && (
            <SharesTab received={sharesReceived} sent={sharesSent} />
          )}

          {tab === "profile" && (
            <ProfileTab
              profile={profile}
              setProfile={setProfile}
              saving={savingProfile}
              saved={profileSaved}
              onSave={saveProfile}
            />
          )}
        </div>
      </AppShell>
  );
}

function DirectoryTab({
  query,
  setQuery,
  loading,
  entries,
  busy,
  onConnect,
}: {
  query: string;
  setQuery: (v: string) => void;
  loading: boolean;
  entries: DirEntry[];
  busy: string | null;
  onConnect: (userId: string) => void;
}) {
  return (
    <div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя, специализация или направление практики"
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted/50" />
          <p className="text-sm text-muted">
            {query
              ? "Никого не нашли по этому запросу."
              : "В каталоге пока никого нет. Откройте свой профиль для поиска во вкладке «Мой профиль»."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {entries.map((e) => (
            <div
              key={e.userId}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            >
              <Link
                href={`/network/users/${e.userId}`}
                className="flex items-start gap-3 transition-opacity hover:opacity-80"
              >
                <Avatar name={e.displayName} image={e.image} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">
                    {e.displayName}
                  </p>
                  {e.headline && (
                    <p className="truncate text-xs text-muted">{e.headline}</p>
                  )}
                </div>
              </Link>
              {e.specialization && (
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Briefcase className="h-3 w-3 shrink-0" />
                  <span className="truncate">{e.specialization}</span>
                </p>
              )}
              {e.bio && (
                <p className="line-clamp-3 text-xs leading-relaxed text-muted">
                  {e.bio}
                </p>
              )}
              <div className="mt-auto pt-1">
                {e.connection === "connected" ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-success-light px-3 py-1.5 text-xs font-semibold text-success">
                    <Check className="h-3.5 w-3.5" />
                    Вы связаны
                  </span>
                ) : e.connection === "outgoing" ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    Запрос отправлен
                  </span>
                ) : e.connection === "incoming" ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-warning-light px-3 py-1.5 text-xs font-semibold text-warning">
                    <Clock className="h-3.5 w-3.5" />
                    Ждёт вашего ответа — см. «Связи»
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onConnect(e.userId)}
                    disabled={busy === e.userId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {busy === e.userId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    Связаться
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectionRow({
  entry,
  busy,
  children,
}: {
  entry: ConnEntry;
  busy: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
      <Link
        href={`/network/users/${entry.userId}`}
        className="flex min-w-0 flex-1 items-center gap-3 transition-opacity hover:opacity-80"
      >
        <Avatar name={entry.displayName} image={entry.image} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">
            {entry.displayName}
          </p>
          {entry.headline && (
            <p className="truncate text-xs text-muted">{entry.headline}</p>
          )}
          {entry.message && (
            <p className="mt-0.5 truncate text-xs italic text-muted">
              «{entry.message}»
            </p>
          )}
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        {busy === entry.connectionId ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted" />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function ConnectionsTab({
  connected,
  incoming,
  outgoing,
  busy,
  onRespond,
  onRemove,
  onMessage,
}: {
  connected: ConnEntry[];
  incoming: ConnEntry[];
  outgoing: ConnEntry[];
  busy: string | null;
  onRespond: (id: string, action: "accept" | "decline") => void;
  onRemove: (id: string) => void;
  onMessage: (userId: string) => void;
}) {
  if (
    connected.length === 0 &&
    incoming.length === 0 &&
    outgoing.length === 0
  ) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
        <Users className="mx-auto mb-3 h-8 w-8 text-muted/50" />
        <p className="text-sm text-muted">
          У вас пока нет связей. Найдите коллег во вкладке «Каталог».
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {incoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Входящие запросы ({incoming.length})
          </h2>
          <div className="space-y-2">
            {incoming.map((e) => (
              <ConnectionRow key={e.connectionId} entry={e} busy={busy}>
                <button
                  type="button"
                  onClick={() => onRespond(e.connectionId, "accept")}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg transition-colors hover:bg-primary-dark"
                >
                  <Check className="h-3.5 w-3.5" />
                  Принять
                </button>
                <button
                  type="button"
                  onClick={() => onRespond(e.connectionId, "decline")}
                  aria-label="Отклонить запрос"
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </ConnectionRow>
            ))}
          </div>
        </section>
      )}

      {connected.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Мои связи ({connected.length})
          </h2>
          <div className="space-y-2">
            {connected.map((e) => (
              <ConnectionRow key={e.connectionId} entry={e} busy={busy}>
                <button
                  type="button"
                  onClick={() => onMessage(e.userId)}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg transition-colors hover:bg-primary-dark"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Написать
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(e.connectionId)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
                >
                  Удалить
                </button>
              </ConnectionRow>
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Отправленные запросы ({outgoing.length})
          </h2>
          <div className="space-y-2">
            {outgoing.map((e) => (
              <ConnectionRow key={e.connectionId} entry={e} busy={busy}>
                <button
                  type="button"
                  onClick={() => onRemove(e.connectionId)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
                >
                  Отменить
                </button>
              </ConnectionRow>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProfileTab({
  profile,
  setProfile,
  saving,
  saved,
  onSave,
}: {
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  if (!profile) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  const field = (
    label: string,
    key: "displayName" | "headline" | "specialization",
    placeholder: string
  ) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        type="text"
        value={profile[key] ?? ""}
        onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex flex-1 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={profile.discoverable}
            onChange={(e) =>
              setProfile({ ...profile, discoverable: e.target.checked })
            }
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
          />
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Показывать меня в каталоге
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Пока флажок выключен, вас не видно в поиске — данные профиля
              никому не показываются. Включайте только по своему согласию.
            </span>
          </span>
        </label>
      </div>

      {field("Отображаемое имя", "displayName", "Как вас представить")}
      {field(
        "Краткое описание",
        "headline",
        "Например: Корпоративный юрист, 8 лет практики"
      )}
      {field(
        "Специализация",
        "specialization",
        "Например: Договорное право, M&A, недвижимость"
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">
          О себе
        </label>
        <textarea
          value={profile.bio ?? ""}
          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
          rows={4}
          placeholder="Опыт, направления работы, чем можете быть полезны коллегам"
          className="w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Сохранить профиль
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
            <Check className="h-4 w-4" />
            Сохранено
          </span>
        )}
      </div>

      <InnSection initial={profile} />
    </div>
  );
}

// ── ИНН linking ──────────────────────────────────────────────────────
// Two-tier: link an ИНН ("указан") then optionally upload an extract for
// an admin to confirm ("подтверждён"). Manages its own state — the INN
// endpoints are separate from the profile PUT, so it never clobbers the
// user's in-progress edits to the text fields above.

function InnSection({ initial }: { initial: Profile }) {
  const [status, setStatus] = useState(initial.innStatus);
  const [inn, setInn] = useState(initial.inn);
  const [companyName, setCompanyName] = useState(initial.innCompanyName);

  const [innInput, setInnInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function apply(p: Profile) {
    setStatus(p.innStatus);
    setInn(p.inn);
    setCompanyName(p.innCompanyName);
  }

  async function claim() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/network/profile/inn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn: innInput }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error ?? "Не удалось привязать ИНН");
        return;
      }
      apply(d.profile);
      setInnInput("");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/network/profile/inn", { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error ?? "Не удалось отвязать ИНН");
        return;
      }
      apply(d.profile);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted" />
        <h3 className="text-sm font-semibold text-foreground">
          ИНН организации
        </h3>
        {status === "verified" && (
          <span className="inline-flex items-center gap-1 rounded-md bg-success-light px-2 py-0.5 text-xs font-semibold text-success">
            <ShieldCheck className="h-3 w-3" />
            Подтверждён
          </span>
        )}
        {status === "claimed" && (
          <span className="inline-flex items-center gap-1 rounded-md bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary-dark">
            <BadgeCheck className="h-3 w-3" />
            Указан
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        Привяжите ИНН вашей компании или ИП — он показывается в профиле.
        Пока владение не подтверждено, это самодекларация: написать вам
        напрямую по этому ИНН контрагенты не смогут.
      </p>

      {err && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {err}
        </p>
      )}

      {status === "none" ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            inputMode="numeric"
            value={innInput}
            onChange={(e) => setInnInput(e.target.value)}
            placeholder="ИНН — 10 или 12 цифр"
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={claim}
            disabled={busy || innInput.trim().length === 0}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BadgeCheck className="h-4 w-4" />
            )}
            Привязать
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg bg-surface px-3 py-2">
            <p className="font-mono text-sm text-foreground">{inn}</p>
            {companyName && (
              <p className="text-xs text-muted">{companyName}</p>
            )}
          </div>

          {status === "claimed" && (
            <p className="flex items-start gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Подтверждение владения — через символический платёж с
              расчётного счёта компании: банк передаёт ИНН плательщика, он
              сверяется автоматически. Появится после запуска приёма
              платежей.
            </p>
          )}

          <button
            type="button"
            onClick={unlink}
            disabled={busy}
            className="text-xs font-medium text-muted underline transition-colors hover:text-danger disabled:opacity-50"
          >
            Отвязать ИНН
          </button>
        </div>
      )}
    </div>
  );
}

const SHARE_STATUS: Record<
  ShareSummary["status"],
  { label: string; cls: string }
> = {
  PENDING: { label: "Ожидает", cls: "bg-warning-light text-warning" },
  ACCEPTED: { label: "На ревью", cls: "bg-primary-light text-primary-dark" },
  DECLINED: { label: "Отклонено", cls: "bg-surface text-muted" },
  COMPLETED: { label: "Завершено", cls: "bg-success-light text-success" },
};

function ShareRow({ share, who }: { share: ShareSummary; who: string }) {
  const st = SHARE_STATUS[share.status];
  return (
    <Link
      href={`/network/shares/${share.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-surface/50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface">
        <FileText className="h-4 w-4 text-muted" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">
          {share.documentName}
        </p>
        <p className="truncate text-xs text-muted">{who}</p>
      </div>
      {share.commentCount > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
          <MessageSquare className="h-3.5 w-3.5" />
          {share.commentCount}
        </span>
      )}
      <span
        className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${st.cls}`}
      >
        {st.label}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}

function SharesTab({
  received,
  sent,
}: {
  received: ShareSummary[];
  sent: ShareSummary[];
}) {
  if (received.length === 0 && sent.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
        <FileText className="mx-auto mb-3 h-8 w-8 text-muted/50" />
        <p className="mx-auto max-w-md text-sm text-muted">
          Здесь появятся договоры на ревью. Чтобы отправить договор коллеге,
          откройте его анализ и нажмите «Отправить на ревью».
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {received.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Мне на ревью ({received.length})
          </h2>
          <div className="space-y-2">
            {received.map((s) => (
              <ShareRow
                key={s.id}
                share={s}
                who={`От: ${s.counterpart.displayName}`}
              />
            ))}
          </div>
        </section>
      )}
      {sent.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Я отправил ({sent.length})
          </h2>
          <div className="space-y-2">
            {sent.map((s) => (
              <ShareRow
                key={s.id}
                share={s}
                who={`Кому: ${s.counterpart.displayName}`}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

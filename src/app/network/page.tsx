"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
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
  AlertCircle,
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
}

type Tab = "directory" | "connections" | "profile";

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
  const [tab, setTab] = useState<Tab>("directory");

  // Directory
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState<DirEntry[]>([]);
  const [dirLoading, setDirLoading] = useState(false);

  // Connections
  const [connected, setConnected] = useState<ConnEntry[]>([]);
  const [incoming, setIncoming] = useState<ConnEntry[]>([]);
  const [outgoing, setOutgoing] = useState<ConnEntry[]>([]);

  // Profile
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Initial load: connections + own profile.
  useEffect(() => {
    void refreshConnections();
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

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "directory", label: "Каталог" },
    {
      id: "connections",
      label: "Связи",
      badge: incoming.length || undefined,
    },
    { id: "profile", label: "Мой профиль" },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main id="main-content" className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
              <Users className="h-5 w-5 text-primary-dark" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Сеть</h1>
              <p className="text-sm text-muted">
                Находите коллег, объединяйтесь в команды и отправляйте
                договоры на ревью.
              </p>
            </div>
          </div>

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
            />
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
      </main>
      <Disclaimer />
    </div>
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
              <div className="flex items-start gap-3">
                <Avatar name={e.displayName} image={e.image} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">
                    {e.displayName}
                  </p>
                  {e.headline && (
                    <p className="truncate text-xs text-muted">{e.headline}</p>
                  )}
                </div>
              </div>
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
}: {
  connected: ConnEntry[];
  incoming: ConnEntry[];
  outgoing: ConnEntry[];
  busy: string | null;
  onRespond: (id: string, action: "accept" | "decline") => void;
  onRemove: (id: string) => void;
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
    </div>
  );
}

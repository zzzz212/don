"use client";

// Header nav entry for the workspace team chat. Kept separate from the
// static `navigation` array in the header because it carries a live
// unread badge — it polls /api/workspace/chat/unread and re-checks on
// every route change (so the badge clears right after the chat is read).

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const HREF = "/workspace/chat";
const POLL_MS = 30_000;

export function WorkspaceChatNavLink({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(HREF);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/workspace/chat/unread")
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((d) => {
          if (!cancelled) setUnread(typeof d.count === "number" ? d.count : 0);
        })
        .catch(() => {
          /* header badge is best-effort */
        });
    };
    load();
    const handle = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [pathname]);

  const badge = unread > 0 ? (unread > 99 ? "99+" : String(unread)) : null;

  return (
    <Link
      href={HREF}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-lg font-medium transition-colors",
        mobile ? "gap-3 px-3 py-3 text-sm" : "px-3 py-2 text-sm",
        isActive
          ? "bg-primary-light text-primary-dark"
          : "text-muted hover:bg-surface hover:text-foreground"
      )}
    >
      <MessagesSquare
        className={mobile ? "h-5 w-5" : "h-4 w-4"}
        aria-hidden="true"
      />
      Чат компании
      {badge && (
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-fg"
          aria-label={`${unread} непрочитанных`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

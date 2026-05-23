"use client";

// Compact overflow dropdown — one trigger button, a dropdown list of
// items underneath. Modelled on AccountMenu's interaction loop so the
// app's dropdowns feel consistent: outside-click closes, Escape closes,
// AnimatePresence handles the open/close motion.
//
// Items can either fire an onClick (plain action) or link to an href
// (Next Link). Each item gets an icon + label. Disabled items render
// the same but don't trigger.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { buttonClass, type ButtonVariant, type ButtonSize } from "@/components/button";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export interface MenuItem {
  label: string;
  icon?: IconType;
  /** Action mode. Either onClick OR href, not both. */
  onClick?: () => void;
  href?: string;
  /** Renders the item dimmed and non-interactive. */
  disabled?: boolean;
  /** Danger-tinted hover (e.g. for delete). */
  danger?: boolean;
}

interface MenuButtonProps {
  /** Button label. Pair with `icon` for the standard look. */
  label: string;
  icon?: IconType;
  items: MenuItem[];
  /** Visual size / variant of the trigger button. Matches `<Button>` API. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Dropdown alignment. Defaults to `end` (right edge). */
  align?: "start" | "end";
  /** Accessible name override; default is `label`. */
  ariaLabel?: string;
  /** Optional badge node rendered inside the trigger after the label. */
  badge?: ReactNode;
}

export function MenuButton({
  label,
  icon: Icon,
  items,
  variant = "secondary",
  size = "sm",
  align = "end",
  ariaLabel,
  badge,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Outside-click + Escape — same pattern as AccountMenu / OrgSwitcher.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        className={buttonClass({ variant, size })}
      >
        {Icon && <Icon className="h-4 w-4" aria-hidden />}
        <span>{label}</span>
        {badge}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: -4,
              scale: 0.98,
              transition: { duration: 0.12 },
            }}
            transition={{
              type: "spring",
              stiffness: 600,
              damping: 40,
              mass: 0.6,
            }}
            style={{
              transformOrigin: align === "end" ? "top right" : "top left",
            }}
            className={`absolute top-full z-30 mt-2 min-w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl ${
              align === "end" ? "right-0" : "left-0"
            }`}
          >
            {items.map((item, i) => {
              const ItemIcon = item.icon;
              const baseCls =
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors text-left";
              const hoverCls = item.danger
                ? "hover:bg-danger-light hover:text-danger"
                : "hover:bg-surface";
              const cls = `${baseCls} ${
                item.disabled
                  ? "cursor-not-allowed opacity-50"
                  : `cursor-pointer ${hoverCls}`
              }`;

              if (item.href && !item.disabled) {
                return (
                  <Link
                    key={`${item.label}-${i}`}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={cls}
                  >
                    {ItemIcon && (
                      <ItemIcon className="h-4 w-4 text-muted" aria-hidden />
                    )}
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <button
                  key={`${item.label}-${i}`}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                  className={cls}
                >
                  {ItemIcon && (
                    <ItemIcon className="h-4 w-4 text-muted" aria-hidden />
                  )}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

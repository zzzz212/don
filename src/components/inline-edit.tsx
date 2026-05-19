"use client";

// Inline editable text. Renders as plain text by default; clicking the
// pencil affordance (or Enter / Space when focused) flips it into an
// input. Submit on Enter or blur, cancel on Escape.
//
// Used for the things users genuinely edit in place: workspace name,
// document title, profile display name. Forms remain elsewhere — this
// is for "fix the typo without leaving the page" moments.

import { useEffect, useId, useRef, useState } from "react";
import { Pencil, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "h1" | "h2" | "body";

const VARIANT_CLASSES: Record<Variant, string> = {
  h1: "text-2xl font-extrabold tracking-tight sm:text-3xl",
  h2: "text-xl font-bold",
  body: "text-base",
};

type Props = {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  variant?: Variant;
  placeholder?: string;
  maxLength?: number;
  minLength?: number;
  className?: string;
  /** Aria-label for the pencil button when not editing. */
  editLabel?: string;
};

export function InlineEdit({
  value,
  onSave,
  variant = "h1",
  placeholder = "",
  maxLength = 200,
  minLength = 1,
  className,
  editLabel = "Редактировать",
}: Props) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync the draft when value changes from the parent (e.g. after a
  // session refresh or a sibling edit).
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      // Small defer so the input is in the DOM before we try to focus.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed === value.trim()) {
      setEditing(false);
      setError(null);
      return;
    }
    if (trimmed.length < minLength) {
      setError(`Минимум ${minLength} символ${minLength === 1 ? "" : "а"}`);
      return;
    }
    if (trimmed.length > maxLength) {
      setError(`Максимум ${maxLength} символов`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      setEditing(false);
      setJustSaved(true);
      // Brief "✓ saved" affordance fades after 1.5s.
      setTimeout(() => setJustSaved(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setError(null);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={cn("relative inline-flex flex-col", className)}>
        <div className="inline-flex items-center gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            onBlur={() => {
              // Defer one tick so a click on Save / Cancel still fires.
              setTimeout(() => {
                if (editing && !saving) void commit();
              }, 100);
            }}
            placeholder={placeholder}
            disabled={saving}
            maxLength={maxLength + 10}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "rounded-lg border border-border bg-card px-2 py-1 text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60",
              VARIANT_CLASSES[variant]
            )}
          />
          {saving && (
            <Loader2
              className="h-4 w-4 shrink-0 animate-spin text-primary"
              aria-hidden="true"
            />
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <span
      className={cn(
        "group inline-flex items-baseline gap-2",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      <span className="text-foreground">{value || placeholder}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={editLabel}
        title={editLabel}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted opacity-0 transition-opacity hover:bg-surface hover:text-foreground focus:opacity-100 group-hover:opacity-100"
      >
        {justSaved ? (
          <Check className="h-4 w-4 text-success" aria-hidden="true" />
        ) : (
          <Pencil className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

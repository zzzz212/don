// Typography primitives for blog posts. Centralised so every post
// inherits the same heading scale, link colour, blockquote styling,
// and inline-CTA card without each body re-importing Tailwind classes.
//
// All built on the same design tokens as the rest of the site
// (oklch palette, Geist font) — keeps the blog visually contiguous
// with the product UI instead of looking like a tacked-on Medium
// embed.

import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";
import type { ReactNode } from "react";

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-base leading-relaxed text-foreground">{children}</p>
  );
}

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-12 mb-3 scroll-mt-24 text-2xl font-bold tracking-tight text-foreground"
    >
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="mt-8 mb-2 scroll-mt-24 text-lg font-bold text-foreground"
    >
      {children}
    </h3>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-foreground marker:text-muted">
      {children}
    </ul>
  );
}

export function OL({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-4 list-decimal space-y-2 pl-6 text-base leading-relaxed text-foreground marker:text-muted">
      {children}
    </ol>
  );
}

export function LI({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

export function Quote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="mt-6 border-l-4 border-primary/40 bg-primary-light/30 px-5 py-3 text-base italic leading-relaxed text-foreground">
      {children}
    </blockquote>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-surface px-1.5 py-0.5 text-[0.9em] font-mono text-foreground">
      {children}
    </code>
  );
}

export function A({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const external = /^https?:/.test(href);
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
    >
      {children}
    </Link>
  );
}

/** Article-internal CTA card. Used 1–2 times per post: once near the
 *  middle (when interest peaks) and once at the bottom. */
export function CTA({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="my-10 rounded-2xl border border-primary/30 bg-primary-light/40 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
            <Scale className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{title}</p>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function Callout({
  kind = "info",
  title,
  children,
}: {
  kind?: "info" | "warning" | "tip";
  title?: string;
  children: ReactNode;
}) {
  const palette =
    kind === "warning"
      ? "border-warning/40 bg-warning-light/30 text-warning"
      : kind === "tip"
        ? "border-success/40 bg-success-light/30 text-success"
        : "border-primary/30 bg-primary-light/30 text-primary-dark";
  return (
    <div className={`my-6 rounded-xl border px-4 py-3 ${palette}`}>
      {title && <p className="text-sm font-bold">{title}</p>}
      <p
        className={`${title ? "mt-1" : ""} text-sm leading-relaxed text-foreground`}
      >
        {children}
      </p>
    </div>
  );
}

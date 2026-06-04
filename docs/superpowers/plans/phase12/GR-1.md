### Task GR-1: Optional counterparty email + share-sheet (copy-link/Telegram/WhatsApp)

Make `counterpartyEmail` optional when creating a Deal Room: when absent, skip the invite email and keep the audit payload's `email` key conditional (foot-gun #26). Surface a share-sheet (copy-link already present + Telegram + WhatsApp deep links) in `SendAsDeal`, and branch the success copy on whether an email was actually sent. The only unit-testable logic is a new pure helper `buildShareLinks(url, title)` — route and component are thin glue (route is under `src/app/**`, excluded by `vitest.config.ts`; the component is JSX with no jsdom env, so neither gets a unit test).

**Files**
- create: `src/lib/deals-share.ts`, `src/lib/__tests__/deals-share.test.ts`
- modify: `src/lib/deals.ts` (make `counterpartyEmail` optional), `src/app/api/deals/route.ts` (optional schema + conditional email + conditional audit), `src/components/send-as-deal.tsx` (share-sheet + branched copy)
- test: `src/lib/__tests__/deals-share.test.ts`

Grounding notes from the real code:
- `CreateSchema` (`src/app/api/deals/route.ts:14-19`) currently hard-requires `counterpartyEmail: z.string().email()`.
- `createDealFromDocument` (`src/lib/deals.ts:21-28`, `:129`) declares `counterpartyEmail: string` and writes `guestEmail: args.counterpartyEmail`; the `guestEmail` column is already nullable (`prisma/schema.prisma:987`), so no migration is needed.
- Audit payload (`src/app/api/deals/route.ts:108-113`) unconditionally sets `email: counterpartyEmail`. `redact()` (`src/lib/audit.ts:158-171`) only masks keys that are present, so when there is no email we must OMIT the key entirely rather than pass `email: undefined`.
- `SendAsDeal` (`src/components/send-as-deal.tsx`) already has the copy-link button (lines 82-90) and hardcodes the "Письмо отправлено" success eyebrow (lines 68-76). The POST already returns `{ url, inviteToken }` (route.ts:115-119).

---

#### Step 1 — Failing test for `buildShareLinks` (pure core, full red-green-refactor TDD)

- [ ] Create the test file `src/lib/__tests__/deals-share.test.ts` with VERBATIM content:

```ts
import { describe, it, expect } from "vitest";
import { buildShareLinks } from "../deals-share";

describe("buildShareLinks", () => {
  const url = "https://yakso.ru/deal/abc123";
  const title = "Договор оказания услуг";

  it("builds a t.me/share link with url + text params", () => {
    const { telegram } = buildShareLinks(url, title);
    expect(telegram).toBe(
      "https://t.me/share/url?url=https%3A%2F%2Fyakso.ru%2Fdeal%2Fabc123" +
        "&text=" +
        encodeURIComponent(title)
    );
  });

  it("builds a wa.me link with the url folded into the text body", () => {
    const { whatsapp } = buildShareLinks(url, title);
    // WhatsApp has no separate url field — title and url go into one text body.
    expect(whatsapp).toBe(
      "https://wa.me/?text=" + encodeURIComponent(`${title} ${url}`)
    );
  });

  it("percent-encodes Cyrillic, spaces and reserved chars in the title", () => {
    const { telegram, whatsapp } = buildShareLinks(url, "Срок & оплата");
    expect(telegram).toContain("text=%D0%A1%D1%80%D0%BE%D0%BA%20%26%20%D0%BE%D0%BF%D0%BB%D0%B0%D1%82%D0%B0");
    expect(telegram).not.toContain(" ");
    expect(telegram).not.toContain("&text=Срок");
    expect(whatsapp).not.toContain(" ");
  });

  it("percent-encodes the url so query separators can't break the link", () => {
    const { telegram } = buildShareLinks("https://yakso.ru/deal/x?y=1", title);
    expect(telegram).toContain("url=https%3A%2F%2Fyakso.ru%2Fdeal%2Fx%3Fy%3D1");
    // The deal url's own ?/= must be encoded, not leak as outer query params.
    expect(telegram).not.toContain("/deal/x?y=1");
  });

  it("falls back to a generic title when given an empty string", () => {
    const { telegram, whatsapp } = buildShareLinks(url, "   ");
    const expected = encodeURIComponent("Договор на согласование");
    expect(telegram).toContain(`&text=${expected}`);
    expect(whatsapp).toContain(expected);
  });
});
```

- [ ] Run to fail (module does not exist yet):

```
npx vitest run src/lib/__tests__/deals-share.test.ts
```

Expect: failure resolving `../deals-share`.

#### Step 2 — Minimal implementation of `buildShareLinks`

- [ ] Create `src/lib/deals-share.ts` with VERBATIM content:

```ts
// Pure share-link builder for the Deal Room invite URL. When the sender
// skips the counterparty email (GR-1), the in-product share-sheet hands
// these deep links to Telegram / WhatsApp — the working channels for RU
// B2B contract correspondence. Kept pure + dependency-free so it carries
// a unit test (the SendAsDeal component lives under src/components with
// no jsdom env, and the route lives under src/app which vitest excludes).

export interface ShareLinks {
  telegram: string;
  whatsapp: string;
}

// Telegram's share endpoint takes a separate `url` and `text`; WhatsApp's
// wa.me has only a single `text` body, so the url is folded into the text.
export function buildShareLinks(url: string, title: string): ShareLinks {
  const safeTitle = title.trim() || "Договор на согласование";
  const telegram =
    "https://t.me/share/url?url=" +
    encodeURIComponent(url) +
    "&text=" +
    encodeURIComponent(safeTitle);
  const whatsapp =
    "https://wa.me/?text=" + encodeURIComponent(`${safeTitle} ${url}`);
  return { telegram, whatsapp };
}
```

- [ ] Run to pass:

```
npx vitest run src/lib/__tests__/deals-share.test.ts
```

Expect: all 5 tests pass.

- [ ] Gate + commit:

```
npx tsc --noEmit && npm test
git -c user.name="Claude" -c user.email="noreply@anthropic.com" add src/lib/deals-share.ts src/lib/__tests__/deals-share.test.ts
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Add pure buildShareLinks helper for Deal Room share-sheet

The counterparty-email requirement is about to become optional; when the
sender skips email the only working delivery channel is a hand-shared
link. Telegram/WhatsApp deep links are pure URL-encoding, so they live in
a unit-tested src/lib core rather than buried in the JSX share-sheet."
```

#### Step 3 — Make `counterpartyEmail` optional in the service layer (no unit test — exercised via tsc)

`createDealFromDocument` is a DB-touching function; per the test constraint we do not unit-test it (it needs a live Prisma client). The change is type-only widening, verified by `tsc`.

- [ ] In `src/lib/deals.ts`, change the interface field (lines 21-28). Replace:

```ts
export interface CreateDealArgs {
  ownerId: string;
  orgId: string;
  documentId: string;
  counterpartyEmail: string;
  counterpartyName?: string;
  title?: string;
}
```

with:

```ts
export interface CreateDealArgs {
  ownerId: string;
  orgId: string;
  documentId: string;
  // Optional: when the sender shares the link manually (Telegram/WhatsApp)
  // rather than by email, no address is collected. The guestEmail column
  // is nullable (schema.prisma:987), so the RECEIVER row simply starts
  // without one.
  counterpartyEmail?: string;
  counterpartyName?: string;
  title?: string;
}
```

- [ ] In the same file, fix the RECEIVER participant create (line 129). Replace:

```ts
            { role: "RECEIVER", guestEmail: args.counterpartyEmail, guestName: args.counterpartyName },
```

with:

```ts
            { role: "RECEIVER", guestEmail: args.counterpartyEmail ?? null, guestName: args.counterpartyName },
```

- [ ] Run to confirm the service layer still type-checks and existing tests are green:

```
npx tsc --noEmit && npx vitest run src/lib/__tests__/deals.test.ts
```

Expect: clean tsc, deals.test.ts green (it only covers `generateInviteToken` + `reconcileClauseStatus`, both untouched).

#### Step 4 — Route: optional email, conditional invite email, conditional audit key (untestable — src/app excluded)

This step edits `src/app/api/deals/route.ts`, which `vitest.config.ts` excludes (`src/app/**`). No unit test — correctness is carried by the `tsc` gate plus the already-tested `buildShareLinks` core. The route is thin glue.

- [ ] Make the schema field optional. Replace (lines 14-19):

```ts
const CreateSchema = z.object({
  documentId: z.string().min(1),
  counterpartyEmail: z.string().email(),
  counterpartyName: z.string().trim().max(120).optional(),
  message: z.string().trim().max(500).optional(),
});
```

with:

```ts
const CreateSchema = z.object({
  documentId: z.string().min(1),
  // Optional: a sender who shares the link via Telegram/WhatsApp instead
  // of email never supplies an address. `.email()` still validates the
  // format when one IS provided. Empty string is normalised to undefined
  // so the client can send "" without tripping the email-format check.
  counterpartyEmail: z
    .string()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  counterpartyName: z.string().trim().max(120).optional(),
  message: z.string().trim().max(500).optional(),
});
```

- [ ] Make the invite email fire-and-forget conditional on having an address, and report back whether it was sent. Replace (lines 93-103):

```ts
    // Fire-and-forget invite email — failures land in Sentry via
    // sendEmail's internal handler.
    void sendEmail(
      buildDealInviteEmail({
        to: counterpartyEmail,
        fromName: session.user.name ?? session.user.email ?? "Пользователь",
        documentName: fullDeal?.title ?? "Договор",
        dealUrl: `${BRAND.publicUrl}/deal/${deal.inviteToken}`,
        message,
      })
    );
```

with:

```ts
    // Fire-and-forget invite email — only when an address was supplied.
    // Without one, the sender shares the link manually (Telegram/WhatsApp)
    // from the success share-sheet. Failures land in Sentry via
    // sendEmail's internal handler.
    if (counterpartyEmail) {
      void sendEmail(
        buildDealInviteEmail({
          to: counterpartyEmail,
          fromName: session.user.name ?? session.user.email ?? "Пользователь",
          documentName: fullDeal?.title ?? "Договор",
          dealUrl: `${BRAND.publicUrl}/deal/${deal.inviteToken}`,
          message,
        })
      );
    }
```

- [ ] Make the audit `email` key conditional. `redact()` only masks keys that are present, so omit the key entirely when there is no email — never pass `email: undefined` (foot-gun #26). Replace (lines 105-113):

```ts
    // Key name `email` (not `counterpartyEmail`) so `redact()` masks it
    // in the audit log per foot-gun #26 — SENSITIVE_KEYS matches exact
    // key names, not substrings.
    await logAudit({
      action: "deal.created",
      userId: me,
      orgId,
      payload: { dealId: deal.id, email: counterpartyEmail, clauseCount },
    });
```

with:

```ts
    // Key name `email` (not `counterpartyEmail`) so `redact()` masks it
    // in the audit log per foot-gun #26 — SENSITIVE_KEYS matches exact
    // key names, not substrings. Spread it in only when present so the
    // log doesn't carry an `email: undefined` for link-shared deals.
    await logAudit({
      action: "deal.created",
      userId: me,
      orgId,
      payload: {
        dealId: deal.id,
        clauseCount,
        ...(counterpartyEmail ? { email: counterpartyEmail } : {}),
      },
    });
```

- [ ] Surface `emailSent` in the response so the client can branch its success copy. Replace (lines 115-119):

```ts
    return NextResponse.json({
      dealId: deal.id,
      inviteToken: deal.inviteToken,
      url: `${BRAND.publicUrl}/deal/${deal.inviteToken}`,
    });
```

with:

```ts
    return NextResponse.json({
      dealId: deal.id,
      inviteToken: deal.inviteToken,
      url: `${BRAND.publicUrl}/deal/${deal.inviteToken}`,
      emailSent: Boolean(counterpartyEmail),
    });
```

- [ ] Run the gate:

```
npx tsc --noEmit && npm test
```

Expect: clean tsc (the `createDealFromDocument` call at lines 56-62 still passes `counterpartyEmail`, now typed `string | undefined`, matching the widened `CreateDealArgs`), all tests green.

#### Step 5 — Component: optional-email field + share-sheet + branched success copy (untestable — JSX, no jsdom)

This step edits `src/components/send-as-deal.tsx`. There is no jsdom test environment configured (`vitest.config.ts` → `environment: "node"`), so the component carries no unit test; the share-link logic it renders is already unit-tested in `buildShareLinks`. The component is thin glue over that core.

- [ ] Add the import for the helper. Replace (lines 8-9):

```ts
import { useState } from "react";
import { Button, buttonClass } from "@/components/button";
```

with:

```ts
import { useState } from "react";
import { Button, buttonClass } from "@/components/button";
import { buildShareLinks } from "@/lib/deals-share";
```

- [ ] Widen the result state to carry whether the email was sent + the deal title. Replace (line 22):

```ts
  const [result, setResult] = useState<{ url: string } | null>(null);
```

with:

```ts
  const [result, setResult] = useState<{ url: string; emailSent: boolean } | null>(null);
```

- [ ] Read `emailSent` from the response. Replace (lines 46-47):

```ts
      const data = (await res.json()) as { url: string };
      setResult({ url: data.url });
```

with:

```ts
      const data = (await res.json()) as { url: string; emailSent?: boolean };
      setResult({ url: data.url, emailSent: Boolean(data.emailSent) });
```

- [ ] Replace the entire success state block (lines 65-99 — from `{result ? (` through the closing `</div>` of that branch, i.e. up to but not including the `) : (` on line 100) so the copy branches on `emailSent` and the share-sheet renders Telegram/WhatsApp alongside copy-link. Replace:

```tsx
        {result ? (
          /* ── Success state ─────────────────────────────────────── */
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-ink-quiet">
              Письмо отправлено
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
              Сделка создана
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-quiet">
              Контрагент получит письмо со ссылкой. Если хотите — скопируйте
              её и передайте напрямую.
            </p>
            <div className="mt-6 border border-rule bg-surface/40 px-4 py-3 font-mono text-[12px] leading-[1.5] text-foreground/80 break-all rounded-md">
              {result.url}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(result.url);
                }}
                className={buttonClass({ variant: "primary" })}
              >
                Скопировать ссылку
              </button>
              <button
                type="button"
                onClick={onClose}
                className={buttonClass({ variant: "ghost" })}
              >
                Закрыть
              </button>
            </div>
          </div>
        ) : (
```

with:

```tsx
        {result ? (
          /* ── Success state ─────────────────────────────────────── */
          (() => {
            // Share-sheet links are built from the returned deal URL. The
            // title is the contract name typed by the sender (falls back
            // to a generic label inside buildShareLinks when blank).
            const share = buildShareLinks(result.url, name.trim());
            return (
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-ink-quiet">
                  {result.emailSent ? "Письмо отправлено" : "Ссылка готова"}
                </p>
                <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
                  Сделка создана
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-quiet">
                  {result.emailSent
                    ? "Контрагент получит письмо со ссылкой. Если хотите — передайте её и напрямую."
                    : "Скопируйте ссылку или отправьте её контрагенту в мессенджере. Логин ему не понадобится."}
                </p>
                <div className="mt-6 border border-rule bg-surface/40 px-4 py-3 font-mono text-[12px] leading-[1.5] text-foreground/80 break-all rounded-md">
                  {result.url}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(result.url);
                    }}
                    className={buttonClass({ variant: "primary" })}
                  >
                    Скопировать ссылку
                  </button>
                  <a
                    href={share.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass({ variant: "ghost" })}
                  >
                    Telegram
                  </a>
                  <a
                    href={share.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass({ variant: "ghost" })}
                  >
                    WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    className={buttonClass({ variant: "ghost" })}
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
```

- [ ] Make the email input optional in the form state: relabel it and drop the submit-disable on empty email. Replace (lines 114-120):

```tsx
            <div className="mt-6">
              <label
                htmlFor="deal-counterparty-email"
                className="block text-[10px] uppercase tracking-[0.22em] text-ink-quiet mb-1.5"
              >
                Email контрагента
              </label>
```

with:

```tsx
            <div className="mt-6">
              <label
                htmlFor="deal-counterparty-email"
                className="block text-[10px] uppercase tracking-[0.22em] text-ink-quiet mb-1.5"
              >
                Email контрагента — необязательно
              </label>
```

- [ ] Drop the empty-email guard on the submit button so a link-only deal can be created. Replace (lines 173-181):

```tsx
            <Button
              variant="primary"
              loading={submitting}
              onClick={() => void submit()}
              disabled={!email.trim() || submitting}
              className="mt-6 w-full"
            >
              {submitting ? "Отправляем…" : "Отправить"}
            </Button>
```

with:

```tsx
            <Button
              variant="primary"
              loading={submitting}
              onClick={() => void submit()}
              disabled={submitting}
              className="mt-6 w-full"
            >
              {submitting ? "Создаём…" : email.trim() ? "Отправить" : "Создать ссылку"}
            </Button>
```

- [ ] Run the gate (tsc must stay clean; the `name` variable is already in scope from `useState` at line 19, so the success-branch IIFE compiles):

```
npx tsc --noEmit && npm test
```

Expect: clean tsc, full suite green.

#### Step 6 — Commit the route + service + component glue

- [ ] Final gate before commit:

```
npx tsc --noEmit && npm test
```

- [ ] Commit:

```
git -c user.name="Claude" -c user.email="noreply@anthropic.com" add src/lib/deals.ts src/app/api/deals/route.ts src/components/send-as-deal.tsx
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "Make Deal Room counterparty email optional + add share-sheet

Resend is non-functional in prod, and RU B2B contract correspondence runs
in Telegram/WhatsApp, not email. Drop the mandatory email: when absent we
skip the invite email and omit the audit email key (foot-gun #26 — never
log email: undefined). SendAsDeal now exposes copy-link + Telegram +
WhatsApp from the returned URL and branches the success copy on whether
a message was actually mailed. guestEmail is already nullable, so no
migration."
```

---

**Sequencing for the controller.** This task is self-contained (`dependsOn: []`). It shares three files with other Deal Room tasks: `src/lib/deals.ts`, `src/app/api/deals/route.ts`, `src/components/send-as-deal.tsx`. In particular DR-2 (PostHog funnel instrumentation) also edits `src/app/api/deals/route.ts`, and DR-1 touches the receiver/deal-room surface; serialise GR-1 ahead of or after those rather than in parallel to avoid edit conflicts in the route file. The new `src/lib/deals-share.ts` + its test are conflict-free.
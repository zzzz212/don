# Sprint 15B — Deal Room Evolution (Sub-B)

**Дата**: 2026-05-26
**Статус**: design draft — under review
**Ветка**: `claude/sprint-15b-design` (от `claude/sprint-8-ui-polish`)
**Предыдущий spec**: [Sprint 15A — Durable Analyze](./2026-05-24-sprint-15a-durable-analyze-and-killer-features.md)

## Контекст

Sprint 14 поставил Deal Room MVP (anonymous receiver flow, Counter-AI
inference, agree/disagree/comment per-clause). Sprint 15A добавил
killer fix'и (durable analyze + AI negotiation moves + ICS). Sprint
15A.1 закрыл final-review hangovers.

Sub-B — **эволюция Deal Room'а от MVP к полноценному negotiation
artifact'у**. Три independent vertical slices, объединённые тем что
все три повышают одну метрику: **процент Deal'ов которые доходят до
терминального состояния** (AGREED, DECLINED, или EXPIRED — НЕ
застрянут навсегда в ACTIVE с одним unresolved clause).

Sub-B НЕ включает: realtime presence, inbox dashboard, sidebar reorg —
это Sub-C.

## Проблемы, которые закрываем

### 1. Counter-AI односторонний

Sprint 14 Counter-AI инференсит «вторую сторону» из текста договора —
**предполагает** что receiver хотел бы видеть, основываясь на
sender'ской позиции. Это полезно как initial hint, но НЕ симметрично:

- Receiver не может ввести свою реальную позицию
- AI assessment остаётся через призму sender'а
- Negotiation moves (Sprint 15A) тоже работают с sender's assumptions

В итоге Deal Room — это «sender пользует AI чтобы предугадать
позицию receiver'а», а не «обе стороны ведут AI-supported negotiation».
Это разрыв между маркетинговым обещанием («двусторонняя переговорная»)
и реальной мотиваторностью продукта.

### 2. Deal без выхода

Sprint 14 имеет два терминальных статуса: ACTIVE (in-flight) и AGREED
(всё согласовано). Между ними застрявший Deal **не имеет способа
выйти**:

- Receiver не хочет соглашаться → DISAGREE на одну clause, и Deal
  навечно в ACTIVE with DISPUTED clauses
- Receiver просто исчезает (не открывает invite неделю) → Deal остаётся
  ACTIVE до тепловой смерти Вселенной
- Sender передумал отправлять → нет способа annulировать

В админке (или просто в dashboard'е Active Deals) это создаёт длинный
хвост «зомби-Deal'ов» которые пугают новых пользователей («что у меня
тут — 8 активных переговоров?»). Cleanup'а нет.

### 3. AGREED — мёртвый финал

Когда обе стороны AGREE'нули все clauses — Deal статус flips в AGREED
и... всё. Никакого артефакта пользователь не получает:

- Нет финального DOCX/PDF где все proposed edits применены
- Нет audit-trail'а (кто/когда/что подтвердил) — критично для будущих
  споров
- Нет email обеим сторонам с приложениями
- Нет ICS события «Deal AGREED on YYYY-MM-DD»

Это особенно слабо потому что AGREED — это **момент платежа** (или
момент когда можно требовать оплату): юр-обоснования для bookkeeping'а
ноль.

## Архитектура

Три независимых vertical slice'а с собственным data model'ом, UI и
API. Каждый — кандидат на отдельный PR.

### B1 — DECLINED / EXPIRED статусы

**Сложность**: low. Один enum-сдвиг, UX для двух кнопок, cron'для TTL.

**Schema**:
```prisma
enum DealStatus {
  ACTIVE
  AGREED
  DECLINED   // NEW — receiver или sender отверг сделку целиком
  EXPIRED    // NEW — TTL вышел без AGREED/DECLINED
}

model Deal {
  // existing fields unchanged
  ...
  expiresAt DateTime?  // NEW — null = не expires; ставится при creation
  declinedAt DateTime? // NEW — таймстамп DECLINE
  declinedBy String?   // NEW — DealParticipant.id который инициировал DECLINE
  declineReason String? // NEW — optional текст от инициатора
}
```

**Default TTL**: 30 дней с creation. Конфиг через env `DEAL_TTL_DAYS`
(дефолт 30). Sender может override per-deal через UI при создании.

**API**:
```
POST /api/deals/[id]/decline                    [sender]
POST /api/deals/by-token/[token]/decline        [receiver]
  Body: { reason?: string }  // optional
  Auth: workspace member (sender) | session cookie (receiver)
  Effects:
    - UPDATE Deal SET status=DECLINED, declinedAt=now(), declinedBy=$me, declineReason=$reason
      WHERE id=? AND status='ACTIVE'   ← terminal state guard
    - logAudit('deal.declined', {dealId, role, reason redacted})
    - sendEmail to other side: buildDealDeclinedEmail
  Rate limit: deals.action (60/min) уже существует
  Idempotent: повторный POST после DECLINE → 409 Already declined

POST /api/deals/[id]/extend                     [sender только]
  Body: { days: number }  // 1-90
  Auth: workspace member
  Effects: UPDATE Deal SET expiresAt = expiresAt + $days * 86400
  Why: продлить TTL когда переговоры активны но медленнее чем ожидали
```

**Creation-time TTL override**: расширяется существующий
`POST /api/deals` body опциональным полем `ttlDays?: number` (1-90,
дефолт из `DEAL_TTL_DAYS` env). Validation через zod в same handler.
`createDealFromDocument(...)` принимает `ttlDays` и сетит `expiresAt =
now() + ttlDays * 86400`.

**Cron**:
```
/api/cron/expire-stale-deals  // daily at 06:00 UTC (09:00 MSK)
  Auth: Authorization: Bearer $CRON_SECRET
  Logic:
    SELECT id, ownerId, orgId FROM Deal
      WHERE status='ACTIVE' AND expiresAt < now()
    FOR EACH:
      UPDATE Deal SET status=EXPIRED
      sendEmail to sender: buildDealExpiredEmail
      sendEmail to receiver (если есть email): buildDealExpiredEmail
      logAudit('deal.expired', {dealId})
```

`vercel.json` cron addition:
```json
{ "path": "/api/cron/expire-stale-deals", "schedule": "0 6 * * *" }
```

**UI**:
- `/deal/[token]` (receiver) — кнопка «Отклонить предложение» в footer
  (рядом с identify card). Confirmation modal: «Уверены? Это нельзя
  откатить.» + optional reason text field.
- `/deal/[id]` (sender) — overflow menu: «Отозвать предложение»
  (same DECLINE handler, role=sender), «Продлить срок» (extend modal).
- Status badge сверху: ACTIVE shows expires-in countdown («Истекает через
  14 дней»), AGREED shows checkmark, DECLINED shows красный crossmark
  с reason, EXPIRED shows истёкший clock с возможностью «Создать
  заново».
- Dashboard Active Deals список фильтрует terminal-state deals в
  отдельную секцию «Завершённые» (collapsed by default).

**Reconciliation**:
- `reconcileClauseStatus` НЕ ТРОГАЕТ deal status если он DECLINED|EXPIRED
  (terminal-state guard). Existing clause action POST endpoints должны
  проверять `if (deal.status in (DECLINED, EXPIRED)) return 410 Gone`
  ДО reconciliation — receiver не должен мочь AGREE/DISAGREE на
  declined Deal.

**Email шаблоны**:
- `buildDealDeclinedEmail({recipientRole, dealTitle, declinerName,
  reason?})` — простой editorial шаблон, factual tone
- `buildDealExpiredEmail({recipientRole, dealTitle})` — same factual,
  CTA «Создать новое предложение» (sender) или «Связаться с отправителем»
  (receiver)

**Тесты**:
- `decline-deal-route.test.ts` — happy path, idempotency, terminal-state
  guard, anonymous receiver auth
- `expire-stale-deals-cron.test.ts` — selects only ACTIVE past expiry,
  marks EXPIRED, sends emails (mocked)
- `deal-status-reconciliation.test.ts` — terminal-state guard

**Сложность**: ~150-200 LOC + tests, ~6-8 коммитов, **2-3 дня**.

---

### B2 — Real two-sided Counter-AI

**Сложность**: medium-high. Schema, новый AI prompt, receiver input UI,
re-balance flow.

**Schema**:
```prisma
model DealClause {
  // existing fields
  ...
  receiverInput  Json?    // NEW: { position: string, concerns: string[] }
  rebalancedAt   DateTime? // NEW: last AI re-balance timestamp
}
```

`receiverInput` shape — zod:
```ts
const ReceiverInputSchema = z.object({
  position: z.string().min(1).max(2000),
  concerns: z.array(z.string().min(1).max(500)).max(5),
});
```

**AI prompt + schema**:

Новый prompt `REBALANCE_CLAUSE_PROMPT` (~400 токенов) в
`src/lib/ai/prompts.ts`. Inline-style без top-level JSON примера
(foot-gun #51). Принимает:
- Original clause text
- Sender perspective (existing `yourSide` JSON)
- Receiver position и concerns (новый `receiverInput`)

Возвращает новый `yourSide` + `theirSide` где обе стороны отражают
**real positions обеих сторон**, не AI-инференс sender's view of
receiver.

Schema `RebalancedClauseSchema` в `src/lib/ai/schemas/rebalance.ts`:
```ts
export const RebalancedClauseSchema = z.object({
  yourSide: z.object({
    description: z.string(),
    consequence: z.string(),
    recommendation: z.string(),
    legalReference: z.string().optional(),
  }),
  theirSide: z.object({
    theirGain: z.string(),
    theirConcern: z.string(),
    compromise: z.string().optional(),
  }),
  conflictLevel: z.enum(["aligned", "negotiable", "deadlocked"]),
});
```

Tier: `pickTier("chat", plan)` — FREE→Haiku, PRO+→Sonnet. Cost
estimate: ~1500 input + ~500 output на one rebalance. Haiku ~$0.005,
Sonnet ~$0.025.

**API**:
```
POST /api/deals/[id]/clauses/[clauseId]/rebalance       [sender]
POST /api/deals/by-token/[token]/clauses/[clauseId]/rebalance [receiver]
  Auth: workspace member (sender) | session cookie (receiver)
  Effects:
    - Server-side check: clause.receiverInput != null (нельзя rebalance
      без receiver input — иначе вернёмся к Sprint 14 Counter-AI)
    - terminal-state guard (deal.status not in DECLINED|EXPIRED)
    - AI call: REBALANCE_CLAUSE_PROMPT with current state
    - UPDATE DealClause SET yourSide=$new, theirSide=$new, rebalancedAt=now()
    - НЕ инвалидируем suggestedMoves cache — moves остаются актуальны до
      нового user action
  Rate limit: 'negotiation.rebalance' (5/min) — дороже чем suggest-moves
  Quota:
    - FREE: 3 rebalance / day / deal (через AiUsage feature='rebalance')
    - PRO+: 20 / day / deal (мягкий cap, защита от runaway)
    - logUsage(deal.ownerId, deal.orgId, ...) — sender'у атрибутируется
      даже когда receiver инициировал (foot-gun #60 pattern)
```

**Trigger flow**:
1. Receiver opens DISPUTED clause → видит блок «Ваша позиция» с
   text-input. Editorial inline form, не модалка.
2. Receiver вводит position + до 5 concerns → POST identify-like
   endpoint:
   ```
   POST /api/deals/by-token/[token]/clauses/[clauseId]/receiver-input
     Body: { position, concerns }
   ```
   который сохраняет в `DealClause.receiverInput` + не триггерит AI.
3. Sender (или сам receiver на refresh) видит «Получить обновлённый
   анализ ИИ» button под clause → POST rebalance → spinner →
   `yourSide`/`theirSide` обновлены.
4. UI рендерит compare-mode: «было» (greyed) → «стало» (terracotta
   accent) на первый просмотр после rebalance.

**UI**:
- Новый компонент `<ReceiverPositionInput>` для receiver-side в
  `/deal/[token]/clause-card.tsx`. Текстовый input + chips для
  concerns. Save button. Editorial paper-feel, bottom-border-only input.
- Новый компонент `<RebalanceTrigger>` — кнопка с спиннер-state.
  Disabled когда `receiverInput == null`.
- Обновлённая `<ClausePerspectives>` — два side-by-side blocks с visual
  conflict-level indicator (aligned: sage rule; negotiable: terracotta
  hairline; deadlocked: warm-burgundy double rule).
- Sender's view: marginalia note «Receiver position обновлена X дней
  назад» рядом с DISPUTED clause.

**Reconciliation с suggested-moves**:
Negotiation moves (Sprint 15A killer #1) тоже должны учитывать
`receiverInput` если оно есть. Update `NEGOTIATION_MOVES_PROMPT`:
include receiver position/concerns в context когда они есть. Tests на
prompt rendering должны покрыть обе ветви (with/without receiverInput).

**Migration risk**: schema-level — `receiverInput` nullable + new
field, `rebalancedAt` nullable + new. Zero data-loss migration. Existing
deals имеют receiverInput=null → rebalance endpoint вернёт 425 «Сначала
введите свою позицию» — это правильный UX.

**Тесты**:
- `rebalance-clause-route.test.ts` — happy path, gate on receiverInput
  null, terminal-state guard, FREE quota
- `receiver-input-route.test.ts` — session auth, validation, idempotent
  update
- `rebalance-schema.test.ts` — zod validation
- `rebalance-prompt.test.ts` — prompt rendering with/without receiverInput

**Сложность**: ~500-700 LOC + tests, ~10-12 коммитов, **5-7 дней**.

---

### B3 — Audit-trail PDF при AGREED

**Сложность**: medium. PDF generation (новая зависимость), DOCX combo,
email attachment, storage.

**Trigger**: AGREED transition в `reconcileClauseStatus` →
`promoteDealStatus`. Existing flow:
1. Last clause flips to AGREED
2. `reconcileClauseStatus` returns AGREED
3. Deal status updates to AGREED
4. **NEW**: fire-and-forget background job `generateDealClosure(dealId)`

**Что генерится**:

1. **Final DOCX** — original договор с применёнными PROPOSE_EDIT
   actions. Используем существующий `docx` библиотеку (templates).
   Структура: header (Deal title, AGREED date, participants), body
   (полный текст с applied edits highlighted).

2. **Audit-trail PDF** — отдельный документ:
   - Frontispiece (terracotta + warm-ink editorial style)
   - Timeline per-clause: каждое ClauseAction в хронологическом порядке
     с участником, временем, типом (AGREE/DISAGREE/COMMENT/PROPOSE_EDIT),
     текстом если есть
   - Footer: cryptographic hash final DOCX (SHA-256) для evidentiary
     значения

**PDF library decision**:

Three options considered:
- **`@react-pdf/renderer`**: JSX-style, well-maintained. Bundles
  font/layout primitives. Bigger bundle (~200KB) но не критично для
  server-only usage.
- **`pdfkit`**: imperative, smaller (~80KB), но truly painful для
  layout сложнее одной колонки.
- **Puppeteer + HTML → PDF**: zero new format dependencies (мы уже HTML
  везде), но добавляет chromium binary на Vercel (>50MB, выходит за
  function size limits).

**Решение**: `@react-pdf/renderer`. JSX style consistent с проектом.
Server-only — bundle size не влияет на client.

**Storage**:

Vercel Blob (уже есть для original PDF uploads):
```
deals/<dealId>/closure-final.docx
deals/<dealId>/closure-audit.pdf
```

URLs хранятся в:
```prisma
model Deal {
  // existing fields
  ...
  closureDocxUrl  String?  // NEW
  closureAuditUrl String?  // NEW
  closureSha256   String?  // NEW — hash of final DOCX for evidentiary value
  closedAt        DateTime? // NEW — when AGREED transition happened
}
```

**Email шаблон**:

`buildDealAgreedEmail({recipientRole, dealTitle, participants,
docxUrl, auditUrl, sha256})` — editorial, two attachments via Resend
(supports up to 40MB total per email).

CTA в emaile: «Скачать договор» + «Скачать audit-trail». Plus
plain-text fallback с links.

**Background job**:

```ts
// src/lib/deals/closure.ts
export async function generateDealClosure(dealId: string): Promise<void> {
  // Idempotent: skip if closureSha256 already set
  // Generate DOCX (apply PROPOSE_EDIT actions to original text)
  // Generate audit-trail PDF
  // Compute SHA-256 of DOCX
  // Upload both to Blob
  // Update Deal with URLs + hash + closedAt
  // Send emails to sender + receiver
  // logAudit('deal.closed', {dealId, sha256})
}
```

Triggered fire-and-forget from clause action endpoint when AGREED
transition happens. **Defended за DB-уровне**: только одна успешная
запись closureSha256 (where closureSha256 IS NULL) — повторные
запуски noop.

**API**:

```
GET /api/deals/[id]/closure          [sender]
GET /api/deals/by-token/[token]/closure  [receiver]
  Auth: workspace member | session cookie
  Returns: { docxUrl, auditUrl, sha256, closedAt }
  Effect: redirect к Blob URL (signed) или возврат signed URLs
  Gate: 404 if deal.status != AGREED
```

UI integration:
- `/deal/[token]` AGREED состояние — large editorial card с двумя
  download кнопками
- Dashboard AGREED deals — download icon
- Email → links

**Тесты**:
- `closure-generation.test.ts` — pure functions: build DOCX from
  base text + actions, render PDF (snapshot test), compute SHA-256
- `closure-job.test.ts` — idempotency, error handling
- `closure-route.test.ts` — auth, status gate

**Сложность**: ~600-800 LOC + tests, ~12-15 коммитов, **5-7 дней**.

---

## Слой email

Новые шаблоны (`src/lib/email/`):
- `deal-declined.ts` — DECLINED notification (B1)
- `deal-expired.ts` — EXPIRED notification (B1)
- `deal-agreed.ts` — AGREED + attachments (B3)

Каждый через существующий `renderEmailHtml` layout helper. Inline CSS,
HTML escape user-controlled fields (declineReason!), follow Sprint 13
warm-minimalism palette (foot-gun #43 не применимо к email).

## Что НЕ входит в Sub-B (out-of-scope)

- Inbox dashboard / sidebar 6→3 / realtime presence → Sub-C
- Real-time WebSocket presence cursors → Sub-C
- Mobile push notifications → отдельный sprint
- Multi-language email templates (RU only пока) → отдельный sprint
- Custom TTL per-clause (not just per-deal) → premature
- Multi-participant deals (>2 sides) → premature

## Риски и unknowns

- **`@react-pdf/renderer` build size on Vercel**: новая dependency
  ~5-8MB unpacked. Tested на Vercel Pro plan — function size cap 50MB
  для серверной части. Не должно дотянуть, но мониторить.
- **DOCX combo при многочисленных PROPOSE_EDIT**: если receiver сделал
  10 edits — final DOCX будет иметь много diff markers. Decision: для
  v1 применяем edits «as-is» (как final text). В Sub-C можно добавить
  redline view (show insertion/deletion).
- **Email attachment size**: PDF audit-trail может быть длинным (50+
  clauses × actions). Pdf-kit-style легко 1-2MB. Resend cap 40MB total
  — далеко от limit'а, но для UX лучше держать audit под 500KB.
- **Rebalance cost runaway**: PRO+ unlimited — если deal на 30 clauses
  и 10 раз rebalance каждой — 300 calls × Sonnet ~$10/deal. Hard cap
  20/day/deal + soft monitoring через `AiUsage feature='rebalance'`.
- **Time zones в expires-at**: Vercel cron 06:00 UTC = 09:00 MSK. Это
  ОК для российской аудитории, но email отправляется ровно тогда же —
  на работе. Не критично, но рассмотреть batching.
- **AGREED reversibility**: если после AGREED одна сторона хочет
  отменить — currently impossible (terminal state). Decision: keep
  terminal. Если кто-то хочет re-negotiate — создаёт новый Deal.

## Acceptance criteria

Sub-B считается завершённым когда:

**B1 — DECLINED / EXPIRED**:
1. Sender или receiver жмут «Отклонить» → Deal flips в DECLINED,
   email уходит другой стороне, reason (если введён) escaped в email
2. `expiresAt` set at creation (default 30d). Cron в 06:00 UTC
   находит overdue ACTIVE deals → flips в EXPIRED, emails sent.
3. После DECLINED/EXPIRED — clause action endpoints возвращают 410
   Gone. AGREE/DISAGREE невозможны.
4. Dashboard shows terminal-state deals в «Завершённые» секции
   collapsed by default.
5. Sender может extend TTL на ACTIVE deal через +30 days модалку.

**B2 — Two-sided Counter-AI**:
6. Receiver открывает DISPUTED clause → видит «Ваша позиция» input
   с placeholder text «Опишите своё видение этой статьи»
7. Receiver вводит position + до 5 concerns → SAVE → server
   persists в `DealClause.receiverInput`
8. Sender или receiver жмут «Получить обновлённый анализ ИИ» →
   ~5с спиннер → `yourSide`/`theirSide` обновлены к real
   two-sided assessment
9. `conflictLevel` визуально отражается: aligned (sage), negotiable
   (terracotta), deadlocked (warm-burgundy)
10. Negotiation moves (Sprint 15A killer #1) тоже учитывают
    `receiverInput` в prompt context — verifiable через test render
11. FREE quota: 3 rebalance / day / deal — 4-й возвращает 429 с
    upgrade CTA

**B3 — Audit-trail PDF при AGREED**:
12. При AGREED transition — background job триггерится
    fire-and-forget, не блокирует HTTP response
13. Через 5-15с — Deal имеет `closureDocxUrl` + `closureAuditUrl`
    + `closureSha256` set
14. Both participants получают email с двумя attachment'ами +
    inline download links
15. Идемпотентность: повторный AGREED transition (например, после
    cancel→re-agree цикла в гипотетическом будущем UX) НЕ
    создаёт duplicate artifacts — закрытие уже произошло
16. Final DOCX SHA-256 совпадает с записанным в БД (evidentiary
    integrity)

**Cross-cutting**:
17. `tsc --noEmit && npm test && npx next build` — все зелёные,
    тесты покрытие минимум 442 baseline + ~30 новых
18. Backwards-compatible migration: zero data-loss, existing deals
    получают defaults (expiresAt=null = no expiry для legacy)

## Sequencing — порядок реализации

Каждый sub-feature — отдельный PR. Sequential implementation:

**Phase B1 — DECLINED / EXPIRED** (PR #9):
1. Schema migration (enum + 4 fields на Deal)
2. Email шаблоны (declined + expired)
3. POST decline endpoints (sender + receiver)
4. POST extend endpoint
5. Cron expire-stale-deals
6. UI: decline button (receiver), overflow «Отозвать»/«Продлить»
   (sender), status badges, dashboard collapsed section
7. Tests + verification

**Phase B2 — Two-sided Counter-AI** (PR #10):
1. Schema migration (`receiverInput`, `rebalancedAt`)
2. Receiver-input save endpoint (sender + receiver paths)
3. AI prompt + schema (`REBALANCE_CLAUSE_PROMPT`,
   `RebalancedClauseSchema`)
4. Rebalance endpoints (sender + receiver)
5. Update `NEGOTIATION_MOVES_PROMPT` для учёта `receiverInput`
6. UI: `<ReceiverPositionInput>`, `<RebalanceTrigger>`,
   updated `<ClausePerspectives>` с conflictLevel rendering
7. FREE quota integration через `AiUsage feature='rebalance'`
8. Tests + verification

**Phase B3 — Audit-trail PDF** (PR #11):
1. Add `@react-pdf/renderer` dependency
2. Schema migration (4 fields на Deal: closureDocxUrl,
   closureAuditUrl, closureSha256, closedAt)
3. `src/lib/deals/closure.ts` — pure builder функции:
   `buildFinalDocx`, `renderAuditPdf`, `computeSha256`
4. Background job `generateDealClosure(dealId)` с
   idempotency guard
5. Trigger в clause action endpoint при AGREED transition
6. Closure GET endpoints (sender + receiver)
7. Email шаблон + integration
8. UI: download cards на AGREED deal page
9. Tests + verification

Каждая Phase — independent. B1 first потому что terminal-state
semantics нужны для clean reconciliation в B2/B3. Но строго не
блокирует — B2 и B3 могут пойти параллельно если ресурсы позволят.

## Open questions для user

1. **TTL default 30 days** — устраивает? Альтернативы: 14, 60, 90.
2. **DECLINE reversibility** — заблокировано как terminal. ОК или
   нужна возможность «Передумал, продолжаем»?
3. **PDF library choice (`@react-pdf/renderer`)** — или предпочитаешь
   pdfkit для меньшего bundle?
4. **Receiver position может быть optional** перед rebalance — или
   жёстко гейтим? Текущий plan: жёстко (UX consistency, AI quality).
5. **FREE quota на rebalance** — 3/day/deal достаточно или меньше? Cost
   estimate показывает что 3 — нормально.

---

**Когда читаешь это в новой сессии после restart**: spec draft,
ожидает review. После approval → `superpowers:writing-plans` развернёт
B1/B2/B3 в три отдельных implementation plan'а (по одному на каждую
PR-волну). Реализация — последовательная или параллельная по решению
user'а.

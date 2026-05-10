@AGENTS.md

# 🚀 ОТКРЫВАЮЩИЙ ПРОМТ ДЛЯ НОВОЙ СЕССИИ

> **Скопируй это и вставь как первое сообщение Claude в новой сессии:**

```
Привет! Я работаю над ЮрИИст — Russian legal-tech SaaS на Next.js 16 +
Prisma + Neon. Над проектом велась длинная сессия (~75+ коммитов:
AI core, OCR, storage, workspaces, billing с ЮKassa, AI-refine с
patch-mode, admin-панель, PostHog аналитика, 20 шаблонов договоров).
Все детали в CLAUDE.md в корне репозитория.

Сделай сейчас:
1. Прочитай CLAUDE.md полностью.
2. Кратко (5 буллетов) подтверди что понял:
   – Что построено (top-level)
   – Что в pending TODO с приоритетами
   – Какие foot-guns надо помнить (схема, JWT, ЮKassa idempotence,
     refine patch-mode, voyageai SDK, и т.д.)
   – Текущая ветка и production URL
   – Что я должен сделать на стороне Vercel/внешних сервисов если ты
     поменяешь что-то критичное
3. Спроси меня что делаем сегодня.

Правила работы на эту сессию:
- Коммиты атомарные, со связными сообщениями (как в git log этой ветки).
- Перед каждым commit: `npx tsc --noEmit` + `npm test` должны пройти.
- Перед push: `npx next build` должен пройти.
- Push в claude/intelligent-cerf-a72ede; мерж в main делает пользователь
  через GitHub PR.
- Для миграций БД: всё должно проходить `prisma db push` без флага
  --accept-data-loss. Если push упадёт — переделай схему.
- НЕ трогай .env. НЕ копируй секреты в чат.
- Если что-то в проде ломается — НЕ гадай, попроси у меня:
    a) curl-ответ или скрин Network → Response, ИЛИ
    b) `npx vercel inspect <deployment-id> --logs`
- Если мой запрос двусмысленный — переспроси одной короткой строчкой
  до начала работы, не делай предположения тихо.
- Большие задачи (>2 часов работы) — обязательно опиши план до начала.
- Используй TodoWrite для tracking'а на больших задачах.

Готов? Прочитай CLAUDE.md и приступай.
```

---

# ЮрИИст — состояние проекта

**Дата последнего обновления**: 2026-05-10  
**Production URL**: https://juriist.vercel.app  
**Repo**: https://github.com/zzzz212/don  
**Active branch**: `claude/intelligent-cerf-a72ede` (мержится в `main` через PR)

Russian legal-tech SaaS: AI-анализ договоров + генерация документов с
AI-доработкой + чат-юрист + проверка контрагентов + workspaces +
биллинг через ЮKassa + админ-панель + PostHog аналитика.

**Stack**: Next.js 16 / React 19 / TypeScript / Prisma + Neon Postgres
(pgvector) / NextAuth v5 beta.30 / Tailwind 4. **Read
`node_modules/next/dist/docs/`** перед изменением Next.js паттернов —
это Next 16, не та Next.js которую помнит твоё обучение.

**Тесты**: 207 unit-тестов через vitest. `npm test`.

---

## Что построено (по слоям)

### AI core — `src/lib/ai/`
- **`client.ts`**: главная точка `generate()` / `generateText()` /
  `chat()` / `streamChat()`. Tier-based выбор модели
  (`fast` / `smart` / `deep`), fallback chain anthropic → gemini → groq
  → demo.
- **Структурированный вывод через zod**: schemas в `src/lib/ai/schemas/`
  (analyze.ts, chunk.ts, refine-patch.ts), никакого regex-парсинга.
- **Anthropic provider** поддерживает prompt caching (`cache_control`).
- **Streaming**: SSE через `src/lib/ai/sse.ts` (server) и
  `src/lib/sse-client.ts` (browser). StreamEvent kinds: `delta` |
  `usage` | `error` | `done` | `saved` (server emits после persist) |
  `mode` (refine route переключает между patch / regen).
- **Multi-pass анализ** длинных договоров через `chunkContract()` +
  map-reduce (`src/lib/ai/analyze.ts`). Параллельные batch'и по 4
  chunk'а, dedup рисков, синтез структуры.
- **AI-refine** (`/api/generated/[id]/refine`) — двухпутевой:
    1. **Patch-mode (default)**: AI возвращает structured JSON с
       операциями `replace/insert_after/insert_before/delete` против
       якорей в исходном документе. Сервер парсит вручную через
       `extractJsonObject() + RefinePatchSchema.safeParse()` (НЕ через
       `generate(zod)` — иначе на Groq добавляется ~700 токенов
       schema-dump'а + auto-retry удваивает input).
       `applyRefinePatch()` применяет операции через `indexOf` (никакого
       fuzzy match — для юр-текста character-perfect единственно
       правильно). Если any op якорь не найден / встречается дважды →
       весь патч отвергается атомарно.
    2. **Regen-mode (фолбэк)**: streamChat полного документа. Срабатывает
       когда AI returned refused=true, JSON сломан, или anchor mismatch.
       Сервер шлёт `mode` SSE event с reason; UI плавно переключается
       с patch-карточки на streaming-превью.

### Embeddings — `src/lib/embeddings/`
- Provider abstraction. Только Voyage AI (voyage-3-large, 1024 dim).
- **⚠️ НЕ использовать `voyageai` npm SDK** — он сломан в 0.2.1 (ESM
  imports без расширений). Прямой fetch в `voyage.ts`.
- Используется только для семантического поиска по DocumentChunk
  (договоры юзера). RAG в чате удалён — см. ниже.

### OCR — `src/lib/ocr/`
- Yandex Vision adapter, multi-page split через pdf-lib
  (`MAX_PAGES_PER_DOCUMENT = 30`).
- В `/api/analyze` автоматически подхватывается для скан-PDF (если
  pdf-parse вернул < 30 chars/page).
- OCR доступен только PRO/BUSINESS (см. `plans.ts`).

### Storage — `src/lib/storage/`
- Vercel Blob adapter + noop fallback. Provider-agnostic для будущего
  Yandex Object Storage (152-ФЗ).
- При upload sanitize'ит filename, использует random suffix против
  enumeration.

### Counterparty — `src/lib/counterparty/`
- Provider abstraction. DaData + ЕГРЮЛ работают; КАД и ФССП — **stub'ы
  с моками**. Замена — один файл, см. headers в
  `providers/{kad,fssp}.ts`.

### Workspaces (КРИТИЧНО! Сложная история) — `src/lib/org.ts`
- `Organization` / `Membership` / `Invite` модели.
- **Lazy migration**: `ensureActiveOrg(userId)` — три уровня
  восстановления:
  1. Happy path: проверяет что `User.activeOrgId` существует ЧЕРЕЗ
     `Membership` (не просто `IS NOT NULL`)
  2. Recovery: если stale, ищет любой существующий Membership и
     переключает на него
  3. Bootstrap: если ничего нет, создаёт Personal workspace + переносит
     все per-user данные. **Также ставит `User.trialActivatedAt = now`
     и `Organization.trialEndsAt = now + TRIAL_DAYS`** — атомарно с
     созданием workspace'а.
- **Anti-abuse: max 1 FREE workspace + max 10 total per user**.
  `POST /api/organizations` блокирует создание если у юзера уже есть
  workspace со `stored plan = "FREE"` (включая trial — потому что
  во время триала stored plan всё равно FREE, иначе юзер мог бы
  плодить workspace'ы пока на триале). Возвращает 403 +
  `code: "FREE_WORKSPACE_LIMIT"` со ссылкой на /billing.
- **JWT callback теперь ВСЕГДА re-resolves** activeOrgId (не только на
  trigger==='update', т.к. NextAuth v5 beta не всегда передаёт
  правильный trigger). Cost: 1 SELECT на session lifecycle event, не на
  каждый request.
- **Workspace switch механика**:
  1. Client: POST `/api/organizations/[id]/switch` → DB updates
     `User.activeOrgId`
  2. Client: `await update()` → NextAuth re-runs JWT callback →
     re-signs cookie с новым activeOrgId
  3. Client: `window.location.reload()` → новая страница с свежим
     cookie
- Каждый shared resource (Document, Generated, Chat, CounterpartyCheck,
  AiUsage) имеет `orgId` (nullable). `LegalReference` остаётся
  per-user (но фича удалена — см. ниже).
- **CounterpartyCheck unique** на `(userId, inn)`, НЕ `(orgId, inn)` —
  `prisma db push` отказался добавлять второй constraint без
  `--accept-data-loss`.
- **OrgSwitcher fallback**: если `data.activeOrgId` не найден в
  `data.organizations` → fallback на `data.organizations[0]`. Также
  показывает «Админ-панель» entry для админов (gated через
  `/api/admin/me`).

### Plans + Trial — `src/lib/plans.ts`
- FREE / PRO / BUSINESS — план на Organization (не User).
- **TRIAL_DAYS = 7** (не 14! было снижено). `TRIAL_DAYS_LABEL = "семь"`
  — должны меняться синхронно (есть unit-тест на это).
- `getEffectivePlan(ctx, now?)` — pure helper. Если `plan === "FREE" &&
  trialEndsAt > now` → возвращает `{plan: "PRO", isTrial: true,
  trialDaysLeft: ceil((trialEndsAt - now)/day), baselinePlan: "FREE"}`.
- **One trial per user lifetime** — `User.trialActivatedAt` пишется
  атомарно при первом bootstrap. Удалить + пересоздать workspace
  второй триал не даст.
- **Manual activation** для легаси-юзеров: `POST
  /api/billing/activate-trial` (см. `src/lib/billing/trial.ts`)
  проверяет `trialActivatedAt = null && org.plan === FREE && !isTrial`
  и активирует. UI: карточка «Активировать пробный период» на /billing
  показывается через `canActivateTrial: bool` в `/api/billing/status`.

### Quotas + usage — `src/lib/quota.ts`, `src/lib/ai/usage.ts`
- Plan на Organization. FREE: 3 analyse / 2 generate / unlimited chat /
  0 OCR. PRO/BUSINESS: всё unlimited.
- AiUsage пишется при каждом AI/OCR вызове с
  `(userId, orgId, feature, ...)`.
- `checkQuotaSafe(orgId, feature)` использует `getEffectivePlan()` —
  во время триала возвращает unlimited.
- **Template-path generations** (детерминистичные) тоже считаются как
  generate — `POST /api/generated` делает `aiUsage.create({provider:
  "template", model: "deterministic"})` чтобы FREE юзер не мог обойти
  лимит 2/мес через шаблоны.

### Templates + Generation — `src/lib/templates.ts` + `src/lib/contracts/`
- **20 шаблонов** (было 9):
  - **Договоры**: NDA, аренда, купля-продажа, услуги, поставка, заём,
    агентский, подряда, трудовой, дарение, мена, цессия, франчайзинг,
    перевозка, хранение
  - **Сопроводительные**: доп.соглашение, акт работ, акт услуг,
    расписка, расторжение
- Категории: Конфиденциальность / Недвижимость / Торговля / Финансы /
  Услуги / Кадры / **Документооборот** (новая).
- `src/lib/contracts/templates.ts` — 20 generator-функций (string
  interpolation, без AI). Smoke-тесты в `__tests__/templates.test.ts`
  на каждый id + branch coverage опциональных полей.
- `src/lib/contracts/clauses.ts` — переиспользуемые блоки
  (forceMajeure, disputeResolution, finalProvisions, signatureBlock).
  Поддерживает grammar для «Договор» (м.р.) и «Соглашение» (с.р.).
- `src/lib/contracts/numbers.ts` — `moneyDisplay(rub)` →
  `"100 000 (сто тысяч) рублей"`. **Использует `Intl.NumberFormat`,
  thousands separator — U+00A0 (NBSP)**, не ASCII пробел. В тестах
  норм-функция через `\s+` для совместимости.
- `src/lib/contracts/patch.ts` — `applyRefinePatch(source, ops)` для
  AI-refine патч-режима. Использует `indexOf` + проверку
  однозначности якоря. Атомарно — на первой же ошибке откатывается.

### Versioning — DocumentVersion + автоматизация
- `POST /api/generated` создаёт `GeneratedDocument` + `DocumentVersion
  v1` атомарно в одной транзакции. **БЕЗ этого версионирование UI
  показывало "Нет версий" навсегда.**
- `POST /api/generated/[id]/create-version` создаёт следующую версию +
  денормализует `content` + `formData` на родительский документ
  (поэтому `/generated/[id]` всегда показывает последнюю версию без
  лишнего join'а).
- `POST /api/versions/revert` — workspace-auth (не строгий userId
  check), создаёт новую "Восстановление vN" версию + денормализует.
- `GET /api/generated/[id]/versions` — **self-heal**: если у
  GeneratedDocument нет ни одной версии (легаси), материализует v1 из
  `doc.content` при первом обращении.
- **Edit-flow** через query param: `/generated/[id]` кнопка «Изменить»
  → `/templates/[id]?editDoc={id}`. Templates page читает param,
  prefills formData с сервера, на submit POST в `create-version`
  вместо новой `POST /api/generated`. **БЕЗ ?editDoc каждое
  редактирование форкало новый документ.**
- Diff: `src/lib/diff.ts` использует Myers (`diff` npm package) на
  уровне строк через `diffArrays`. Single-line replace coalesce'ится в
  «modified» hunk с word-level diff через `diffWordsWithSpace` —
  юзер видит точные изменённые слова красным/зелёным. UI компонент:
  `/generated/[id]/compare/[v1]/[v2]/page.tsx`.
- Sticky «Сравнить v1 ↔ v3» bar на `/generated/[id]/versions` —
  чекбокс-выбор 2 версий, подтверждение через кнопку.

### Billing (ЮKassa) — `src/lib/billing/`
- **`Subscription`** (one-per-org, updated in place) + **`Payment`**
  (one-per-attempt, idempotent on `idempotenceKey + providerPaymentId`).
- **Provider**: `src/lib/billing/yookassa.ts` — прямой REST-клиент (НЕ
  npm SDK). HTTP Basic auth, Idempotence-Key header, прямой fetch.
- `createCheckoutSession()`:
  1. Inserts `PENDING` Payment с fresh `randomUUID()` idempotence key
  2. Calls ЮKassa `POST /v3/payments` с redirect-confirmation +
     54-ФЗ receipt
  3. Stores `providerPaymentId` (могут прилететь webhook раньше чем
     HTTP response обработается)
  4. Returns `confirmationUrl` для редиректа браузера
- `applySucceededPayment(providerPaymentId)`:
  1. **Re-fetches** payment через ЮKassa API (никогда не доверяет
     webhook body — анти-spoofing)
  2. Если status === "succeeded" + Payment.status !== "SUCCEEDED" →
     транзакция: upsert Subscription, set Payment.status =
     "SUCCEEDED", clear Org.trialEndsAt, set Org.plan, send receipt
     email
  3. **Идемпотентно** — повторный вызов на уже succeeded payment =
     no-op.
- `/api/billing/checkout` (OWNER+, rate-limit 10/min/IP),
  `/api/billing/webhook` (ЮKassa shoots), `/api/billing/status`
  (returns canActivateTrial + subscription + payments[20]),
  `/api/billing/activate-trial` (manual claim для легаси).
- `/billing` UI — план + триал-баннер + 2 plan-cards + история
  платежей. OWNER-only.
- **Pricing**: `src/lib/legal-info.ts` `PRICING_RUB` (PRO 3990,
  BUSINESS 14990) + `PRICING_KOPECKS` (для billing math, integer чтобы
  не float).

### Email (Resend) — `src/lib/email/`
- Provider abstraction: `ResendEmailProvider` (when RESEND_API_KEY
  set) + `NoopEmailProvider` (warns to console — dev / no-key envs
  не падают).
- `sendEmail()` НИКОГДА не throws — failures идут в Sentry,
  `result.ok = false` для caller.
- Шаблоны: `welcome.ts`, `invite.ts`, `password-reset.ts`,
  `subscription-activated.ts`. Inline CSS только (Gmail/Outlook
  убивают `<style>`). HTML escape на user-input полях.
- Layout helper `renderEmailHtml({preview, body, cta?,
  ctaFallbackNote?})` — единый шаблон с лого, кнопкой, footer-ссылками
  на /privacy + /terms.
- 23 unit-теста в `src/lib/email/__tests__/`.

### Password reset — `src/lib/password-reset.ts`
- `PasswordResetToken` модель: только SHA-256 hash хранится в БД,
  plaintext только в email recipient'а.
- 256-bit random hex token, 30 минут TTL, single-use.
- На consume любые ОТО неиспользованные токены того же юзера тоже
  invalidate'ятся (стале email после смены пароля не работает).
- OAuth-only юзеры (без password): silently skip (приватность — не
  раскрываем кто как зарегистрирован).
- UI: `/forgot-password` (request form), `/password-reset?token=…` (set
  new password). Ссылка «Забыли пароль?» с /login.

### Public legal pages — `/privacy` / `/terms` / `/offer`
- Single source of truth: `src/lib/legal-info.ts` (BRAND, OPERATOR,
  CONTACTS, PRICING_RUB, TRIAL_DAYS, etc.). **Operator placeholders
  начинаются с `[`** — невозможно не заметить пока не зарегистрирован
  ИП/ООО.
- `<LegalPageShell>` — sticky TOC desktop + prose-styled body.
- `/offer` — Публичная оферта по 437 ГК РФ (требуется ЮKassa для
  активации платежей). 14 разделов.
- `/privacy` — Политика обработки ПДн по 152-ФЗ. 14 разделов, явно
  упоминает трансграничную передачу в США (Anthropic, Voyage,
  Resend, Sentry, Upstash).
- `/terms` — Пользовательское соглашение.
- В footer (Disclaimer) ссылки на все три.
- В /register — обязательный checkbox согласия со ссылками на все три.

### Admin panel — `src/lib/admin.ts`
- **Env-allowlist** через `ADMIN_USER_IDS` (CSV User.id'шек). НЕ
  `User.role` schema column — операционная штука, env-var change без
  миграции.
- `requireAdmin(userId)` throws `AdminAccessError` (status 403).
- `/admin` overview — 11 stat-карточек (users / orgs / revenue / usage
  this month). MRR computed from active Subscription rows ×
  PRICING_KOPECKS.
- `/admin/users` — paginated список с search (email/name) + фильтры
  (plan, trialActive). URL-synced filter state — bookmarkable.
- `/admin/users/[id]` — профиль + workspaces + usage за месяц +
  payments 30d + действия `+7 дней триала` и `→ Смена тарифа` (без
  оформления Payment, только Subscription с `provider: "manual"`).
- `/admin/payments` — ledger с filters (status / plan / email).
  filteredRevenue.succeededRub — сумма платежей по фильтру в
  заголовке.
- `/admin/orgs` — directory с deep-link на владельца.
- `/api/admin/me` — boolean check, OrgSwitcher показывает «Админ-панель»
  по нему.

### Analytics (PostHog) — `src/lib/analytics/server.ts` + `src/components/posthog-provider.tsx`
- **Server-side** (`captureEvent`): lazy-loads posthog-node, `flushAt:
  1` для serverless reliability, fire-and-forget (никогда не блокирует
  response). PII-free by construction — distinctId это User.id (cuid),
  никогда email/name. Каждое событие включает `groups: { workspace:
  orgId }` для cohort-analysis.
- **17 событий** на критичных путях: signup_completed,
  password_reset_requested, password_reset_completed,
  analysis_completed, analysis_failed, ocr_used, document_generated,
  document_refined {mode: patch | regen}, chat_message_sent,
  counterparty_checked, workspace_created, workspace_switched,
  member_invited, invite_accepted, trial_activated_manually,
  checkout_started, payment_succeeded, payment_failed.
- **Client-side** (`<PostHogProvider>` в `<Providers>`): `autocapture:
  false` (только explicit events), `person_profiles:
  "identified_only"` (anonymous viewers не создают permanent profiles),
  `capture_pageview: false` + manual `PostHogPageviewTracker`
  (Next 16 app-router не работает с auto-capture). На login — identify
  + group, на logout — reset.

### Audit log — `src/lib/audit.ts` + `AuditEvent` модель
- One row per security/billing-relevant action. Не для analytics
  (PostHog туда) — для compliance / b2b accountability.
- `logAudit({orgId, userId, action, target, targetType, payload, ip,
  userAgent})` — fire-and-forget, никогда не throws (failures → Sentry).
- **AuditAction controlled vocab** (см. union в audit.ts): workspace.*,
  member.*, billing.*, trial.*, document.*, auth.*. Незарегистрированный
  action в TS не пройдёт.
- **`redact()`** рекурсивно стрипает sensitive keys (password, secret,
  token, email, phone) из payload перед insert. Защита от случайной
  PII даже если caller передал `email: u.email`.
- **`attribution(request)`** возвращает `{ip, userAgent}` из
  request headers — call sites не повторяют boilerplate.
- **`onDelete: SetNull`** на `AuditEvent.orgId` — журнал ПЕРЕЖИВАЕТ
  удаление workspace'а (accountability не должна исчезать вместе с
  организацией, в которой кто-то нашалил).
- Wired в 10 точек: workspace.created / member.invited /
  invite_accepted / role_changed / removed / left /
  billing.checkout_started / payment_succeeded / trial.activated /
  trial.extended / billing.plan_changed_manually /
  auth.2fa_enabled / auth.2fa_disabled.
- UI: `/settings/organization/audit` с 5 quick-filter chips
  (Все / Участники / Биллинг / Документы / Безопасность). ADMIN+ only.

### 2FA TOTP — `src/lib/totp.ts` + `TotpCredential` модель
- **otplib v13 functional API** (v12 `authenticator` singleton удалён).
  6-digit codes, 30s period, ±1 step (=±30s) tolerance.
- `TotpCredential` (1:1 с User): `secret` (base32 plaintext —
  security model полагается на encryption-at-rest у Neon),
  `enabledAt: DateTime?` (null = pending setup, login flow НЕ требует
  кода пока null), `recoveryCodes: String[]` (SHA-256 хэши).
- **Recovery codes**: 10 кодов формата `xxxx-xxxx` (8 hex), показываются
  юзеру **один раз** при verify. `consumeRecoveryCode()` constant-time
  scan + remove on match. `hashRecoveryCode()` case+whitespace+dash
  insensitive (юзер может ввести "a1b2-c3d4" / "a1b2c3d4" / "A1B2 C3D4").
- Endpoints:
  - `POST /api/account/2fa/setup` — generate secret, return QR-uri.
    Refuses 409 ALREADY_ENABLED if уже включена (надо disable first).
  - `POST /api/account/2fa/verify {code}` — flip enabledAt + return
    plaintext recovery codes (показываются один раз).
  - `POST /api/account/2fa/disable {code|password|recoveryCode}` —
    три приёма proof. Recovery code consume'ится из массива.
  - `GET /api/account/2fa/status` — для UI.
- **Login flow** двухшаговый без multi-step auth: `POST
  /api/auth/check-2fa {email, password}` returns `{requires2FA: bool}`
  PRE-сабмит. Если true — UI показывает поле кода, потом второй submit
  с `totpCode` через обычный signIn. Credentials provider в authorize()
  валидирует все три.
- UI: `/account/security` — 4-фазная state machine (off / setting-up /
  showing-recovery / on). QR рендерится клиентом через `qrcode` npm
  (~15 KB). Recovery codes можно скопировать или скачать .txt.
- Audit: `auth.2fa_enabled` и `auth.2fa_disabled` логируются с IP/UA +
  proofKind в payload (для disable).

### Per-org usage analytics — `/settings/organization/usage`
- ADMIN+ only. Показывает кто сколько потратил квоты в этом
  календарном месяце по workspace'у.
- `GET /api/organizations/[id]/usage` aggregates AiUsage в:
  - per-feature totals (analyze/generate/chat/ocr) для quota-status
    панели
  - per-user × per-feature counts отсортированные по total desc.
    Юзеры с 0 usage всё равно в таблице — видно кто не пользуется.
- UI: 4 quota-card'а с progress-bar'ами, members-table с trophy-иконкой
  у первой строки (топ-контрибьютор), totals row внизу.

### Rate limit — `src/lib/rate-limit.ts`
- Upstash Redis с in-memory fallback для local dev.
- Endpoints: `analyze` (10/min), `chat` (30/min), `generate` (10/min),
  `billing.checkout` (10/min), `default` (60/min).
- Везде `await rateLimit(ip, "endpoint")` → 429 со структурированными
  headers.

### Telemetry — `src/lib/telemetry.ts`
- Sentry через `instrumentation.ts` (Next 15+ pattern). 4xx
  отфильтрованы в `beforeSend`.
- `reportError(error, { op, tags, extra, userId })` в catch'ах роутов.

### UX foundation — `src/components/`
- `<Skeleton>`, `<DocumentRowSkeleton>`, `<BillingCardSkeleton>` —
  замена `<Loader2>` спиннеров. Используются в /dashboard и /billing.
- `<ToastProvider>` + `useToast()` — глобальный toast (success / error
  / info), auto-dismiss 5s, manual close. Заменил большинство
  `window.alert()`. `<ToastBridge>` в Providers expose'ит singleton
  для не-React кода.
- `<RefinePanel>` — 4-фазовый UX (idle / patch-running /
  regen-streaming / saved). Streaming preview только для regen-режима.
- `<OrgSwitcher>` — admin-link gated на `/api/admin/me`.

---

## Все коммиты этой ветки (новейшие сверху, ~75)

### Sprint 4 — B2B Trust (последние)
```
e9630c5 Per-org usage analytics: who-spent-what-this-month for OWNER/ADMIN
088179e 2FA login integration + /account/security UI
b9d04b1 2FA core: TotpCredential schema + setup/verify/disable endpoints
fd9ee7e Audit log UI: /settings/organization/audit + filtered API
1d27cba Audit log: AuditEvent model + logAudit() + wire into 9 critical paths
```

### Sprint 2 — Admin + Analytics
```
43c2cc7 PostHog client-side: pageviews + identify, person_profiles=identified_only
3c3dbdd PostHog server-side analytics on critical user paths
1db5b67 Admin: payments ledger + workspaces directory
dd8641e Admin user management: list, detail, extend-trial, change-plan
928032c Admin foundation: env-gated /admin overview with project metrics
```

### AI optimization
```
5d699db Refine: cut input tokens on Groq — bypass generate(zod) overhead
c0ed9de Refine: patch mode (5-10x cheaper) with auto-fallback to full regen
```

### C2/C3/D5: AI generation polish
```
aa5cbbb D5: smoke tests for all 20 templates pinning data interpolation
b8af58d C3 batch 2: 6 full contract templates
aaaed7a C3 batch 1: 5 short / supporting document templates
f67aaf9 C2 + D3: AI document refinement with SSE streaming
```

### Versioning fixes
```
bddc601 Make versioning actually work end-to-end — 6 bugs fixed
7cee125 Persist generated documents — fix dashboard "Созданные документы" empty bug
```

### Polish Sprint
```
67a8446 Loading skeletons + global toast — kill the alert() and the spinners
9c5a6d6 Templates polish: word-level diff, sticky compare bar, A4 typography
79ee0dc Drop /legal (Справочник) — RAG on 6 articles wasn't a real product
aec5396 Bug fixes: /billing redirects, trial-creation block, OCR widget polish
```

### Trial + workspace fixes
```
9dceff8 Trial: cut to 7 days + add manual activation for legacy accounts
052f6ee Block creating extra FREE workspaces — quota multiplication abuse
```

### Sprint 1 — Monetization foundation
```
f8862fc Add ЮKassa billing: subscriptions, checkout, webhook, /billing UI
3a1cb6c Grant a 14-day PRO trial to every user's first workspace
c09b8cb Add password reset flow via emailed single-use tokens
b12f720 Add Resend transactional email + welcome and invite templates
a708ab5 Add public legal pages: privacy policy, terms of service, public offer
```

### Earlier (workspace + AI core, ~50 коммитов)
```
9721d93 Always re-resolve activeOrgId in JWT callback
f1857b7 Refresh JWT before reload on workspace switch
e04f250 Show OrgSwitcher on every viewport + fallback when active id missing
3f3c3cb Heal stale User.activeOrgId in ensureActiveOrg
d678499 Surface DB save errors from /api/analyze in the response body
bdc0e4c Hard-reload after workspace switch/create/leave/delete/invite-accept
... (ещё ~45 коммитов в основной wave 1)
```

---

## Внешние сервисы и env vars

| ENV | Что | Без него |
|---|---|---|
| `DATABASE_URL` | Neon Postgres | Не запустится |
| `AUTH_SECRET` | NextAuth JWT | Не запустится |
| `ANTHROPIC_API_KEY` или `GEMINI_API_KEY` или `GROQ_API_KEY` | Хотя бы один AI | Demo режим |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | Оригиналы не сохраняются |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Distributed rate limit | In-memory fallback (на serverless ≈ no rate limit) |
| `YANDEX_OCR_API_KEY` + `YANDEX_OCR_FOLDER_ID` | OCR сканов | OCR не работает |
| `VOYAGE_API_KEY` | Embeddings (поиск договоров) | Только keyword-search |
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` | Error tracking | console.error only |
| `DADATA_API_KEY` + `DADATA_SECRET_KEY` | Контрагенты ЕГРЮЛ | Только моки |
| `RESEND_API_KEY` | Транзакционные письма | Noop-логгер (письма не уходят) |
| `RESEND_FROM_ADDRESS` | (опц.) sandbox-from пока не подтверждён домен | Default `no-reply@juriist.ru` |
| `YOOKASSA_SHOP_ID` + `YOOKASSA_SECRET_KEY` | Платежи | /billing/checkout вернёт 503 |
| `POSTHOG_API_KEY` + `POSTHOG_HOST` | Server-side аналитика | События не уходят |
| `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` | Client-side аналитика | Pageviews не уходят |
| `ADMIN_USER_IDS` | CSV User.id для доступа в /admin | /admin показывает 403 для всех |
| `ADMIN_SEED_KEY` | Защита `/api/admin/embed-documents` | Default `dev-seed-key` |

⚠️ **Все секреты надо проротейтить** если они когда-либо засветились в чате.

⚠️ **pgvector в Neon** — `CREATE EXTENSION IF NOT EXISTS vector;` руками
в Neon SQL Editor один раз. Без этого `prisma db push` упадёт на
embedding колонках.

---

## Build pipeline

`package.json` `build` script:
```
prisma generate && prisma db push --skip-generate && next build
```

`prisma db push` (а не `migrate deploy`) — потому что миграции в репо в
SQLite-стиле от прошлой жизни проекта, не PG-совместимые.

После любого деплоя добавляющего embedding колонки — нужно один раз
бэкфилить:
```bash
curl -X POST -H "x-admin-key: dev-seed-key" \
  https://juriist.vercel.app/api/admin/embed-documents
```

---

## ⚠️ Известные баги, gotchas и foot-guns

1. **`voyageai` SDK 0.2.1 сломан** — ESM imports без расширений.
   Используем прямой fetch в `src/lib/embeddings/voyage.ts`. НЕ
   возвращайся на SDK пока не выйдет fixed версия.

2. **`prisma db push` боится false-positive** на новых unique
   constraints. Если будешь добавлять `@@unique` — проверь не nullable
   ли все колонки.

3. **Migrations folder в SQLite-синтаксисе** для legacy миграций. Новые
   писать в PG-стиле. Vercel build всё равно использует `db push`.

4. **`User.activeOrgId` — это `String?`, не FK** (намеренно).
   `ensureActiveOrg` должен валидировать через `Membership`, не просто
   `IS NOT NULL`.

5. **Workspace switch требует `await update()` ДО
   `window.location.reload()`** — иначе JWT cookie keep'ает старый
   orgId.

6. **NextAuth v5 beta `useSession.update()` не всегда передаёт
   `trigger === "update"`** в JWT callback. JWT callback ВСЕГДА
   re-resolves `activeOrgId`.

7. **`prisma.$queryRaw` нельзя использовать для композиции SQL** —
   используй `Prisma.sql` + `Prisma.empty`.

8. **OrgSwitcher должен иметь fallback** если `data.activeOrgId` не
   найден в `data.organizations` — fallback на
   `data.organizations[0]`.

9. **Хранение секретов**: `.env` в `.gitignore`. НЕ возвращать в
   трекинг.

10. **Refine patch-mode на Groq НЕ через `generate(zod)`**. Используй
    `generateText()` + ручной `safeParse`. `generate(zod)` на Groq
    добавляет ~700 токенов schema-dump'а в системный промпт + делает
    auto-retry при невалидном JSON (двойной input). Для refine patch
    это превращает «дешёвый» режим в «дороже чем regen».

11. **Trial = stored plan FREE + trialEndsAt > now**. Это значит во
    время триала `Organization.plan === "FREE"`. **Anti-abuse-проверка
    в `POST /api/organizations` использует stored plan, не effective
    plan** — иначе на триале можно создать второй workspace
    (effective PRO → проверка пропускает).

12. **`User.trialActivatedAt` пишется атомарно с
    `Organization.trialEndsAt`** в одной транзакции. Удалить +
    пересоздать workspace второй триал не даст.

13. **Refine ops применяются `indexOf`'ом (no fuzzy match)**. Якорь
    должен встречаться РОВНО ОДИН РАЗ — иначе патч rejected. AI
    инструктирован расширять якорь до полной строки (`5.2. Заказчик
    обязуется ...`) если короткая фраза неоднозначна.

14. **POST /api/generated создаёт v1 в той же транзакции**. БЕЗ этого
    /generated/[id]/versions показывает «Нет версий» навсегда.
    `GET /api/generated/[id]/versions` имеет self-heal (создаёт v1 если
    нет — для легаси документов).

15. **ЮKassa webhook — `applySucceededPayment()` re-fetches payment**
    через API, не доверяет body. Защита от подделки.

16. **`Intl.NumberFormat("ru-RU")` thousands separator — U+00A0
    (NBSP)**, не ASCII пробел. В тестах нужен `.replace(/\s+/g, " ")`
    перед `toContain`.

17. **PostHog client `autocapture: false` + manual page tracker**.
    Auto-capture не работает с Next 16 app-router (SPA-навигация
    скрыта от него). `<PostHogPageviewTracker>` в `<Providers>` шлёт
    `$pageview` руками.

18. **Tables `LegalKnowledge` + `LegalReference` остались в schema** —
    orphan, без UI/routes. Удалять нельзя без `--accept-data-loss`.
    Вернуть фичу = новый seed + новые routes; удалить полностью =
    accept-data-loss + удалить из schema.

19. **TRIAL_DAYS и TRIAL_DAYS_LABEL должны меняться синхронно**
    (`TRIAL_DAYS = 7`, `TRIAL_DAYS_LABEL = "семь"`). Тест в plans.test
    падает иначе. Используется в /offer:
    `сроком на {TRIAL_DAYS} ({TRIAL_DAYS_LABEL}) календарных дней`.

20. **otplib v13 убрал `authenticator` singleton** — используем
    functional API (`generateSecret`, `generateURI`, `generateSync`,
    `verifySync`). `verifySync` возвращает `VerifyResult` (объект с
    `valid` boolean), не plain bool — `verifyTotpCode()` это coerce'ит.

21. **2FA login flow двухшаговый** — `/api/auth/check-2fa` сначала, потом
    signIn с `totpCode`. Не сделать один pass: иначе UI не отличит
    "wrong password" от "creds OK + need TOTP" (signIn collapse'ит обе
    в `null`).

22. **AuditEvent.orgId nullable + onDelete: SetNull** — журнал
    переживает удаление workspace. Если меняешь cascade поведение,
    подумай о том, что ты ломаешь accountability.

23. **AuditAction — controlled vocab**, не любая строка. Новый action =
    добавить в TS union в `src/lib/audit.ts` И в `ACTION_LABELS` в
    `/settings/organization/audit/page.tsx` (иначе в UI будет raw key).

24. **`logAudit.payload` гоняется через `redact()`** — sensitive keys
    (password, secret, token, email, phone) автоматически становятся
    `"[redacted]"`. Не паниковать если в audit-таблице видишь redacted —
    скорее всего caller передал email "на всякий случай".

---

## Как дебажить когда что-то не работает

### 1. Что в Vercel?
```powershell
npx vercel inspect <deployment-id> --logs
```

### 2. Что в браузере?
DevTools → Network → найди фейлящий request → Response body. Многие
endpoint'ы имеют `saveError` / `detail` поля.

### 3. Что в Sentry?
Если ошибка в catch блоке — она с тегом `op:<route-name>`.

### 4. Что в PostHog?
Live Events для real-time потока. Funnels для конверсий.

### 5. Что в Neon?
SQL Editor. Полезные запросы:
```sql
-- Состояние схемы
SELECT
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='Subscription') AS has_subscription,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='Payment') AS has_payment,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='PasswordResetToken') AS has_password_reset,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='AuditEvent') AS has_audit,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='TotpCredential') AS has_totp,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='trialActivatedAt') AS has_trial_activated_at,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Organization' AND column_name='trialEndsAt') AS has_trial_ends_at,
  EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') AS has_pgvector;

-- Найти свой User.id для ADMIN_USER_IDS
SELECT id, email, "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 20;

-- MRR/active subs
SELECT plan, COUNT(*), STRING_AGG(o.name, ', ')
FROM "Subscription" s JOIN "Organization" o ON o.id = s."orgId"
WHERE s.status = 'ACTIVE' AND s."currentPeriodEnd" > NOW()
GROUP BY plan;

-- Trial-эксплоиты (юзеры с >1 owned workspace на FREE)
SELECT u.email, COUNT(*) as free_workspaces
FROM "User" u
JOIN "Membership" m ON m."userId" = u.id AND m.role = 'OWNER'
JOIN "Organization" o ON o.id = m."orgId"
WHERE o.plan = 'FREE'
GROUP BY u.email
HAVING COUNT(*) > 1;
```

---

## Что НЕ сделано (TODO)

### 🚀 Расширения продукта (Sprint 5+ — СЛЕДУЮЩИЙ)
- REST API + API keys
- Webhooks
- Slack/Telegram bot
- Bulk upload (drop 50 файлов)
- Compare 2 contracts (между разными договорами)
- Streaming для `/api/generate` (под AI-доработку — частично сделано
  в refine)
- Onboarding tour
- Email-уведомления о готовности анализа
- Counterparty monitoring + alerts

### 🤝 Интеграции
- Реальный КАД (api-fns.ru ~3к/мес или Контур.Фокус ~40к/мес)
- Реальный ФССП (public API, free, 100 req/день)
- E-signature (СберДок / Контур.Сайн)
- Битрикс24/amoCRM коннектор
- Email-to-analyze

### ⚙️ DX
- GitHub Actions CI (npm test + tsc + build на PR)
- E2E Playwright (signup → upload → analyze → upgrade)
- Pre-commit hooks (husky + lint-staged)
- Storybook для компонентов
- React component tests

### 🎨 UI polish
- Dark mode toggle
- Mobile-first overhaul
- A11y audit
- i18n (RU + EN)

### 🎁 Большие бизнес-фичи
- Templates marketplace
- Verified by lawyer badge
- SSO (SAML/OIDC) для enterprise
- Client portal (внешние юристы view-only)
- Approval workflows
- Stripe для зарубежных клиентов
- Free 14-day PRO trial extension через promo

### 📚 Контент
- Полная база ГК РФ / НК РФ / ТК РФ для возврата справочника (B3 в
  старом плане). Парсинг pravo.gov.ru → embedding'и → pgvector.
  ~1-2 дня + ~$5 на embeddings.

---

## Приоритет следующих спринтов

### Sprint 5 — Public API + Webhooks (~7-9ч) ← **СЛЕДУЮЩИЙ**
REST API + API keys → webhooks → внешние интеграции.

### Sprint 6 — Большие фичи продукта (~10-12ч)
Bulk upload + compare contracts + onboarding tour + counterparty
monitoring.

### Sprint 7 — DX (~8-10ч)
GitHub Actions CI + E2E + pre-commit + Storybook.

### Sprint 8 — UI polish (~10-14ч)
Dark mode + mobile + a11y + i18n.

---

## Оперативный кэш (что свежо в голове у предыдущей сессии)

- **Sprint 4 (B2B trust) только что закрыт**: AuditEvent + 2FA TOTP +
  per-org usage analytics. 5 новых коммитов: `e9630c5 → 1d27cba`.
  Если будешь wire'ить новые actions в audit log — добавь action key
  в `AuditAction` union в `src/lib/audit.ts` И в `ACTION_LABELS`
  в `/settings/organization/audit/page.tsx`.
- **2FA login flow**: двухшаговый. Сначала `POST /api/auth/check-2fa`
  возвращает `requires2FA`, потом обычный signIn с totpCode. Если
  будешь рефакторить login — не сломай этот контракт; UI рассчитывает
  на pre-flight.
- **Refine patch-mode** отдебажен. Если на проде юзер видит ~10000
  токенов на одну refine — патч-аттемпт упал и фолбэк на regen. Чек:
  `mode: regen` в SSE с `reason` — там написано почему.
- **Admin доступ через ADMIN_USER_IDS** (env var, CSV cuid'ов). Найди
  свой id через `SELECT id, email FROM "User"`.
- **PostHog подключён** — eu.i.posthog.com (или us.), 4 env vars:
  серверные (`POSTHOG_API_KEY`/`HOST`) + клиентские
  (`NEXT_PUBLIC_POSTHOG_KEY`/`HOST`). Серверный и клиентский ключ — один
  и тот же `phc_...`.
- **20 шаблонов** с тестами. Если добавлять новый — обновить `iconMap`
  в /templates/page.tsx + `generateContract()` switch + тест в
  `__tests__/templates.test.ts`.
- **Версионирование работает** — POST /api/generated создаёт v1
  атомарно, edit-flow через `?editDoc=X`, refine создаёт версии,
  revert денормализует. Self-heal на старых документах через первое
  GET /versions.

---

## Контакты infrastructure

- **GitHub**: https://github.com/zzzz212/don
- **Production**: https://juriist.vercel.app
- **Production branch**: `main`
- **Active feature branch**: `claude/intelligent-cerf-a72ede`
- **Vercel project**: zzzz212-projects/don
- **Neon project**: console.neon.tech → don / juriist project
- **Sentry org**: juriist
- **Voyage AI**: voyageai.com
- **Yandex Cloud**: console.cloud.yandex.ru
- **PostHog**: us.posthog.com (или eu.posthog.com — проверь POSTHOG_HOST)
- **ЮKassa**: yookassa.ru/my (после регистрации ИП/ООО)
- **Resend**: resend.com (после подтверждения домена)

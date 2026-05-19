@AGENTS.md

# 🚀 ОТКРЫВАЮЩИЙ ПРОМТ ДЛЯ НОВОЙ СЕССИИ

> Скопируй этот блок как первое сообщение в новой сессии. Дальше — этот же
> CLAUDE.md, читай его подряд.

```
Привет! Я работаю над Яксо — Russian legal-tech SaaS на Next.js 16 +
Prisma + Neon Postgres. Проект большой (~120 коммитов): AI-анализ
договоров с verdict + apply-fix, генерация из 20 шаблонов с AI-доработкой,
чат-юрист, проверка контрагентов, workspaces, биллинг через ЮKassa, 2FA,
audit log, admin-панель, PostHog, dark mode + i18n provider + ⌘K, AccountMenu,
onboarding, кастомные 404/500/OG, user-level план + триал. Production:
https://yakso.ru. Все детали в CLAUDE.md в корне репозитория.

ПЕРВЫМ ДЕЛОМ:

1. Прочитай CLAUDE.md полностью (~1000 строк). Там вся архитектура, схема,
   foot-guns, env vars, дебаг-руководство, бизнес-roadmap.

2. Кратко (7-9 буллетов) подтверди:
   – Top-level overview что построено
   – Бизнес-блокеры запуска (registration, 152-ФЗ, отсутствие каналов)
   – Минимум 7 критичных foot-guns
   – Текущая ветка и production URL
   – Tier policy AI (FREE→Sonnet/Haiku, PRO→Sonnet, BUSINESS→Opus)
   – User-level план (не Organization) — куда писать
   – Что я должен делать на стороне Vercel/Neon/Anthropic/Resend/ЮKassa
     если ты затронешь что-то критичное

3. Спроси «что делаем сегодня». Если у меня нет конкретики — по бизнес-
   roadmap в CLAUDE.md следующий шаг.

═══ ПРАВИЛА РАБОТЫ В ЭТОЙ СЕССИИ ═══

КОММИТЫ И PUSH:
- Атомарные, со связными multi-line сообщениями ("почему" а не "что").
  Смотри стиль в git log этой ветки.
- Перед каждым commit: `npx tsc --noEmit` + `npm test` должны пройти.
- Перед push: `npx next build` должен пройти (нужен DATABASE_URL — для
  локальной проверки можно `DATABASE_URL="postgresql://x:y@localhost..."`).
- Push в claude/sprint-8-ui-polish; мерж в main делает пользователь
  через GitHub PR. После merge — auto deploy на Vercel.
- Identity: `Claude <noreply@anthropic.com>` через `-c user.name` /
  `-c user.email` флаги. Не трогай глобальный git config.

СХЕМА БД:
- Все миграции проходят через `prisma db push` без `--accept-data-loss`.
  Если push потенциально теряет данные — переделай схему.
- В Vercel build: `node scripts/db-push-with-retry.mjs` (retry-обёртка
  для Neon cold-start, 5 попыток с backoff 2/3/5/8/13с).

БЕЗОПАСНОСТЬ:
- НЕ трогай .env (в .gitignore).
- НЕ копируй секреты в чат. Если увидел в diff — попроси проротейтить.
- НЕ пиши тесты с реальными API-ключами — мокай.

КОММУНИКАЦИЯ:
- Двусмысленный запрос — переспроси ОДНОЙ строкой ДО начала работы.
- Если что-то ломается в проде — НЕ гадай. Попроси:
    (a) Response body из Network → DevTools, ИЛИ
    (b) Vercel Logs (Deployments → последний → Functions → Logs)
- Задача >2ч — TodoWrite + numbered list ДО кода.
- Commit готов — короткое summary, не пересказ diff'а.

КАЧЕСТВО КОДА:
- Senior rigor. Никаких `any`, валидация на границах, явный error-handling.
- Сохраняй паттерны: comments в стиле "why not what", fire-and-forget
  для analytics/audit, provider-abstractions для интеграций.
- Не пересоздавай документацию (.md / README) кроме CLAUDE.md если не
  просил явно.

NEXT.JS 16 NUANCES:
- `useSearchParams()` ОБЯЗАТЕЛЬНО в `<Suspense>`.
- Server actions `cookies()`/`headers()` — `await` обязателен (Next 16).
- Перед новой Next-фичей — `Read node_modules/next/dist/docs/...` если
  не уверен.

ЕСЛИ Я НЕ ОТВЕЧАЮ НА ВОПРОС: переспроси один раз. Дальше — minimal
invasive вариант + явная отметка что оставил под уточнение.

Готов? Читай CLAUDE.md, потом 7-9 буллетов, потом «что делаем сегодня».
```

---

# Яксо — состояние проекта

**Дата последнего обновления**: 2026-05-18 (после Sprint 11 — социальный слой + анти-абуз; ребрендинг ЮрИИст → Яксо; регистрация ИП; CI; hotfix Anthropic `temperature`)
**Production URL**: https://yakso.ru
**Repo**: https://github.com/zzzz212/don
**Active branch**: `claude/sprint-8-ui-polish` (мерж в `main` через PR)

Russian legal-tech SaaS: AI-анализ договоров с verdict и per-risk apply-fix
+ 20 шаблонов генерации + AI-refine + чат-юрист + проверка контрагентов
(DaData/ЕГРЮЛ; ФССП-провайдер под FSSP_AUTH_KEY, КАД — заглушка) + workspaces +
ЮKassa-биллинг + 2FA + audit log + admin-панель + PostHog + dark mode
+ i18n infra + ⌘K + AccountMenu + onboarding + кастомные 404/500/OG
+ **/blog с 9 cornerstone-статьями + /help FAQ + /sample-report
preview + sitemap/robots/JSON-LD + Vercel cron для trial-/inactive-/
abandoned-email lifecycle** + сеть между пользователями (профили,
связи, ревью договоров, личные сообщения) + установка как PWA на телефон.

**Stack**: Next.js 16 / React 19 / TypeScript / Prisma + Neon Postgres
(pgvector) / NextAuth v5 beta.30 / Tailwind 4 (CSS-first + @custom-variant) /
Geist font / motion (Framer v12) / Anthropic Claude 4.x (Haiku/Sonnet/Opus)
с prompt caching. **Read `node_modules/next/dist/docs/`** перед изменением
Next.js паттернов — это Next 16, не та Next.js что помнит твоё обучение.

**Тесты**: 377 unit-тестов через vitest. `npm test`.

---

## Что построено (по слоям)

### AI core — `src/lib/ai/`
- **`client.ts`**: `generate()` / `generateText()` / `chat()` / `streamChat()`.
  Fallback chain anthropic→gemini→groq→demo. При падении всех провайдеров
  собирается consolidated AIError со списком всех ошибок (не только last).
- **Структурированный вывод через zod**: schemas в `src/lib/ai/schemas/`
  (analyze.ts с verdict-полем, chunk.ts, refine-patch.ts).
- **Anthropic provider** поддерживает prompt caching: `cache_control`
  на system prompt + tool definition + предпоследнем сообщении в чате.
  Cumulative prefix > 1024 tokens — кэшируется.
- **Tier policy** (`src/lib/ai/tier-policy.ts`) per-action × per-plan:
    - analyze: FREE→smart, PRO→smart, BUSINESS→deep (Opus только тут)
    - generate: FREE→fast, PRO→smart, BUSINESS→smart
    - refine: FREE→fast, PRO→smart, BUSINESS→smart
    - chat: FREE→fast, PRO→smart, BUSINESS→smart
  `pickTier(action, plan)` — единственный entry-point.
- **Streaming**: SSE через `src/lib/ai/sse.ts`. StreamEvent kinds:
  `delta` | `usage` | `error` | `done` | `saved` | `mode`.
- **Multi-pass анализ** (`chunkContract()` + map-reduce, в `analyze.ts`).
  Порог short-document = **50_000 chars** (поднят с 12_000 для меньшего
  числа дорогих map-reduce вызовов; Sonnet 200k context справляется).
- **Verdict calibration** (`src/lib/ai/score-calibration.ts`):
  единственный источник истины для score → verdict mapping. Использует
  prompt-инструкции, fallback synthesis, demo provider — три пути не
  могут разойтись. Verdict: `"sign"` | `"negotiate"` | `"do_not_sign"`.
  **В UI отображается как «уровень риска» (низкий/средний/высокий)**, не
  как императивная «рекомендация подписать» — снижает юридическую
  ответственность за плохой совет (см. foot-gun #31).
- **Per-risk поля** (Sprint 10): `consequence` («чем конкретно грозит
  риск») + top-level `balance` («в чью пользу смещён договор») — оба
  `.optional()` в zod (бэк-совместимость со старыми сохранёнными
  анализами). `verifyRiskQuotes` (`quote-verify.ts`) пост-обрабатывает
  `originalText`: снапит цитату к точной подстроке договора при
  расхождении только по пробелам — чтобы apply-fix не отключался молча.
- **AI-refine** (`/api/generated/[id]/refine`) — patch-mode (default)
  через extractJsonObject+safeParse (НЕ через `generate(zod)` чтобы не
  бить Groq лишним schema-dump'ом). Fallback на regen streamChat.
- **Smart suggestions per-risk** (apply-fix on /report): для каждого
  риска кнопка «Применить» заменяет originalText→recommendedText в
  client-side working copy; sticky toolbar скачивает patched DOCX
  через `/api/export/docx`.

### Embeddings — `src/lib/embeddings/`
- Voyage AI (voyage-3-large, 1024 dim) через прямой fetch. **НЕ
  `voyageai` SDK** — он сломан (ESM imports без расширений).
- Используется для семантического поиска по DocumentChunk. RAG в чате
  удалён.

### OCR — `src/lib/ocr/`
- Yandex Vision adapter, multi-page split через pdf-lib
  (`MAX_PAGES_PER_DOCUMENT = 30`). Подхватывается в `/api/analyze`
  если pdf-parse вернул < 30 chars/page. Доступен только PRO/BUSINESS.

### Storage — `src/lib/storage/`
- Vercel Blob adapter + noop fallback. Sanitize filename + random suffix.

### Counterparty — `src/lib/counterparty/`
- Provider abstraction. **DaData + ЕГРЮЛ работают**.
- **КАД — заглушка; ФССП — реальный провайдер** (`providers/fssp-api.ts`,
  env-gated на `FSSP_AUTH_KEY` — без ключа работает заглушка; async-флоу
  api-ip.fssp.gov.ru, поиск ЮЛ по имени, не по ИНН). `DebtProvider.
  fetchDebts` принимает `companyName`. ФССП-провайдер НЕ проверен на
  живом ключе — контракт ответа сверить при подключении. UI /counterparty
  показывает warning-плашку вместо литералов «0 дел». См. foot-gun #25.

### Workspaces — `src/lib/org.ts`
- `Organization` / `Membership` / `Invite` модели. Lazy migration
  через `ensureActiveOrg(userId)` — 3 уровня (happy / recovery /
  bootstrap). **Bootstrap БОЛЬШЕ НЕ выдаёт триал автоматически** —
  только активируется через `/billing` → `/api/billing/activate-trial`.
- Anti-abuse: max 1 FREE workspace + max 10 total per user. Использует
  `User.plan === "FREE"` для anti-abuse-проверки (user-scoped плана),
  не Organization.plan.
- JWT callback **всегда re-resolves** activeOrgId (без guard на
  `trigger === 'update'` — NextAuth v5 beta не всегда передаёт).
- Workspace switch требует `await update()` ДО `window.location.reload()`.

### Network — сеть между пользователями (Sprint 10) — `src/lib/network.ts`
- Слой НАД workspaces. Модели Prisma: `UserProfile` (opt-in каталог,
  флаг `discoverable` — по умолчанию false, 152-ФЗ), `Connection` (связь
  юзер↔юзер: PENDING / ACCEPTED / DECLINED), `DocumentShare` (договор на
  ревью), `ShareComment` (тред обсуждения), `Conversation` +
  `DirectMessage` (личные сообщения, pairKey = sorted id-пара).
- Хелперы `network.ts`: `ensureProfile`, `connectionStates`,
  `areConnected`, `conversationPairKey`, `networkRateLimitOk`,
  `NETWORK_USER_SELECT` / `shapeNetworkUser`.
- API `/api/network/*`: `profile`, `directory` (поиск только по
  discoverable), `connections` (+`[id]`), `shares` (+`[id]`, `comments`,
  `copy`), `messages` (+`[id]`), `users/[id]` (профиль коллеги).
- Страницы: `/network` (вкладки Каталог / Связи / Ревью / Профиль),
  `/network/shares/[id]` (ревью договора + тред), `/network/messages`
  + `/[id]` (диалоги, поллинг 12с), `/network/users/[id]` (профиль).
- Гейтинг: шеринг и сообщения — только между ACCEPTED-связями. Rate-limit
  endpoint `network` (30/мин) на content-POST'ах. Уведомления (Resend):
  `connection-request` / `document-shared` / `network-message` (последнее
  — только на ПЕРВОЕ сообщение в треде, иначе спам).
- «Отправить на ревью» — компонент `SendForReview` на `/report/[id]`.
  «Сеть» в header-nav и ⌘K.

### PWA — установка на телефон (Sprint 10)
- `src/app/manifest.ts` — манифест (Next авто-линкует `<link rel=
  "manifest">`). `/pwa/icon` — генерация иконок 192/512/maskable через
  next/og (без бинарников в репо).
- `public/sw.js` — рукописный service worker: cache-first для
  `/_next/static`, network-first для навигаций с офлайн-фоллбэком
  (`public/offline.html`), `/api/*` НЕ кэшируется (юр-данные не должны
  устаревать).
- `ServiceWorkerRegister` — регистрация SW **только в production**
  (в dev мешает HMR). `InstallPrompt` — баннер установки
  (`beforeinstallprompt` на Android/Chrome, ручная подсказка на iOS).
- `layout.tsx`: `viewport` export (theme-color light/dark, viewport-fit
  cover под чёлку), `appleWebApp` metadata для iOS standalone.

### Plans + Trial — `src/lib/plans.ts` + `src/lib/legal-info.ts`
- FREE / PRO / BUSINESS. **План теперь user-scoped**: `User.plan` —
  authoritative, `Organization.plan` — legacy mirror (kept in sync
  через webhook + activate-trial). См. foot-gun #11.
- **TRIAL_DAYS = 2** (было 7). TRIAL_DAYS_LABEL = "два".
- `getEffectiveUserPlan(user)` — pure helper. Если `plan === "FREE" &&
  trialEndsAt > now` → returns `{plan: "PRO", isTrial: true, ...}`.
- **One trial per user lifetime** через `User.trialActivatedAt`.
- Manual activation: `POST /api/billing/activate-trial` — атомарно
  пишет User.trialActivatedAt + User.trialEndsAt + Organization.trialEndsAt.

### Quotas — `src/lib/quota.ts`
- `checkQuotaSafe(orgId, feature)` находит OWNER membership →
  читает User.plan владельца → возвращает effective plan + квоту.
  Fail-open на DB ошибке.
- FREE: 3 analyse / 2 generate / unlimited chat / 0 OCR.
- PRO/BUSINESS: unlimited.

### Subscription + Payment — Schema + `src/lib/billing/`
- `Subscription` (one-per-org, новый Subscription.userId nullable для
  rollout) + `Payment` (one-per-attempt, idempotent на idempotenceKey).
- ЮKassa REST-клиент через прямой fetch. HTTP Basic + Idempotence-Key.
- `applySucceededPayment`:
  1. Re-fetches payment через ЮKassa API (anti-spoofing)
  2. Если succeeded + not already applied → transaction:
     upsert Subscription с userId=payment.userId, update **User.plan**
     (authoritative) + Organization.plan (legacy mirror), set
     User.trialEndsAt = null, send receipt email.
- Webhook через `/api/billing/webhook`. Status check через
  `/api/billing/status` (OWNER+) — возвращает effective user plan
  + payments[20]. Lightweight probe для AccountMenu — `/api/account/plan`.
- Backfill для legacy юзеров: `POST /api/admin/backfill-user-plan`
  (x-admin-key gated). Идемпотентен.

### Templates + Generation — `src/lib/contracts/`
- 20 шаблонов (NDA, аренда, купля-продажа, услуги, поставка, заём,
  агентский, подряд, трудовой, дарение, мена, цессия, франчайзинг,
  перевозка, хранение + 5 supporting: доп.соглашение, акт работ,
  акт услуг, расписка, расторжение).
- Категории: Конфиденциальность / Недвижимость / Торговля / Финансы /
  Услуги / Кадры / Документооборот.
- Smoke-тесты в `__tests__/templates.test.ts` на каждый id + branch
  coverage опциональных полей.
- `numbers.ts` — `moneyDisplay(rub)` → `"100 000 (сто тысяч) рублей"`.
  Thousands separator U+00A0 (NBSP), не ASCII. Тесты нормализуют через
  `\s+`.
- `clauses.ts` — переиспользуемые блоки (forceMajeure, dispute,
  finalProvisions, signatureBlock) с grammar для Договор (м.р.) /
  Соглашение (с.р.).
- **AI-generation tier**: FREE на Haiku 4.5, PRO+ на Sonnet.

### Versioning — DocumentVersion + автоматизация
- `POST /api/generated` создаёт `GeneratedDocument` + v1 атомарно.
- `POST /api/generated/[id]/create-version` создаёт N+1 + денормализует
  content/formData на родителя.
- `POST /api/versions/revert` — workspace-auth, создаёт «Восстановление
  vN» + денормализует.
- `GET /api/generated/[id]/versions` — **self-heal**: материализует v1
  из doc.content для legacy документов.
- **Inline edit title**: `PATCH /api/generated/[id]` (zod, workspace-
  scoped). UI через `<InlineEdit>` компонент.
- Edit-flow через `?editDoc=X` на `/templates/[id]`.
- Diff: Myers (`diff` npm) на уровне строк через `diffArrays`. Single-
  line replace coalesce'ится в «modified» hunk с word-level diff через
  `diffWordsWithSpace`. UI: `/generated/[id]/compare/[v1]/[v2]/page.tsx`
  + Breadcrumbs.
- Sticky «Сравнить v1↔v3» bar.

### Email (Resend) — `src/lib/email/`
- Provider abstraction: `ResendEmailProvider` + `NoopEmailProvider`
  (warns to console, не падает).
- `sendEmail()` НИКОГДА не throws — fire-and-forget, ошибки в Sentry.
- Шаблоны: `welcome.ts`, `invite.ts`, `password-reset.ts`,
  `subscription-activated.ts`. Inline CSS, HTML escape.
- **welcome.ts** переписан после удаления auto-trial: больше не
  утверждает «мы активировали пробный доступ» — приглашает активировать
  на /billing.
- Layout helper `renderEmailHtml({preview, body, cta?, ctaFallbackNote?})`.

### Password reset — `src/lib/password-reset.ts`
- `PasswordResetToken`: только SHA-256 hash в БД, plaintext только в
  email. 256-bit random hex, 30 min TTL, single-use.
- Consume инвалидирует все ОТО неиспользованные токены того же юзера.
- OAuth-only юзеры — silently skip.

### Public legal pages — `/privacy` / `/terms` / `/offer`
- Single source of truth: `src/lib/legal-info.ts` (BRAND, OPERATOR,
  CONTACTS, PRICING_RUB, TRIAL_DAYS, etc.).
- **OPERATOR placeholders начинаются с `[`** — НЕ запускать в прод
  пока не зарегистрировано юр.лицо. См. foot-gun #20.
- `<LegalPageShell>` — sticky TOC + prose body.
- В footer (Disclaimer) ссылки на все три. В /register — обязательный
  checkbox согласия.

### Admin panel — `src/lib/admin.ts`
- Env-allowlist через `ADMIN_USER_IDS` (CSV User.id). НЕ User.role column.
- `requireAdmin(userId)` throws AdminAccessError (403).
- `/admin` overview — 11 stat-карточек. MRR от Subscription × PRICING_KOPECKS.
- `/admin/users` — paginated с search + filters (URL-synced).
- `/admin/users/[id]` — профиль + workspaces + usage + payments 30d +
  actions «+7 дней триала» (admin tool — фиксированно 7, не зависит
  от TRIAL_DAYS) + «Смена тарифа» (manual Subscription без Payment).
- `/admin/payments` — ledger с filters.
- `/admin/orgs` — directory с deep-link на владельца.
- `/api/admin/me` — boolean для AccountMenu admin-link gating.

### Analytics (PostHog)
- Server-side `captureEvent` lazy-loads posthog-node, `flushAt: 1` для
  serverless reliability, fire-and-forget. PII-free (distinctId = cuid,
  не email).
- 17 событий на критичных путях.
- Client-side `<PostHogProvider>`: `autocapture: false`, manual
  `<PostHogPageviewTracker>`, `person_profiles: "identified_only"`.

### Audit log — `src/lib/audit.ts` + `AuditEvent` модель
- One row per security/billing action. `redact()` стрипает sensitive
  keys (password, secret, token, email, phone).
- AuditAction controlled vocab (TS union). `attribution(request)`
  возвращает {ip, userAgent}.
- `onDelete: SetNull` на orgId — журнал переживает удаление workspace.
- UI: `/settings/organization/audit` с 5 quick-filter chips + Breadcrumbs.

### 2FA TOTP — `src/lib/totp.ts` + `TotpCredential`
- otplib v13 functional API. 6-digit, 30s period, ±1 step tolerance.
- Recovery codes (10 шт, `xxxx-xxxx` формат, SHA-256 хэши).
- Login flow двухшаговый: `POST /api/auth/check-2fa` → если
  `requires2FA=true` → второй submit signIn с `totpCode`.
- Audit `auth.2fa_enabled` / `auth.2fa_disabled` с proofKind.

### UX foundation — `src/components/`
- **Dark mode**: ThemeProvider (light/dark, system дефолт через
  prefers-color-scheme). Inline no-FOIT script в `<head>`. CSS
  variables в `:root` / `.dark`. Tailwind 4 `@custom-variant dark`.
- **i18n infra** (RU/EN): I18nProvider, `messages.ts`, `useT()` хук.
  LanguageToggle убран из header (вернуть когда дозреем до EN-аудитории).
- **Цвета**: oklch palette, indigo primary (~270°), color-mix borders
  (`--border-soft`, `--border-strong`).
- **Geist font** (next/font). Theme-aware shadow scale.
- **Motion** (motion/react v12): spring анимации на toast, OrgSwitcher
  dropdown, mobile menu, refine modal, onboarding modal.
- **⌘K command palette** (`<CommandPalette>`): nav + actions + theme
  toggle. j/k navigation, Enter/Esc.
- **AccountMenu**: avatar dropdown с профилем, planChip (тариф+триал),
  links на billing/security/account/admin/logout.
- **OrgSwitcher**: workspace pill + dropdown (Settings + Invite +
  Create). Trial badge перенесён в AccountMenu (план — user-scoped).
- **InlineEdit** (`<InlineEdit value onSave variant maxLength />`):
  click pencil → input → Enter/blur save → Esc cancel. Используется
  для workspace name + doc title.
- **OnboardingModal**: 3 illustrated карточки при первом login (once
  per browser, localStorage flag).
- **Breadcrumbs**: home → ... → current. На /generated/[id]/versions
  и /compare.
- **CountUp**: rAF-tween для чисел, respects prefers-reduced-motion.
- **StatusPill**: live (pulsing dot) / success / warning / danger / neutral.
- **Empty states**: bespoke inline SVG (Docs / Chat / Counterparty /
  Search). `<EmptyState illustration title description actions />`.
- **Toast actions**: `toast.success("...", { action: { label, onClick } })`.
  Dashboard delete использует для optimistic undo (5s window).
- **Custom 404 / 500** (`src/app/not-found.tsx` / `error.tsx`) с inline
  SVG. error.tsx forward'ит в Sentry.
- **Programmatic favicon** (`app/icon.tsx`, 32×32) + **apple-icon.tsx**
  (180×180) через next/og ImageResponse.
- **Dynamic OG image** для landing (`app/opengraph-image.tsx`),
  Node.js runtime (не edge — Next 16 warning).
- **Skeleton**: shimmer sweep вместо pulse (CSS keyframe в globals).
- **A11y**: `:focus-visible` rings (с opt-out для form fields),
  prefers-reduced-motion, skip-link, ARIA labels везде, useId для
  htmlFor связей.
- **Mobile-first**: hamburger 44px touch target, OrgSwitcher compact
  на narrow, admin tables в overflow-x-auto с min-w-[640px].

### Rate limit — `src/lib/rate-limit.ts`
- Upstash Redis с in-memory fallback.
- Endpoints: analyze (10/min), chat (30/min), generate (10/min),
  billing.checkout (10/min), default (60/min).

### Telemetry — `src/lib/telemetry.ts`
- Sentry через `instrumentation.ts` (Next 15+ pattern). 4xx filtered
  в `beforeSend`. `reportError(error, { op, tags, extra, userId })`.

### Build pipeline
- `package.json` build:
  `prisma generate && node scripts/db-push-with-retry.mjs && next build`
- `scripts/db-push-with-retry.mjs` — 5 попыток с backoff (2/3/5/8/13с)
  для Neon cold-start.
- Vercel function timeouts: 300s на /api/analyze, /api/generate,
  /api/refine, /api/chat, /api/documents/[id]/reanalyze (Pro plan
  required; Hobby clamps to 60s).

### Acquisition / SEO — `src/app/{blog,help,sample-report,sitemap,robots}/`
- **`/sample-report`** — публичный preview анализа без логина (типовой
  IT-services договор, 2 critical + 2 medium + 1 low; verdict
  do_not_sign / score 2). Главный conversion-рычаг — preview of value.
  Линкуется из landing hero, /analyze, /help, dashboard empty-state.
- **`/blog`** — 9 cornerstone-статей (~1500-2500 слов каждая):
  - `gph-vs-ip-kogo-vybrat` — ГПХ vs ИП vs самозанятый, налоги 2026
  - `nda-dlya-it-kompanii` — почему NDA без режима КТ не работает
  - `arenda-nezhilogo-pomescheniya-7-punktov` — недвижимость
  - `dogovor-okazaniya-uslug-razbor` — самый частый B2B
  - `dogovor-s-marketplaceom-wb-ozon` — WB/OZON оферты
  - `dogovor-postavki-otsrochka-platezha` — B2B торговля
  - `trudovoj-dogovor-ispytanie-sroku` — ст. 70 ТК РФ
  - `dogovor-zayma-yul-naloga` — налоговые риски беспроцентного займа
  - `agentskij-dogovor-razbor` — ст. 1005 ГК, отчёт агента
  - Каждая SSG-пререндерится через `generateStaticParams`. JSON-LD
    `Article` schema, per-post OG-картинки через `next/og`.
- **`/help`** — 20 FAQ-вопросов с JSON-LD `FAQPage` schema (rich result
  в SERP) + внутренние линки на статьи.
- **`/sitemap.xml`** — auto-генерация из BRAND.publicUrl + blog corpus +
  курированные public-страницы. Исключает auth-gated.
- **`/robots.txt`** — allow всё публичное, disallow /api, dashboard,
  settings, admin, report, generated, invites.
- **Organization JSON-LD** в RootLayout (Google Knowledge Panel).
- **`metadataBase` + title template** в RootLayout — все relative OG /
  canonical URLs корректные.

### Lifecycle email cron — `/api/cron/billing-reminders`
- Раз в сутки (`vercel.json` crons[] — `0 9 * * *`, 12:00 МСК).
- Auth: `Authorization: Bearer ${CRON_SECRET}` — production обязан
  выставить CRON_SECRET в Vercel env, иначе 401.
- Stage 1: **trial expiring** — trialEndsAt ∈ (now, now+24h] + FREE
  plan → buildTrialExpiringEmail. Dedup window 14 дней.
- Stage 2: **trial expired** — trialEndsAt ∈ (now-24h, now] + FREE →
  buildTrialExpiredEmail. Dedup 14 дней.
- Stage 3: **inactive 14d** — User.plan="FREE", registered >14d, no
  AiUsage в последние 14d → buildInactiveReengagementEmail. Dedup 90
  дней. Cap 200 в сутки.
- Stage 4: **checkout abandoned** — Payment.status ∈ {PENDING,
  WAITING_FOR_CAPTURE}, createdAt 6-72h назад, succeededAt=null →
  buildCheckoutAbandonedEmail. Dedup 14 дней по (user, plan).
- Каждая отправка → `AuditEvent` с `email.*_sent` action — служит
  delivery audit + dedup key.
- Idempotent: повторный запуск не задвоит письма.

---

## Полный список коммитов работы (новейшие сверху)

### Sprint 11 — социальный слой + анти-абуз + ребрендинг (этот заход)
Коммиты, новейшие сверху (ветка `claude/sprint-8-ui-polish`, PR #7, в `main` НЕ смержено):
```
cd5d885 Stop sending `temperature` to Anthropic — current models reject it
bebd67f Rebrand ЮрИИст → Яксо
55489bd Fill operator details now that the ИП is registered
f24526a Tighten VIEWER role on two write paths flagged by review
8be490e Add a CI workflow — lint, types, tests, build on every PR
b29518f Drop the document-based ИНН verification — it proved nothing
d76620f Clarify the counterparty-contact empty states
877eb89 Fix header overflow — move workspace chat into the OrgSwitcher
9f234b9 Update CLAUDE.md for Sprint 11
ec9edb1 Add a referral programme with bonus analyses
ee9ba46 Add public read-only links to a contract analysis
166852d Add side-by-side comparison of two contracts
d142f60 Add AI-extracted contract deadlines with email reminders
4eee818 Let users forward a generated document into chats
dc8a19d Add a team chat channel inside the workspace
da5229f Add a read-only VIEWER role and in-place role management
a7f293a Let users contact a counterparty directly from the ИНН check
ba476bc Add a layered defence against trial-farming with throwaway accounts
ccfaf18 Let users link and verify a company ИНН on their profile
```
Десять фич Sprint 11:
- **ИНН на UserProfile** — `claimed` (самодекларация: checksum + DaData
  на существование; **неэксклюзивно** — анти-сквоттинг) и `verified`
  (подтверждение владения платежом с р/с компании: банк передаёт ИНН
  плательщика → авто-сверка; **планируется**, нужен ЮKassa B2B —
  блокер: регистрация ИП). Проверка по загруженной выписке **убрана** —
  публичная выписка ЕГРЮЛ/ЕГРИП не доказывает представительство.
  «Написать контрагенту» работает только с `verified`.
- **Анти-абуз** — `normalizedEmail`/`signupIp`/`signupFingerprint` на User;
  жёсткий блок одноразовых доменов и нормализованных дублей при регистрации;
  риск-скоринг при активации триала; `/admin/abuse` для ручной проверки.
- **Чат компании** — `WorkspaceMessage`, один канал на воркспейс,
  `/workspace/chat`, непрочитанные в header-nav.
- **Роль VIEWER** — read-only; UI смены ролей в `/settings/organization`.
- **Пересылка договоров в чаты** — `attachmentGeneratedDocId` на
  `WorkspaceMessage`/`DirectMessage`; «В чат» на `/generated/[id]`.
- **Напоминания** — `ContractDeadline`, AI-извлечение дат, `/deadlines`,
  5-я стадия в lifecycle-cron.
- **Сравнение договоров** — `/compare-contracts`, stateless.
- **Публичные ссылки** — `PublicShare`, `/r/[token]` без авторизации.
- **Рефералка** — `referralCode`/`referredById`/`bonusAnalyses` на User;
  выплата при активации триала; `/referral`.

Доводки и сопутствующее (коммиты после первых десяти фич):
- **Ребрендинг ЮрИИст → Яксо** — `juriist.ru` занят похожим юр-сервисом,
  ниша «юрист» перенасыщена (jurist.ru, urist.ru…). Имя `Яксо` (придуманное,
  легко защищается ТЗ), домен `yakso.ru`. ~48 файлов: `BRAND`, `CONTACTS`
  (`@yakso.ru`), i18n (RU «Яксо» / EN «Yakso»), все строки, блог, шаблоны
  писем. Логотип: весы → буквенный знак «Я» (header, auth-страницы, шапка
  писем, OG-картинки, favicon / apple-icon / PWA-иконки, `/r/[token]`).
  `BRAND.publicUrl` = `https://yakso.ru`.
- **Регистрация ИП** — OPERATOR в `legal-info.ts` заполнен: ИП Дадашева
  Зарета Райкомовна, ИНН 772580231694, ОГРНИП 310774628400191, адрес в
  Москве. `isOperatorPlaceholder()` → `false`; `/privacy`, `/offer`,
  `/terms` стали валидными. Банковский блок в `/offer` скрыт до открытия
  расчётного счёта (поля `bank*` в OPERATOR пустые).
- **CI** — `.github/workflows/ci.yml`: `lint` + `tsc --noEmit` + `vitest`
  + `next build` на каждый PR и пуш в `main`. Раньше CI не было.
- **Security-ревью Sprint 11** — эксплуатируемых уязвимостей не найдено;
  доведены 2 несостыковки роли VIEWER (public-share / deadlines POST →
  MEMBER+).
- **Проверка ИНН по выписке убрана** — публичная выписка ЕГРЮЛ/ЕГРИП не
  доказывает представительство. `claimed` стал НЕэксклюзивным (анти-
  сквоттинг), `verified` — только через будущий платёж с р/с компании
  (ждёт активации ЮKassa B2B). `/admin/inn-claims` и роут загрузки
  выписки удалены.
- **Hotfix Anthropic** — текущие модели Anthropic отвергают параметр
  `temperature` (`400 invalid_request_error`); это ломало `/api/analyze`
  в проде. `temperature` убран из всех 4 вызовов провайдера. Foot-gun #41.
- **Фиксы UX** — переполнение хедера (7-й пункт «Чат компании» уехал в
  дропдаун OrgSwitcher с бейджем непрочитанных), точные формулировки
  пустых состояний «написать контрагенту».

### Sprint 10 — сеть, PWA, доработки (предыдущий заход)
```
4d8af64 Verify risk-quote whitespace so apply-fix reliably matches
690f837 Add a user profile page to the network
b193cce Add a live document preview to the template form
9056fde Add search and category filter to the templates page
5e22f6b Fix mobile layout: invisible onboarding cards, dashboard h-overflow
b2db444 Make the app an installable PWA
e137d33 Add a real ФССП debt provider behind FSSP_AUTH_KEY
43a16e5 Harden the network: rate limits, email notifications, tests
55ee064 Fix dashboard crash for PRO_SOLO / PRO_TEAM users
f324323 Add side-balance assessment to contract analysis
6db4279 Add direct messaging to the network
cf144f8 Add document review to the network: send, discuss, copy
af8fe3e Add cross-user network: opt-in profiles, catalogue and connections
3064d71 Add a per-risk "consequence" field to contract analysis
8d69f7d Fix all src lint errors and cut npm run lint noise 27k -> 20
```

### Sprint 9 — revenue + retention + SEO
```
[этот файл] CLAUDE.md update reflecting Sprint 9 state
<свежий> Lifecycle email expansion: inactive-14d + checkout-abandoned + help + 3 more SEO articles + welcome refresh + dashboard sample CTA + backfill rename
63a9d5d Trial-conversion email cron + 3 more SEO articles + per-post OG images
b6b8706 SEO foundation: blog scaffold + sitemap + robots + 3 cornerstone articles
2551d8c Sample report page: preview of value without auth
690dbd6 Refresh landing copy
28ac21d Ground analyze/chat prompts in legal reference
523a97d 5-tier pricing rollout
f579027 152-ФЗ dual-consent
fc6a9a5 FREE → Haiku
```

### Sprint 8 → AI calibration → trial rework → biz-cleanup (предыдущий заход)
```
c2e39d1 Big CLAUDE.md update + landing cleanup + verdict reframe + KAD/FSSP hide
64e22c0 Retry prisma db push with backoff during Vercel build
64c366c Trial: stop auto-granting at signup, cut to 2 days
82ff4f7 Trim analyze prompts: shorter, less paranoid, more single-pass
3e76b33 Bump max_tokens on analyze paths — model was truncating mid-JSON
ad42093 Collect ALL provider failures in the thrown error, not just the last
19702ee Surface real exception in /api/analyze 500 response body
4ba0374 Lift Vercel function timeouts on AI routes (60s -> 300s)
2398591 Cache_control on tool schemas + analyze-prompt hardening
e65189d Per-action / per-plan model tier policy
3b038a1 AI verdict + score calibration, per-risk apply-fix, inline editing
abcc65f Drop edge runtime from /opengraph-image — was disabling static gen
448e0f8 L3+L4+L5 polish: breadcrumbs, motion polish, undo, onboarding, brand chrome
5638826 Point fixes: doc preview legibility, navigation polish
840503a Plan + trial move from workspace to user account
8acc343 Header polish + AccountMenu dropdown + /account page
4ae1cf1 Custom empty states: bespoke inline SVGs, motion entry, real CTAs
d4cc4bb ⌘K command palette: nav + actions + theme switch in one keystroke
64f8684 Micro-animations on critical interactions via motion/react
44c9eb1 Geist font + theme-aware shadow scale
238b4eb Refined palette: oklch tokens, indigo primary, color-mix borders
ccf1014 Three point fixes: theme toggle, document preview halo, mobile workspace
845bcee i18n: RU/EN provider + locale toggle + chrome strings translated
5883092 A11y audit: form labels, error live regions, focus rings, skip link
0f71587 Mobile-first overhaul: stack-on-narrow, responsive paddings, scrollable tables
9f7cf10 Dark mode: theme provider, toggle, and full palette adapt
```

### Sprint 1-4 (до этого захода)
```
7a0ad86 CLAUDE.md handoff polish (предыдущая версия этого файла)
33ff0b7 Update CLAUDE.md with Sprint 4 — audit log, 2FA TOTP, per-org analytics
e9630c5 Per-org usage analytics
088179e 2FA login integration + /account/security UI
b9d04b1 2FA core: TotpCredential schema
fd9ee7e Audit log UI
1d27cba Audit log: AuditEvent model + logAudit()
43c2cc7 PostHog client-side
3c3dbdd PostHog server-side
1db5b67 Admin: payments ledger + workspaces directory
dd8641e Admin user management
928032c Admin foundation
5d699db Refine: cut input tokens on Groq
c0ed9de Refine: patch mode with auto-fallback
aa5cbbb D5: smoke tests for all 20 templates
b8af58d C3 batch 2: 6 full contract templates
aaaed7a C3 batch 1: 5 short / supporting document templates
f67aaf9 C2 + D3: AI document refinement with SSE streaming
bddc601 Make versioning actually work end-to-end
7cee125 Persist generated documents
67a8446 Loading skeletons + global toast
9c5a6d6 Templates polish: word-level diff
79ee0dc Drop /legal (Справочник)
aec5396 Bug fixes: /billing redirects
9dceff8 Trial: cut to 7 days + manual activation
052f6ee Block creating extra FREE workspaces
f8862fc Add ЮKassa billing
3a1cb6c Grant a 14-day PRO trial
c09b8cb Add password reset flow
b12f720 Add Resend transactional email
a708ab5 Add public legal pages
9721d93 Always re-resolve activeOrgId in JWT
f1857b7 Refresh JWT before reload on workspace switch
e04f250 Show OrgSwitcher on every viewport
3f3c3cb Heal stale User.activeOrgId
d678499 Surface DB save errors
bdc0e4c Hard-reload after workspace switch
... (ещё ~50 коммитов в основной wave 1: AI core, OCR, storage,
    workspaces, тесты, Sentry, embeddings, рейт-лимит)
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
| `VOYAGE_API_KEY` | Embeddings | Только keyword-search |
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` | Error tracking | console.error only |
| `DADATA_API_KEY` + `DADATA_SECRET_KEY` | Контрагенты ЕГРЮЛ | Только моки |
| `FSSP_AUTH_KEY` | ФССП — банк исп. производств (api-ip.fssp.gov.ru, бесплатно) | Долги через заглушку |
| `RESEND_API_KEY` | Транзакционные письма | Noop-логгер |
| `RESEND_FROM_ADDRESS` | (опц.) sandbox-from | Default `no-reply@yakso.ru` |
| `YOOKASSA_SHOP_ID` + `YOOKASSA_SECRET_KEY` | Платежи | /billing/checkout вернёт 503 |
| `POSTHOG_API_KEY` + `POSTHOG_HOST` | Server-side аналитика | События не уходят |
| `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` | Client-side аналитика | Pageviews не уходят |
| `ADMIN_USER_IDS` | CSV User.id для /admin | /admin показывает 403 |
| `ADMIN_SEED_KEY` | Защита `/api/admin/*` | Default `dev-seed-key` (опасно в prod) |
| `CRON_SECRET` | Защита `/api/cron/billing-reminders` | В prod без него крон 401; в dev / preview доступ открыт для curl |

⚠️ **Все секреты должны быть проротейтены** если они когда-либо засветились в чате.

⚠️ **pgvector в Neon** — `CREATE EXTENSION IF NOT EXISTS vector;` руками в Neon SQL Editor один раз.

---

## ⚠️ Известные foot-guns (НЕ повторяй)

1. **`voyageai` SDK 0.2.1 сломан** — ESM imports без расширений. Прямой fetch в `voyage.ts`.

2. **`prisma db push` боится false-positive** на новых unique constraints. Если nullable — db push откажется добавлять. Workaround: оставь старый constraint или сделай non-nullable + дефолт.

3. **Migrations folder в SQLite-синтаксисе**. Новые — PG-стиле. Vercel build использует `db push`, не `migrate deploy`.

4. **`User.activeOrgId` — `String?`, не FK** (намеренно). `ensureActiveOrg` должен валидировать через Membership, не `IS NOT NULL`.

5. **Workspace switch требует `await update()` ДО `window.location.reload()`** — иначе JWT cookie keep'ает старый orgId.

6. **NextAuth v5 beta `useSession.update()` не всегда передаёт `trigger === "update"`**. JWT callback ВСЕГДА re-resolves activeOrgId.

7. **`prisma.$queryRaw` нельзя для композиции SQL** — используй `Prisma.sql` + `Prisma.empty`.

8. **OrgSwitcher должен иметь fallback** если `data.activeOrgId` не найден → `data.organizations[0]`.

9. **`.env` в `.gitignore`** — не возвращать.

10. **Refine patch-mode на Groq НЕ через `generate(zod)`** — добавляет ~700 токенов schema-dump'а + auto-retry удваивает input. Используй `generateText()` + ручной `safeParse`.

11. **План user-scoped, не organization-scoped.** `User.plan` — authoritative. `Organization.plan` — legacy mirror (write-through через webhook + activate-trial). `checkQuotaSafe()` находит OWNER → читает User.plan. Anti-abuse в `POST /api/organizations` тоже читает User.plan, не Org.plan. После любого изменения схемы — пускай через `/api/admin/backfill-user-plan`.

12. **`User.trialActivatedAt` пишется один раз lifetime** через `/api/billing/activate-trial`. Удалить + пересоздать workspace второй триал не даст (anti-abuse).

13. **Refine ops применяются `indexOf`'ом (no fuzzy match)**. Якорь должен встречаться РОВНО ОДИН РАЗ — иначе патч rejected, fallback на regen с `mode` SSE event.

14. **POST /api/generated создаёт v1 в той же транзакции**. БЕЗ этого «Нет версий» навсегда. GET `/versions` имеет self-heal для legacy.

15. **ЮKassa webhook — `applySucceededPayment()` re-fetches payment** через API, не доверяет body. Anti-spoofing. Идемпотентно.

16. **`Intl.NumberFormat("ru-RU")` thousands separator — U+00A0 (NBSP)**, не ASCII. В тестах `.replace(/\s+/g, " ")` перед `toContain`.

17. **PostHog client `autocapture: false` + manual page tracker**. Next 16 app-router не работает с auto-capture.

18. **Tables `LegalKnowledge` + `LegalReference` orphan** — без UI/routes. Не удалять без `--accept-data-loss`.

19. **TRIAL_DAYS = 2 и TRIAL_DAYS_LABEL = "два"** должны меняться синхронно. Тест plans.test.ts валит сборку иначе. Используется в /offer.

20. **OPERATOR placeholders начинаются с `[`**. Невозможно не заметить пока не зарегистрирован ИП/ООО. **БЕЗ реальных данных нельзя**: (а) активировать ЮKassa, (б) корректно соблюсти 152-ФЗ, (в) предоставлять чеки 54-ФЗ. **Бизнес-блокер #1.**

21. **otplib v13 убрал `authenticator` singleton** — используем functional API. `verifySync` возвращает `VerifyResult`, не plain bool.

22. **2FA login flow двухшаговый** — `/api/auth/check-2fa` сначала, потом signIn с totpCode. Один pass нельзя: signIn collapse'ит "wrong password" и "creds OK + need TOTP" в `null`.

23. **AuditEvent.orgId nullable + `onDelete: SetNull`** — журнал переживает удаление workspace.

24. **AuditAction — controlled vocab**. Новый action = добавить в TS union в `src/lib/audit.ts` И в `ACTION_LABELS` в `/settings/organization/audit/page.tsx`.

25. **КАД — заглушка** (нужен api-fns.ru ~3000₽/мес или Контур). **ФССП — реальный env-gated провайдер** `fssp-api.ts` под `FSSP_AUTH_KEY` (без ключа работает заглушка; провайдер НЕ проверен на живом ключе — сверить контракт ответа при подключении). UI /counterparty показывает warning-плашку. **НЕ продавать «проверку контрагента» как ключевую фичу пока КАД не интегрирован** — иначе trust damage.

26. **`logAudit.payload` гоняется через `redact()`** — sensitive keys (password, secret, token, email, phone) → `"[redacted]"`.

27. **AI prompt caching работает только при cumulative prefix ≥ 1024 токенов** (Sonnet/Haiku). Сейчас system + tool schema даёт ~3-4k токенов — кэшируется. TTL по умолчанию 5 минут (ephemeral). Если запросы реже — каждый раз cache miss.

28. **Vercel Hobby plan capping function timeout 60s.** Анализ длинного договора easily > 60s. `maxDuration = 300` в route только работает на Pro plan ($20/мес).

29. **Neon free tier auto-suspend через 5 минут idle.** Cold-start первое соединение может фейлиться. Решено retry-обёрткой в build script (`scripts/db-push-with-retry.mjs`). Для production-grade — Neon Launch plan ($19/мес) с always-on compute.

30. **`max_tokens` на Anthropic generate — 8192 ceiling** для Sonnet/Opus. Если контракт длинный + большая схема + verbose prompt → ответ обрезается → zod fails. Сейчас analyze single-pass = 8192, chunk extract = 4096, synthesis = 4096.

31. **Verdict labels в UI — "уровень риска", не "рекомендация подписать"**. Прямое "рекомендуется подписать" создаёт юридическую ответственность за плохой совет. Сейчас формулировки: "Низкий уровень риска" / "Средний уровень риска" / "Высокий уровень риска" + дисклеймер «это автоматическая оценка, не консультация». Если меняешь — сохрани этот тон.

32. **Vercel function memory limit на Hobby = 1024 MB.** Большой PDF + map-reduce + параллельные chunks могут упереться. Если будет — переход на Pro (3 GB) или streaming-обработка чанков.

33. **Plan-коды — не закрытое множество.** После 5-tier rollout: FREE / PRO / PRO_SOLO / PRO_TEAM / BUSINESS (+ legacy PRO). Любой `SOMEMAP[plan].xxx` без `?? fallback` падает на новом коде — так крешился дашборд (`usage-widget.tsx`, `PLAN_META` без PRO_SOLO). Любой lookup по plan-коду — с fallback.

34. **Service worker регистрируется ТОЛЬКО в production.** В `npm run dev` его нет (мешает HMR) — офлайн / установку PWA тестировать на задеплоенном сайте. `public/**` исключён из eslint (там рукописный `sw.js` с service-worker-глобалами).

35. **Вложенный flex + `truncate`**: `min-w-0` нужен на КАЖДОМ flex-предке между truncate-элементом и ограничителем ширины, не только на ближайшем. Длинное имя файла рвало вёрстку дашборда из-за `<Link flex-1>` без `min-w-0`.

36. **Сетевые мутации gated на ACCEPTED-связь + rate-limit `network` (30/мин).** Шеринг/сообщения между несвязанными юзерами → 403. Новые `/api/network/*`-роуты не забывать гейтить (`areConnected` / `networkRateLimitOk`).

37. **Роль `VIEWER` — read-only, ранг 0** (ниже MEMBER). `requireMembership(…, "MEMBER")` отсекает её автоматически. Но AI-роуты (analyze/generate/chat/generated POST) НЕ ходят через `requireMembership` — там добавлен явный `getMembership` + блок `role === "VIEWER"`. Любой новый AI-роут, тратящий квоту, тоже гейтить явно.

38. **Уникальность referralCode — в коде, не DB-constraint** (foot-gun #2: nullable unique валит `prisma db push`). Проверка коллизии перед записью + `@@index`. То же — для любого нового nullable-поля, которое «должно быть уникальным». **ИНН**: `claimed` НЕэксклюзивен (любой может указать — анти-сквоттинг), эксклюзивен только `verified`. `verified` пока недостижим в UI — путь через платёж с р/с компании ждёт активации ЮKassa B2B.

39. **Referral-бонус — пул, потребляется в `/api/analyze`.** `checkQuota` для FREE+analyze считает `limit = base + bonusAnalyses + max(0, used - base)` (держит месячный кап стабильным). `consumeReferralBonus(orgId)` декрементит пул ПОСЛЕ успешного анализа. Не дублировать декремент в других местах и не списывать в `checkQuota` (она вызывается и для отображения).

40. **`/r/[token]` — публичная страница без авторизации**, `force-dynamic` + `robots: noindex`. Токен (192 бита) — и есть доступ. Текст договора там НЕ показывается, только вердикт + риски. `/r/`, `/workspace/`, `/deadlines` добавлены в `robots.txt` Disallow.

41. **Anthropic в текущих моделях НЕ принимает `temperature`.** Запрос с этим полем падает: `400 invalid_request_error: "temperature is deprecated for this model"`. В `src/lib/ai/providers/anthropic.ts` параметр НЕ передаётся ни в одном из 4 вызовов (`generate` / `generateText` / `chat` / `streamChat`) — не возвращать его обратно. Это ломало `/api/analyze` в проде (Groq-фолбэк не спас — 413 по TPM-лимиту). `GenerateOptions.temperature` всё ещё используется провайдерами Groq/Gemini — там оставить.

42. **`toGeminiSchema` (`schema-helpers.ts`) конвертирует, а не молча режет.**
    Раньше функция выбрасывала ЛЮБОЙ нераспознанный ключ JSON-схемы — это тихо
    ломало дискриминированные union'ы: `oneOf` исчезал → `items: {}` («массив чего
    угодно»), Gemini-фолбэк возвращал мусор, не проходящий zod. Теперь `oneOf`/
    `anyOf` → Gemini-`anyOf`, `const` → одноэлементный `enum`, бессмысленные ключи
    (`$schema`, `additionalProperties`…) дропаются, а любой ДРУГОЙ неизвестный ключ →
    `throw` (ловится fallback-цепочкой AI-клиента → переход к следующему провайдеру с
    явной причиной). Следствие: добавишь в схему, идущую через `generate(zod)`,
    конструкцию `.regex()` / `z.tuple()` / прочее, что эмитит ключ вне allowlist —
    Gemini-путь упадёт громко. Через Gemini реально идут 3 схемы: analyze, chunk-
    risks, synthesis. `refine-patch` идёт через `generateText` (без схемы) — там
    discriminated union безопасен. `toAnthropicSchema` ключи НЕ фильтрует.

---

## Как дебажить когда что-то не работает

### 1. Vercel
```powershell
npx vercel inspect <deployment-id> --logs
```
Или: Vercel dashboard → Project → **Logs** tab → fire request → ищи `[ai]`, `[analyze]`, `[ai/client]`.

### 2. Browser
DevTools → Network → найди фейлящий request → **Response → Preview**. Все 500 теперь имеют `detail` поле с реальной exception message (см. `/api/analyze` route).

### 3. Sentry
Если ошибка в catch — она там с тегом `op:<route-name>`.

### 4. PostHog
Live Events для real-time потока. Funnels для конверсий.

### 5. Neon SQL Editor

```sql
-- Состояние схемы
SELECT
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='plan') AS has_user_plan,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='trialEndsAt') AS has_user_trial,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Subscription' AND column_name='userId') AS has_sub_userid,
  EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') AS has_pgvector;

-- Найти свой User.id для ADMIN_USER_IDS
SELECT id, email, "createdAt", plan, "trialEndsAt"
FROM "User"
ORDER BY "createdAt" DESC LIMIT 20;

-- Выдать себе PRO
UPDATE "User"
SET plan = 'PRO', "trialEndsAt" = NULL
WHERE email = 'твой@email';

-- MRR / active subs
SELECT s.plan, COUNT(*), STRING_AGG(o.name, ', ')
FROM "Subscription" s JOIN "Organization" o ON o.id = s."orgId"
WHERE s.status = 'ACTIVE' AND s."currentPeriodEnd" > NOW()
GROUP BY s.plan;

-- Анализ-расход за неделю по моделям (для оценки cost)
SELECT
  model,
  COUNT(*) as calls,
  SUM("inputTokens") as in_tokens,
  SUM("cachedTokens") as cached,
  SUM("outputTokens") as out_tokens
FROM "AiUsage"
WHERE "createdAt" > NOW() - INTERVAL '7 days' AND feature = 'analyze'
GROUP BY model;
```

---

## Что НЕ сделано (продуктовый TODO)

### 🔥 Бизнес-блокеры (см. roadmap ниже)
- ИП/ООО НЕ зарегистрировано → ЮKassa нельзя активировать
- OPERATOR placeholders → 152-ФЗ нарушение, /privacy несоблюдено
- Не подано уведомление в Роскомнадзор о обработке ПДн
- Resend domain не подтверждён → welcome/password-reset не уходят на реальных юзеров
- Нет .ru домена (только yakso.ru — НЕ профессионально для b2b)
- 0 каналов привлечения (SEO/PPC/партнёрки/комьюнити)

### 🚀 Расширения продукта
- REST API + API keys (Sprint 5)
- Webhooks (Sprint 5)
- Slack/Telegram bot
- Compare 2 contracts (между разными)
- Streaming для `/api/generate`
- Email-уведомления о готовности длинного анализа

### 🤝 Интеграции
- **Реальный КАД** (api-fns.ru ~3к/мес или Контур.Фокус ~40к/мес) — критично, см. foot-gun #25
- **Реальный ФССП** (public API, 100 req/день — бесплатно)
- E-signature (СберДок / Контур.Сайн)
- Битрикс24/amoCRM коннектор
- Email-to-analyze

### 💰 Биллинг полировка
- 5-tier pricing (см. бизнес-roadmap)
- Годовая подписка с 16% скидкой
- Per-seat компонент для TEAM tier
- Promo codes
- Stripe для зарубежных клиентов

### 📊 Retention infrastructure
- Email-triggers: «не заходил 14 дней», «не загрузил документ», «отменил подписку»
- Onboarding video (90 сек, Loom/Tella)
- Tooltips на 5 ключевых UI элементах (driver.js)
- Help-страница 15 FAQ
- Crisp/Tawk бесплатный чат на сайт
- Customer support: Telegram-канал @yakso_support

### ⚙️ DX
- GitHub Actions CI (npm test + tsc + build на PR)
- E2E Playwright
- Pre-commit hooks (husky + lint-staged)
- Storybook
- React component tests

### 🎨 UI polish (низкий приоритет)
- Mobile-first deep overhaul (за рамками базового)
- A11y axe-core audit + report
- Полный i18n EN перевод body content

### 🎁 Большие бизнес-фичи
- Templates marketplace (юристы продают шаблоны)
- "Verified by lawyer" badge — за +5000₽ живой юрист подписывает заключение
- SSO (SAML/OIDC) для enterprise
- Client portal (внешние юристы view-only)
- Approval workflows

### 📚 Контент
- 30+ SEO-статей про конкретные договоры
- Полная база ГК РФ / НК РФ / ТК РФ через embeddings (вернуть Справочник)
- Glossary терминов

---

## 📈 Бизнес-roadmap на 6 недель до запуска

> Это план не для разработки, это план **запуска бизнеса**. Распределение
> усилий: 30% код, 70% всё остальное. Если ты разработчик-фаундер — это
> самая частая ошибка не понимать что код != бизнес.

### Неделя 1 — Легализация (без этого ничего не работает)

| Задача | Кто | Стоимость | Где блокирует |
|---|---|---|---|
| Открыть ИП | Founder | ~800₽ госпошлина, 3 рабочих дня | ЮKassa, оферта, эквайринг, налоги |
| Подать в ЮKassa documents → получить shop_id | Founder | 0 | Платежи (без shop_id `/billing/checkout` возвращает 503) |
| Уведомление в Роскомнадзор о обработке ПДн | Founder | 0, 1 час онлайн | 152-ФЗ compliance |
| Заполнить OPERATOR в `legal-info.ts` реальными данными ИП | Dev | 15 минут | /privacy, /offer, /terms |
| Verify домен в Resend → переключить welcome/password-reset на реальную доставку | Dev | 0 | Email-onboarding |
| Купить домен `.ru` (~300₽/год) → DNS на Vercel → SSL автомат | Founder + Dev | 300₽ | Brand recognition |

**Деливераблы:** legal-чистый продукт, готовый принимать платежи.

### Неделя 2 — Critical product cleanup

| Задача | Сделано? |
|---|---|
| Удалить fake reviews / cleanup landing | ✅ В коммите [этот файл] |
| Verdict → "оценка рисков" (легальная ответственность) | ✅ В коммите [этот файл] |
| Скрыть КАД/ФССП до интеграции | ✅ В коммите [этот файл] |
| Hard cap анализов на PRO: 100/мес | ✅ Done (`plans.ts` PLAN_LIMITS — PRO_SOLO 100 / PRO_TEAM 500) |
| FREE на Haiku вместо Sonnet (cost control) | ✅ Done (`tier-policy.ts` — analyze FREE → fast) |
| Dual-consent на /register (хранение в РФ + трансграничная передача) | ⬜ TODO |
| Pricing 5-tier с годовой скидкой | ⬜ TODO (см. ниже) |
| Подключить api-fns.ru для КАД (или Контур.Фокус) | ⬜ TODO ($30-50/мес) |

**Деливераблы:** продукт честно показывает свои возможности, cost под контролем.

### Неделя 3 — Channel buildup (самое важное)

| Задача | Effort | Откуда юзеры |
|---|---|---|
| 5-10 SEO-статей на блоге (договор-оферта, ГПХ, NDA для ИТ, аренда для онлайн-школ, и т.д.) | 1 неделя content-маркетолога | Long-tail Google |
| Telegram-канал @yakso (1-2 поста/день, обновления + полезные тексты) | 2ч/день | Direct sharing |
| Telegram-канал @yakso_support | 30 мин/день | Customer retention |
| vc.ru / Habr / Skillbox — статья "Как мы построили AI-юриста" | 1 день | One-time spike |
| LinkedIn / cold DM 100 ИП-предпринимателей с "хочу подарить тебе подписку" | 2 дня | First 5-10 testimonial users |

**Деливераблы:** запущенные каналы привлечения. Первые 50 регистраций.

### Неделя 4 — Pricing + Free Tier optimization

Новая структура:

| Тариф | Цена/мес | Год | Лимиты | ICP |
|---|---|---|---|---|
| **Старт** | 0 | — | 10 анализов + 5 генераций + 0 OCR | Evaluation |
| **Pro Solo** | 1 990 ₽ | 19 990 ₽ (-16%) | 1 user, 100 анализов | Фрилансер / ИП |
| **Pro Team** | 4 990 ₽ | 49 990 ₽ (-16%) | До 5 user, 500 анализов | Малый бизнес |
| **Business** | 14 990 ₽ | 149 990 ₽ (-16%) | До 20 user, unlimited + Opus | Корпорация |
| **Enterprise** | по запросу | — | SLA, on-premise, custom | F500 |

Изменения в коде:
- `src/lib/legal-info.ts` — PRICING_RUB добавить PRO_SOLO/PRO_TEAM
- `src/lib/plans.ts` — расширить Plan type
- `prisma/schema.prisma` — Subscription.plan теперь "PRO_SOLO" | "PRO_TEAM" etc.
- `/billing` UI — 5 plan-cards вместо 2
- Backfill миграция: существующие "PRO" → "PRO_SOLO"

### Неделя 5 — Retention + Support infrastructure

- Email-triggers через Resend (Inactive 14d / Cancelled / Checkout abandoned)
- Onboarding video 90 секунд (Loom/Tella, скачать как mp4 → hostить на Vercel)
- `/help` страница с 15 FAQ (markdown rendering)
- `<DriverTour>` на 5 экранов после первого signup (driver.js)
- Crisp бесплатный чат на сайте до 100 контактов
- Customer support standard: ответ в 24ч, public Telegram

### Неделя 6 — Data + Iteration

- PostHog funnels: visit → register → upload → analyze → activate trial → upgrade → renew
- A/B test 2 варианта pricing page
- 20 user interviews (15 минут zoom) → exit interview / NPS / открытые вопросы
- Конкурентный мониторинг: что у Lawrocket, Contract.io, mainContract.io
- Iterate based on data

**После 6 недель — продукт реально готов к запуску.**

---

## Финансовая модель (быстро)

### Unit economics на Pro Solo юзере (1990₽/мес ≈ $22)

| Cost | Per юзер/мес |
|---|---|
| AI (anthropic Sonnet, 100 анализов × $0.15) | $15 |
| Infra (Vercel Pro / 100 юзеров) | $0.2 |
| DB (Neon Launch / 200 юзеров) | $0.1 |
| Email (Resend) | $0.02 |
| DaData (premium / N юзеров) | $1 |
| **Total cost** | **~$16** |
| **Revenue** | **$22** |
| **Gross margin** | **27%** |

⚠️ **Gross margin 27% низкий для SaaS** (target 70-80%). Решение: либо снизить лимит до 50 анализов, либо повысить FREE на Haiku (более частый юзер cost $7 вместо $15), либо поднять цену до 2990₽.

### Pro Team (4990₽/мес ≈ $55)

| Cost | Per юзер/мес |
|---|---|
| AI (500 анализов × $0.15 — но shared между 5 user) | $75 |

⚠️ Pro Team при безлимите **убыточен**. Решение: лимит 500 жёсткий + add-on usage pricing.

### Realistic targets

- Год 1: 200 платящих, MRR 600k₽, ARR $80k → положительный cash-flow founder-проекта
- Год 2: 1000 платящих, MRR 3M₽, ARR $400k → можно нанимать
- Год 3: $1M+ ARR — целевая отметка, без раунда возможно только через partnership

---

## Конкурентная позиция

| Игрок | Сильная сторона | Слабая | Цена |
|---|---|---|---|
| **Контур.Сайн / Контур.Норматив** | Brand, ЭЦП, ЕГРЮЛ | Дорого, бюрократический UX, не AI | 4990-39990₽/мес |
| **Lawrocket** | AI, российский, поддержка | Стартап ~2024 | 1990-9990₽/мес |
| **Garant.ru / КонсультантПлюс** | База норм, авторитет | Не AI, дорого | 50000+₽/мес |
| **ChatGPT / Claude / Gemini** | Бесплатно, мощно | Не специализированы под РФ | 0-$20/мес |

**Текущий moat: 0.** Возможные углы:
1. **Узкая ниша.** "Договоры для маркетплейсов" (WB / OZON / Я.Маркет) — концентрированная аудитория, ясный pain.
2. **Fine-tune на корпусе ВС РФ + арбитраж практики.** ~$5-10к, повышает точность.
3. **Network effect через workspaces.** Команда юриста + менеджера + бухгалтера в одной системе.

---

## Контакты infrastructure

- **GitHub**: https://github.com/zzzz212/don
- **Production**: https://yakso.ru
- **Production branch**: `main`
- **Active feature branch**: `claude/sprint-8-ui-polish`
- **Vercel project**: zzzz212-projects/don
- **Neon project**: console.neon.tech → don / yakso
- **Sentry org**: yakso
- **Voyage AI**: voyageai.com
- **Anthropic Console**: console.anthropic.com (баланс, ключи, usage)
- **Yandex Cloud**: console.cloud.yandex.ru (OCR service account)
- **PostHog**: us.posthog.com или eu.posthog.com (проверь POSTHOG_HOST)
- **ЮKassa**: yookassa.ru/my (после регистрации ИП/ООО)
- **Resend**: resend.com (после подтверждения домена)

---

## Оперативный кэш (что свежо в голове у предыдущей сессии)

- **Sprint 8 (UI polish) и AI calibration** — закрыты. Dark mode + i18n + ⌘K + AccountMenu + onboarding + custom 404/500 + Geist + oklch + motion. Plan/trial переехали на User. Verdict UI добавлен. Apply-fix per-risk + inline edit готовы. Tier policy по action × plan. Cache_control на system + tool. Retry script на Neon cold-start.
- **Sprint 9 (revenue + retention + SEO)** — закрыт. Sample report + blog scaffold с 9 cornerstone-статьями + /help FAQ + sitemap/robots/Organization-JSON-LD/FAQPage-JSON-LD/per-post-OG-images + 5-tier pricing + 152-ФЗ dual-consent + FREE→Haiku + legal-reference card в analyze prompts (~3-4К токенов закэшированных). **Lifecycle cron** с 4 стадиями: trial-expiring / trial-expired / inactive-14d / checkout-abandoned. Welcome email обновлён под бесплатный «Старт» (10 анализов вместо 3, без auto-trial). Admin backfill endpoint расширен до rename PRO → PRO_SOLO. Все 9 commit'ов запушены в claude/sprint-8-ui-polish.
- **Sprint 10 (сеть + PWA + доработки)** — закрыт (этот заход).
  Cross-user network (профили / связи / ревью договоров / личные
  сообщения; rate-limit + Resend-уведомления), установка как PWA,
  реальный ФССП-провайдер под `FSSP_AUTH_KEY`, поля `consequence` +
  `balance` в анализе + `verifyRiskQuotes`, хотфикс креша дашборда
  (`PLAN_META` без PRO_SOLO), фиксы мобильной вёрстки (онбординг был
  невидим, дашборд уезжал вбок), поиск по шаблонам, живой предпросмотр
  генерации, страница профиля коллеги. 15 коммитов в
  `claude/sprint-8-ui-polish` — **в `main` НЕ смержено**.
- **Запуск (следующий блок)** — ИП ✓ зарегистрировано. Осталось
  user-side: ЮKassa (`YOOKASSA_SHOP_ID`/`_SECRET_KEY` + включить
  B2B-платежи `b2b_sberbank` для проверки ИНН), уведомление в
  Роскомнадзор (→ `OPERATOR.rknOperatorNumber`), подключить домен
  `yakso.ru` к Vercel (A-запись `@` на IP Vercel), verify домена в
  Resend, почтовый ящик (Яндекс 360). Затем — каналы привлечения.
- **AI prompts** — после нескольких raunds tuning'a сейчас sweet spot: ~1.5k токенов system + 4k tool schema = ~5.5k кэшируемого префикса. Anthropic кэширует. Tone сбалансированный — "защищаю клиента, но не выдумываю риски".
- **TRIAL_DAYS = 2.** Активация только через `/billing` (auto-trial при signup убран).
- **Verdict UI говорит «уровень риска», не «рекомендация подписать»** (юр.ответственность).
- **КАД — заглушка; ФССП — реальный провайдер под `FSSP_AUTH_KEY`** (без ключа работает заглушка). Не продавать «проверку контрагента» как ключевую фичу пока КАД не интегрирован.
- **Vercel maxDuration = 300** на AI routes. Работает только на Pro plan ($20/мес). Hobby clamps to 60s.
- **Neon cold-start** ловится retry-обёрткой в build script.
- **Себе PRO выдать**: SQL в Neon → `UPDATE "User" SET plan = 'PRO', "trialEndsAt" = NULL WHERE email = 'твой@email';` → выход/вход для перевыпуска JWT.
- **Backfill после plan-on-user миграции** (если ещё не сделан): `curl -X POST -H "x-admin-key:..." https://yakso.ru/api/admin/backfill-user-plan`.
- **AI стоит $0.15-0.30 за анализ** на Sonnet, $0.02 на Haiku. Cache hit снижает input cost в ~3 раза. Track в Neon: `SELECT model, SUM("inputTokens"), SUM("cachedTokens"), SUM("outputTokens") FROM "AiUsage" WHERE feature = 'analyze' GROUP BY model;`.
- **План user-scoped.** OWNER membership определяет какой User.plan применяется к workspace.
- **Sprint 11 (социальный слой + анти-абуз + ребрендинг)** — закрыт (этот заход). ~19 коммитов в `claude/sprint-8-ui-polish`, открыт **PR #7** (база — `claude/complete-previous-tasks-rzcSp`, это и есть «main»), в `main` НЕ смержено. 10 фич (ИНН-привязка, слоистый анти-абуз, чат компании, роль VIEWER, пересылка договоров в чаты, AI-напоминания, сравнение договоров, публичные ссылки, рефералка) + ребрендинг в **Яксо** + регистрация ИП + CI + security-ревью + hotfix Anthropic. `lint` + `tsc` + 260 тестов + `build` — зелёные. Foot-guns #37–41.
- **Ребрендинг ЮрИИст → Яксо.** Домен `yakso.ru` (куплен на SpaceWeb, DNS подключается к Vercel — A-запись `@` должна указывать на IP Vercel). Логотип — буквенный знак «Я». `BRAND.publicUrl = https://yakso.ru`: пока домен не подключён к Vercel, ссылки в письмах / OG / `/r/[token]` ведут на ещё не работающий адрес — подключить домен примерно при мерже PR.
- **ИП зарегистрирован** — реквизиты в `legal-info.ts` (`OPERATOR`). Расчётного счёта пока нет (банковский блок оферты скрыт), RKN-номер не получен.
- **Anthropic `temperature` убран** (foot-gun #41) — ломал `/api/analyze` в проде. Groq как фолбэк для analyze слаб (free-tier 12k TPM при запросе ~24k токенов) — при падении Anthropic подстраховки нет; стоит задать `GEMINI_API_KEY`.
- **CI подключён** — GitHub Actions гоняет `lint`/`tsc`/`vitest`/`build` на каждый PR и пуш в main.
- **Тесты — 377** (было 267). Полировочный заход добавил 8 тест-файлов на
  непокрытые чистые модули: `score-calibration`, `tier-policy`,
  `contracts/numbers`, `contracts/clauses`, `ai/sse`, `network`,
  `legal-info` (launch-guard на foot-gun #20 — падает, если `OPERATOR`
  откатится в плейсхолдеры), `parsers`. Плюс зачистка оставшихся
  debug-`console.log` (dadata + counterparty-роут) и `aria-describedby`
  в inline-edit. Затем a11y-фиксы (`upload-zone`, `refine-panel`,
  `public-share-button` — `aria-label`, `role="dialog"`, Escape) и
  фича массовой проверки (`bulk.test.ts`, +8). Production-логику не
  ломали.
- **Массовая проверка договоров (`/bulk`)** — клиентская оркестрация:
  страница держит очередь файлов и шлёт их по одному в существующий
  `/api/analyze` (последовательно — само укладывается в rate-limit
  10/мин и квоту; параллельно — упрётся). Без нового API-роута и модели
  БД. Кап `MAX_BULK_FILES = 20` (50 последовательных = 30+ мин с
  открытой вкладкой). Чистый хелпер `src/lib/bulk.ts` (`bulkFileError`)
  + тест. Результаты сохраняются как обычные `Document` → видны в
  дашборде. Обнаружение — ссылка с `/analyze` и пункт ⌘K (в хедер-навигацию
  7-й пункт не добавляли — foot-gun overflow).
- **Trek A (код-долги, этот заход)** — аудит трёх пунктов. (1) Hard cap PRO
  100/мес — уже стоял в `plans.ts` (roadmap-чекбокс был устаревший, поправлен).
  (2) Plan-lookup аудит (foot-gun #33) — чисто: каждый `MAP[plan]` либо с
  `?? fallback`, либо exhaustive `Record<Plan,…>` по типобезопасному ключу.
  (3) Gemini-фолбэк: `cleanForGemini` молча резал `oneOf` → почини́л (foot-gun
  #42 + регресс-тест `schema-helpers.test.ts`). Установка `GEMINI_API_KEY` —
  по-прежнему user-side: без неё при падении Anthropic фолбэк только на слабый
  Groq.

---

**Когда читаешь это в новой сессии**: сначала отвечай 7-9 буллетами, потом спрашивай что делаем. Не пиши код без явного запроса.

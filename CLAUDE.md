@AGENTS.md

# 🚀 Открывающий промт для новой сессии

> Скопируй этот блок как первое сообщение в новой сессии. Дальше — этот же
> CLAUDE.md, читай его подряд.

```
Привет. Я работаю над Яксо — Russian legal-tech SaaS на Next.js 16 +
Prisma + Neon Postgres. ~150 коммитов, production https://yakso.ru,
активная ветка `claude/sprint-8-ui-polish`, мерж в `main` через PR #7.
Полная картина — в CLAUDE.md в корне репо.

ПЕРВОЕ ДЕЙСТВИЕ В НОВОЙ СЕССИИ

1. Прочитай CLAUDE.md целиком (~1000 строк). Там вся архитектура, схема,
   foot-guns, env vars, дебаг-рецепты, бизнес-roadmap.

2. Подтверди 7-9 буллетами:
   – Что построено (top-level overview одним абзацем-конспектом)
   – Минимум 7 критичных foot-guns
   – Текущая ветка и production URL
   – AI tier policy (FREE→Haiku, PRO→Sonnet, BUSINESS→Opus только в analyze)
   – User-scoped план (НЕ Organization.plan)
   – Бизнес-блокеры запуска
   – Что я должен сделать на стороне ЮKassa/Vercel/Resend/Neon если
     ты затронешь критичный путь

3. Спроси «что делаем сегодня». Если конкретики нет — следующий шаг
   по бизнес-roadmap в CLAUDE.md.

═══ ПРАВИЛА РАБОТЫ В ЭТОЙ СЕССИИ ═══

КАЧЕСТВО КОДА — SENIOR BAR:
- Никаких `any`. Валидация на границах (zod). Явный error-handling.
- Match the surrounding code — comment density, naming, идиомы, паттерны.
  Comments в стиле «why not what». Fire-and-forget для analytics/audit.
  Provider-abstractions для внешних интеграций.
- Не пересоздавай README/.md/документацию КРОМЕ CLAUDE.md если не просил
  явно. CLAUDE.md обновляй когда меняешь что-то структурное.

КОММУНИКАЦИЯ:
- Двусмысленный запрос — переспроси ОДНОЙ строкой ДО кода.
- Задача >2ч — TodoWrite или numbered plan ДО кода.
- Commit готов — короткое summary, не пересказ diff'а.
- Если что-то ломается В ПРОДЕ — НЕ ГАДАЙ. Попроси одно из:
    (a) Response body из Network → DevTools, ИЛИ
    (b) Vercel Logs (Deployments → последний → Functions → Logs)

КОММИТЫ И PUSH:
- Атомарные, со связными multi-line сообщениями («почему», не «что»).
  Стиль смотри в `git log` на этой ветке.
- Identity: `Claude <noreply@anthropic.com>` через флаги
  `-c user.name="Claude" -c user.email="noreply@anthropic.com"`.
  НЕ трогай глобальный git config.
- Перед commit: `npx tsc --noEmit` + `npm test` — должны пройти.
- Перед push: `npx next build` — должен пройти. Локально нужны env:
    DATABASE_URL="postgresql://x:y@localhost:5432/db"
    AUTH_SECRET="build-check-only-not-a-real-secret"
- Push в `claude/sprint-8-ui-polish`. Мерж в `main` делает пользователь
  через GitHub PR. После merge — auto-deploy на Vercel.

СХЕМА БД:
- Все миграции через `prisma db push` БЕЗ `--accept-data-loss`. Если
  push потенциально теряет данные — переделай схему.
- В Vercel build: `node scripts/db-push-with-retry.mjs` (retry-обёртка
  для Neon cold-start, 5 попыток с backoff 2/3/5/8/13с).

БЕЗОПАСНОСТЬ:
- НЕ трогай .env (в .gitignore).
- НЕ копируй секреты в чат. Если увидел в diff — попроси проротейтить.
- Тесты с реальными API-ключами — мокай.

NEXT.JS 16 (НЕ та Next.js что помнит твоё обучение):
- `useSearchParams()` ОБЯЗАТЕЛЬНО внутри `<Suspense>`.
- Server actions: `cookies()` / `headers()` требуют `await` (Next 16).
- Перед новой Next-фичей — `Read node_modules/next/dist/docs/...` если
  не уверен. Heed deprecation notices.

ЕСЛИ Я НЕ ОТВЕЧАЮ НА УТОЧНЯЮЩИЙ ВОПРОС: переспроси один раз. Дальше —
минимально-инвазивный вариант + явная отметка что оставил под уточнение.

Готов? Читай CLAUDE.md, потом 7-9 буллетов, потом «что делаем сегодня».
```

---

# Яксо — состояние проекта

**Дата последнего обновления**: 2026-05-21 (после Sprint 13 — переход
от «делового модерна» к «тёплому минимализму»: cream-палитра + terracotta
primary + warm-ink + warm-сепия тени; полная переписка лендинга
структурой и тоном — split-hero с live sample-card, новая копия, snесли
fake-stats и feature-dump'ы; прокидка по 27 auth-экранам через токены +
PageHeader; brand-chrome favicon/PWA/OG + email-шаблоны под новый
палитр).

| | |
|---|---|
| **Production** | https://yakso.ru |
| **Repo** | https://github.com/zzzz212/don |
| **Active branch** | `claude/sprint-8-ui-polish` (мерж в `main` через PR #7) |
| **Main branch** | `claude/complete-previous-tasks-rzcSp` (та, что зовём «main») |
| **Stack** | Next.js 16 / React 19 / TypeScript / Prisma + Neon Postgres (pgvector) / NextAuth v5 beta.30 / Tailwind 4 (CSS-first + @custom-variant) / Geist + Source Serif 4 / motion (Framer v12) / Anthropic Claude 4.x (Haiku/Sonnet/Opus) с prompt caching |
| **Тесты** | 389 unit-тестов через vitest (`npm test`) |

Russian legal-tech SaaS: AI-анализ договоров с verdict и per-risk apply-fix
+ 20 шаблонов генерации + AI-refine + чат-юрист + проверка контрагентов
(DaData/ЕГРЮЛ работают; ФССП — env-gated провайдер под `FSSP_AUTH_KEY`,
КАД — заглушка) + workspaces + ЮKassa-биллинг + 2FA + audit log +
admin-панель + PostHog + dark mode + i18n + ⌘K + AccountMenu + onboarding
+ кастомные 404/500/OG + /blog с 9 cornerstone-статьями + /help FAQ +
/sample-report preview + sitemap/robots/JSON-LD + Vercel cron для
lifecycle-писем + сеть между пользователями (профили / связи / ревью
договоров / личные сообщения) + установка как PWA на телефон + массовая
проверка договоров + платформенная оболочка (sidebar + page-header) на
всех authenticated экранах.

---

## 📐 Архитектура (что построено, по слоям)

### AI core — `src/lib/ai/`

- **`client.ts`**: `generate()` / `generateText()` / `chat()` / `streamChat()`.
  Fallback chain `anthropic → gemini → groq → demo`. При падении всех
  провайдеров — consolidated `AIError` со списком ВСЕХ ошибок (не только
  last). См. foot-guns #41 (temperature), #42 (Gemini schema).
- **Структурированный вывод через zod**: схемы в `src/lib/ai/schemas/`
  (`analyze.ts` с verdict-полем, `chunk.ts`, `refine-patch.ts`).
- **Anthropic prompt caching**: `cache_control` на system + tool +
  предпоследнем сообщении в чате. Cumulative prefix > 1024 tokens —
  кэшируется. TTL 5 минут (ephemeral).
- **Tier policy** (`src/lib/ai/tier-policy.ts`) per-action × per-plan:
    - analyze: FREE→smart, PRO→smart, BUSINESS→deep (Opus только тут)
    - generate / refine / chat: FREE→fast, PRO→smart, BUSINESS→smart
  Единственный entry-point — `pickTier(action, plan)`.
- **Streaming**: SSE через `src/lib/ai/sse.ts`. StreamEvent kinds:
  `delta | usage | error | done | saved | mode`.
- **Multi-pass анализ** (`chunkContract()` + map-reduce). Порог
  short-document = **50_000 chars** (Sonnet 200k context справляется).
- **Verdict calibration** (`src/lib/ai/score-calibration.ts`):
  единственный источник истины для score→verdict mapping. Три пути
  (prompt-инструкции, fallback synthesis, demo provider) не могут
  разойтись. Verdict: `"sign" | "negotiate" | "do_not_sign"`. В UI
  отображается как «уровень риска», не как императив (foot-gun #31).
- **Per-risk поля**: `consequence` («чем конкретно грозит риск») +
  top-level `balance` («в чью пользу смещён договор»). Оба `.optional()`
  для бэк-совместимости со старыми анализами. `verifyRiskQuotes`
  (`quote-verify.ts`) пост-обрабатывает `originalText`: снапит цитату
  к точной подстроке договора при расхождении по пробелам.
- **AI-refine** (`/api/generated/[id]/refine`) — patch-mode (default)
  через `extractJsonObject` + `safeParse`. НЕ через `generate(zod)` —
  это раздувает токены на Groq (foot-gun #10). Fallback на regen
  streamChat при mismatched anchors.
- **Smart suggestions per-risk** (apply-fix на `/report`): для каждого
  риска кнопка «Применить» заменяет `originalText` → `recommendedText`
  в client-side working copy; sticky toolbar скачивает patched DOCX.

### Embeddings — `src/lib/embeddings/`

- Voyage AI (`voyage-3-large`, 1024 dim) через прямой fetch. **НЕ
  `voyageai` SDK** — он сломан (foot-gun #1).
- Используется для семантического поиска по `DocumentChunk`. RAG в чате
  убран — модель достаточно умна и без него.

### OCR — `src/lib/ocr/`

- Yandex Vision adapter, multi-page split через `pdf-lib`
  (`MAX_PAGES_PER_DOCUMENT = 30`).
- Триггерится в `/api/analyze` если `pdf-parse` вернул < 30 chars/page.
- Доступен только PRO / BUSINESS.

### Storage — `src/lib/storage/`

- Vercel Blob adapter + noop fallback. Sanitize filename + random suffix.

### Counterparty — `src/lib/counterparty/`

- Provider abstraction. **DaData + ЕГРЮЛ работают**.
- **КАД — заглушка** (нужен api-fns.ru ~3000₽/мес или Контур.Фокус
  ~40000₽/мес).
- **ФССП — реальный провайдер** (`providers/fssp-api.ts`,
  `FSSP_AUTH_KEY`, async-флоу api-ip.fssp.gov.ru, поиск ЮЛ по имени).
  НЕ проверен на живом ключе — сверить контракт ответа при подключении.
- UI `/counterparty` показывает warning-плашку вместо литералов «0 дел»
  пока КАД не интегрирован. См. foot-gun #25.
- **Risk-scoring учитывает статус компании** (LIQUIDATING/INACTIVE →
  жёсткий каркас оценки + регресс-тест).

### Workspaces — `src/lib/org.ts`

- Модели: `Organization` / `Membership` / `Invite`. Lazy migration через
  `ensureActiveOrg(userId)` в 3 уровня (happy / recovery / bootstrap).
  **Bootstrap БОЛЬШЕ НЕ выдаёт триал автоматически** — активация только
  через `/billing` → `/api/billing/activate-trial`.
- Anti-abuse: max 1 FREE workspace + max 10 total per user. Использует
  `User.plan` (user-scoped план), не `Organization.plan`. См. foot-gun #11.
- JWT callback **всегда re-resolves** `activeOrgId` (без guard на
  `trigger === "update"` — foot-gun #6).
- Workspace switch требует `await update()` ДО `window.location.reload()`
  (foot-gun #5).

### Network — сеть между пользователями (Sprint 10) — `src/lib/network.ts`

- Слой НАД workspaces. Модели Prisma: `UserProfile` (opt-in каталог,
  флаг `discoverable` по умолчанию `false`, 152-ФЗ), `Connection`
  (юзер↔юзер: PENDING / ACCEPTED / DECLINED), `DocumentShare` (договор
  на ревью), `ShareComment` (тред), `Conversation` + `DirectMessage`
  (личные сообщения, `pairKey` = sorted id-пара).
- Хелперы: `ensureProfile`, `connectionStates`, `areConnected`,
  `conversationPairKey`, `networkRateLimitOk`, `NETWORK_USER_SELECT`,
  `shapeNetworkUser`.
- API `/api/network/*`: `profile`, `directory` (только discoverable),
  `connections (+[id])`, `shares (+[id], comments, copy)`,
  `messages (+[id])`, `users/[id]`.
- Страницы: `/network` (Каталог / Связи / Ревью / Профиль),
  `/network/shares/[id]`, `/network/messages (+/[id])`, `/network/users/[id]`.
- Гейтинг: шеринг и сообщения — только между ACCEPTED. Rate-limit
  `network` (30/мин) на content-POST'ах. Уведомления (Resend):
  `connection-request`, `document-shared`, `network-message` (последнее
  ТОЛЬКО на первое сообщение в треде — иначе спам). Foot-gun #36.

### PWA — установка на телефон (Sprint 10)

- `src/app/manifest.ts` — манифест (Next авто-линкует).
- `/pwa/icon` — иконки 192/512/maskable через `next/og`.
- `public/sw.js` — рукописный SW: cache-first для `/_next/static`,
  network-first для навигаций с офлайн-фоллбэком, `/api/*` НЕ кэшируется.
- `ServiceWorkerRegister` — **только в production** (foot-gun #34).
- `InstallPrompt` — `beforeinstallprompt` (Android/Chrome) + ручная
  подсказка на iOS.
- `layout.tsx`: `viewport` export (theme-color, viewport-fit cover),
  `appleWebApp` metadata.

### Plans + Trial — `src/lib/plans.ts` + `src/lib/legal-info.ts`

- 5-tier rollout: FREE / PRO_SOLO / PRO_TEAM / BUSINESS (+ legacy PRO).
- **План user-scoped**: `User.plan` — authoritative, `Organization.plan` —
  legacy mirror (sync через webhook + activate-trial). См. foot-gun #11.
- **TRIAL_DAYS = 2** (`TRIAL_DAYS_LABEL = "два"`). Меняй синхронно
  (foot-gun #19).
- `getEffectiveUserPlan(user)` — pure helper. Если `plan === "FREE" &&
  trialEndsAt > now` → returns `{plan: "PRO", isTrial: true}`.
- **One trial per user lifetime** через `User.trialActivatedAt`
  (foot-gun #12).
- Manual activation: `POST /api/billing/activate-trial` — атомарно
  пишет `User.trialActivatedAt` + `User.trialEndsAt` + `Organization.trialEndsAt`.

### Quotas — `src/lib/quota.ts`

- `checkQuotaSafe(orgId, feature)` находит OWNER membership → читает
  `User.plan` владельца → возвращает effective plan + квоту. Fail-open
  на DB ошибке.
- FREE: 3 analyze + 2 generate + unlimited chat + 0 OCR.
- PRO_SOLO: 100 analyze. PRO_TEAM: 500 на команду. BUSINESS: unlimited
  + Opus в analyze.

### Subscription + Payment — `src/lib/billing/`

- `Subscription` (one-per-org, `Subscription.userId` nullable для
  rollout) + `Payment` (one-per-attempt, idempotent на `idempotenceKey`).
- ЮKassa REST через прямой fetch. HTTP Basic + Idempotence-Key.
- **`applySucceededPayment`** (foot-gun #15):
  1. Re-fetches payment через ЮKassa API (anti-spoofing — не доверяет body).
  2. Если succeeded + not already applied → транзакция: upsert
     Subscription, update `User.plan` (authoritative) + Organization.plan
     (legacy mirror), `User.trialEndsAt = null`, send receipt email.
- Webhook `/api/billing/webhook`. Status `/api/billing/status` (OWNER+).
  Lightweight probe для AccountMenu — `/api/account/plan`.
- Backfill legacy юзеров: `POST /api/admin/backfill-user-plan`
  (x-admin-key, idempotent, расширен до rename PRO → PRO_SOLO).

### Templates + Generation — `src/lib/contracts/`

- 20 шаблонов: NDA, аренда, купля-продажа, услуги, поставка, заём,
  агентский, подряд, трудовой, дарение, мена, цессия, франчайзинг,
  перевозка, хранение + 5 supporting (доп.соглашение, акт работ, акт
  услуг, расписка, расторжение).
- Категории: Конфиденциальность / Недвижимость / Торговля / Финансы /
  Услуги / Кадры / Документооборот.
- Smoke-тесты в `__tests__/templates.test.ts` на каждый id + ветвь
  опциональных полей.
- `numbers.ts` — `moneyDisplay(rub)` → `"100 000 (сто тысяч) рублей"`.
  Thousands separator — U+00A0 (NBSP), не ASCII (foot-gun #16).
- `clauses.ts` — переиспользуемые блоки (`forceMajeure`, `dispute`,
  `finalProvisions`, `signatureBlock`) с grammar для Договора (м.р.) /
  Соглашения (с.р.).
- AI-generation tier: FREE на Haiku 4.5, PRO+ на Sonnet.
- **Документы генерируются детерминированно** через `generateContract()`
  + `/api/generated`. AI-роут `/api/generate` удалён в Sprint 12 — был
  мёртвый код.

### Versioning — `DocumentVersion`

- `POST /api/generated` создаёт `GeneratedDocument` + v1 в одной
  транзакции (foot-gun #14).
- `POST /api/generated/[id]/create-version` создаёт N+1 + денормализует
  content/formData на родителя.
- `POST /api/versions/revert` — workspace-auth, создаёт «Восстановление
  vN» + денормализует.
- `GET /api/generated/[id]/versions` — **self-heal**: материализует v1
  из `doc.content` для legacy документов.
- **Inline edit title**: `PATCH /api/generated/[id]` (zod, workspace-
  scoped). UI через `<InlineEdit>`.
- Edit-flow через `?editDoc=X` на `/templates/[id]`.
- Diff: Myers (`diff` npm) на уровне строк через `diffArrays`. Single-
  line replace coalesce'ится в «modified» hunk с word-level diff
  (`diffWordsWithSpace`). UI: `/generated/[id]/compare/[v1]/[v2]/page.tsx`
  + Breadcrumbs.
- Sticky «Сравнить v1↔v3» bar.

### Email (Resend) — `src/lib/email/`

- Provider abstraction: `ResendEmailProvider` + `NoopEmailProvider`
  (warns to console, не падает).
- `sendEmail()` **НИКОГДА не throws** — fire-and-forget, ошибки в Sentry.
- Шаблоны: `welcome.ts` (переписан под бесплатный «Старт» без
  auto-trial), `invite.ts`, `password-reset.ts`,
  `subscription-activated.ts`. Inline CSS, HTML escape.
- Layout helper `renderEmailHtml({preview, body, cta?, ctaFallbackNote?})`.

### Password reset — `src/lib/password-reset.ts`

- `PasswordResetToken`: только SHA-256 hash в БД, plaintext только в
  email. 256-bit random hex, 30 min TTL, single-use.
- Consume инвалидирует все unused tokens того же юзера.
- OAuth-only юзеры — silently skip.

### Public legal pages — `/privacy` / `/terms` / `/offer`

- Single source of truth: `src/lib/legal-info.ts` (BRAND, OPERATOR,
  CONTACTS, PRICING_RUB, TRIAL_DAYS, etc.).
- ИП зарегистрирован — реквизиты заполнены. `isOperatorPlaceholder()` →
  `false`. Банковский блок в `/offer` скрыт до открытия расчётного
  счёта (`OPERATOR.bank*` пустые).
- `<LegalPageShell>` — sticky TOC + prose body.
- В footer (Disclaimer) ссылки на все три. В `/register` — обязательный
  checkbox согласия (152-ФЗ dual-consent: хранение в РФ + трансграничная
  передача).

### Admin panel — `src/lib/admin.ts`

- Env-allowlist через `ADMIN_USER_IDS` (CSV `User.id`). НЕ `User.role`
  column. `requireAdmin(userId)` throws `AdminAccessError` (403).
- `/admin` — 11 stat-карточек. MRR из Subscription × PRICING_KOPECKS.
  Sub-nav (Пользователи/Workspaces/Платежи/Анти-абуз) в PageHeader.actions.
- `/admin/users` — paginated с search + filters (URL-synced).
- `/admin/users/[id]` — профиль + workspaces + usage + payments 30d +
  «+7 дней триала» (фиксированно 7, не зависит от TRIAL_DAYS) +
  «Смена тарифа» (manual Subscription без Payment).
- `/admin/payments` — ledger с filters.
- `/admin/orgs` — directory с deep-link на владельца.
- `/admin/abuse` (Sprint 11) — кластеры по IP / fingerprint + помеченные
  аккаунты с risk-скором; ручная проверка.
- `/api/admin/me` — boolean для AccountMenu admin-link gating.

### Analytics (PostHog)

- Server-side `captureEvent` lazy-loads `posthog-node`, `flushAt: 1`,
  fire-and-forget. PII-free (`distinctId = cuid`).
- 17 событий на критичных путях.
- Client-side `<PostHogProvider>`: `autocapture: false`, manual
  `<PostHogPageviewTracker>`, `person_profiles: "identified_only"`
  (foot-gun #17).

### Audit log — `src/lib/audit.ts` + `AuditEvent`

- One row per security/billing action. `redact()` стрипает sensitive
  keys (`password`, `secret`, `token`, `email`, `phone`) → `"[redacted]"`
  (foot-gun #26).
- `AuditAction` — controlled vocab (TS union). Новый action = добавить
  в union И в `ACTION_LABELS` на `/settings/organization/audit/page.tsx`
  (foot-gun #24).
- `attribution(request)` возвращает `{ip, userAgent}`.
- `onDelete: SetNull` на `orgId` — журнал переживает удаление workspace
  (foot-gun #23).
- UI: `/settings/organization/audit` с 5 quick-filter chips + Breadcrumbs.

### 2FA TOTP — `src/lib/totp.ts` + `TotpCredential`

- `otplib` v13 functional API (foot-gun #21). 6-digit, 30s period, ±1
  step tolerance.
- Recovery codes: 10 шт, формат `xxxx-xxxx`, SHA-256 хэши в БД.
- Login flow двухшаговый: `POST /api/auth/check-2fa` → если
  `requires2FA=true` → второй submit signIn с `totpCode` (foot-gun #22).
- Audit `auth.2fa_enabled` / `auth.2fa_disabled` с proofKind.

### UX foundation — `src/components/`

**Платформенная оболочка (Sprint 12)** — двухколоночный shell на всех
auth-страницах. Это не «сайт с навбаром», это полноценное приложение.

- **`<AppShell>`** (`app-shell.tsx`) — корневой каркас auth-страниц.
  Persistent left sidebar + content column + mobile top bar (только
  ниже `lg`, с hamburger). Снизу `<Disclaimer />`. Каждая auth-страница
  начинается с `<AppShell>…</AppShell>` (foot-gun #44).
- **`<Sidebar>`** (`sidebar.tsx`) — sticky 240px-колонка на `lg+`,
  slide-in drawer ниже. Структура сверху вниз: Logo → OrgSwitcher →
  6 nav-пунктов (Дашборд / Анализ / Шаблоны / Контрагенты / Чат / Сеть)
  → AccountMenu + CommandPalette + ThemeToggle в нижней полке.
  Mobile drawer: WCAG dialog pattern — focus moves into drawer on open,
  Tab cycles внутри панели, restore-focus на close. `bg-black/60` для
  scrim (foot-gun #43).
- **`<PageHeader>`** (`page-header.tsx`) — единая шапка контента:
  `bg-card`-полоса с волосяной нижней границей. Props: `title`,
  `description?`, `eyebrow?`, `actions?` (правый слот). Каждая
  AppShell-страница открывается этим компонентом.
- **`<MenuButton>`** (`menu-button.tsx`) — overflow-dropdown. Items
  с icon + onClick или href; `danger`/`disabled` варианты. Outside-click
  + Escape. Используется на `/report` и `/generated/[id]` для
  consolidate'а 7-9 кнопок до 4-5 видимых + overflow.
- **`<Header>`** (`header.tsx`) — только публичные страницы (landing,
  /blog, /help, /sample-report, /privacy/terms/offer, /pricing,
  /login/register/password-reset). НЕ смешивать с AppShell (foot-gun #44).

**Дизайн-система «тёплый минимализм»** (Sprint 13):

- **Цвета** — hex-токены: terracotta `#C2613F` (primary CTA) на тёплом
  cream `#F5EDDF`, warm ink `#1F1B16` (foreground), sage `#6E7F62`
  (accent), волосяная граница `#E3D8C5`; тёмная тема — coffee charcoal
  `#1A1612` с lifted terracotta `#E08966`. Тени с тёплой сепия-rgba
  `rgba(96, 56, 26, …)` — drop усиливает paper feel вместо ухода в
  холодный cool-gray. color-mix borders.
- **Шрифты**: Geist (body) + Source Serif 4 (`h1`/`h2`, переменный,
  кириллица, заданы глобально в `globals.css`) — оба через next/font.
  Заголовки `semibold` под serif. Theme-aware shadow scale.
- **Айдентика**: `<Logo>` — warm-ink плашка с serif-«Я» (cream
  foreground), авто-инверсия в тёмной. favicon/apple-icon/PWA-иконки/OG
  ручные через `next/og` ImageResponse, синхронизированы по палитре с
  in-app Logo. Email-шаблоны (`renderEmailHtml`) тоже на cream/terracotta.
- **Примитивы**: `<Button>` / `buttonClass()` (5 размеров × 4 варианта,
  binds к `bg-primary text-primary-fg` — авто-подхват токенов),
  `<Badge>` (`tone` prop). `risk-badge` — обёртка над `<Badge>`.

**Прочие столпы**:

- **Dark mode**: `ThemeProvider` (light/dark, system дефолт). Inline
  no-FOIT script в `<head>`. CSS variables в `:root` / `.dark`.
  Tailwind 4 `@custom-variant dark`.
- **i18n** (RU/EN): `I18nProvider`, `messages.ts`, `useT()`. LanguageToggle
  убран из header (вернуть когда дозреем до EN-аудитории).
- **Motion** (motion/react v12): spring анимации на toast, OrgSwitcher,
  mobile drawer, refine modal, onboarding modal, dropdown'ы.
- **⌘K command palette** (`<CommandPalette>`): nav + actions + theme
  toggle. j/k navigation, Enter/Esc.
- **AccountMenu**: avatar dropdown с профилем, planChip (тариф+триал),
  links на billing/security/account/admin/logout. В sidebar bottom-rail
  (на mobile — в top-bar). Escape close.
- **OrgSwitcher**: workspace pill + dropdown (Settings + Invite + Create
  + workspace-чат с unread-бейджем). Trial badge перенесён в
  AccountMenu (план — user-scoped). Escape close.
- **InlineEdit** (`<InlineEdit value onSave variant maxLength />`):
  click pencil → input → Enter/blur save → Esc cancel. Используется
  для workspace name + doc title.
- **OnboardingModal**: 3 illustrated карточки при первом login (once
  per browser, localStorage flag).
- **Breadcrumbs**: на `/generated/[id]/versions` и `/compare` — добавляют
  doc-specific контекст, который sidebar дать не может.
- **Empty states**: bespoke inline SVG (Docs / Chat / Counterparty /
  Search). `<EmptyState illustration title description actions />`.
- **Toast actions**: optimistic undo (dashboard delete, 5s window).
- **Custom 404 / 500** (`not-found.tsx` / `error.tsx`) с inline SVG;
  `error.tsx` forward'ит в Sentry.
- **Programmatic favicon** (`app/icon.tsx`, 32×32) + `apple-icon.tsx`
  (180×180) через `next/og` ImageResponse.
- **Dynamic OG image** для landing (`app/opengraph-image.tsx`),
  Node.js runtime (НЕ edge — Next 16 warning).
- **Skeleton**: shimmer sweep вместо pulse.
- **Modal scrim** — везде `bg-black/60 backdrop-blur-md` (foot-gun #43).
- **A11y**: `:focus-visible` rings (с opt-out для form fields),
  `prefers-reduced-motion`, skip-link, ARIA labels везде, `useId` для
  htmlFor связей. Mobile drawer — `role="dialog"`, Escape, focus-trap.
- **Mobile-first**: hamburger 44px touch target, OrgSwitcher compact
  на narrow, admin tables в `overflow-x-auto` с `min-w-[640px]`,
  sidebar → drawer ниже `lg`.

### Rate limit — `src/lib/rate-limit.ts`

- Upstash Redis с in-memory fallback.
- Endpoints: `analyze` (10/min), `chat` (30/min), `generate` (10/min),
  `billing.checkout` (10/min), `network` (30/min), default (60/min).

### Telemetry — `src/lib/telemetry.ts`

- Sentry через `instrumentation.ts` (Next 15+ pattern). 4xx filtered в
  `beforeSend`. `reportError(error, {op, tags, extra, userId})`.

### Build pipeline

- `package.json` build: `prisma generate && node scripts/db-push-with-retry.mjs && next build`.
- `scripts/db-push-with-retry.mjs` — 5 попыток с backoff (2/3/5/8/13с)
  для Neon cold-start (foot-gun #29).
- Vercel function timeouts: 300s на `/api/analyze`, `/api/generate`,
  `/api/refine`, `/api/chat`, `/api/documents/[id]/reanalyze` (требует
  Pro plan; Hobby clamps to 60s — foot-gun #28).
- CI: `.github/workflows/ci.yml` гоняет `lint` + `tsc --noEmit` +
  `vitest` + `next build` на каждый PR и пуш в `main`.

### Acquisition / SEO — `src/app/{blog,help,sample-report,sitemap,robots}/`

- **`/sample-report`** — публичный preview анализа без логина (типовой
  IT-services договор, 2 critical + 2 medium + 1 low; verdict
  do_not_sign / score 2). Главный conversion-рычаг. Линкуется с landing
  hero, /analyze, /help, dashboard empty-state.
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
  - SSG через `generateStaticParams`. JSON-LD `Article` schema,
    per-post OG-картинки через `next/og`.
- **`/help`** — 20 FAQ с JSON-LD `FAQPage` schema (rich result в SERP).
- **`/sitemap.xml`** — auto-генерация из `BRAND.publicUrl` + blog corpus
  + курированные public-страницы. Исключает auth-gated.
- **`/robots.txt`** — allow всё публичное, disallow `/api`, `/dashboard`,
  `/settings`, `/admin`, `/report`, `/generated`, `/invite`, `/r/`,
  `/workspace/`, `/deadlines`.
- **Organization JSON-LD** в RootLayout (Google Knowledge Panel).
- **`metadataBase` + title template** в RootLayout — все relative OG /
  canonical URLs корректные.

### Lifecycle email cron — `/api/cron/billing-reminders`

- Раз в сутки (`vercel.json` crons[] — `0 9 * * *`, 12:00 МСК).
- Auth: `Authorization: Bearer ${CRON_SECRET}` — production должен
  выставить, иначе 401.
- 4 стадии:
  1. **trial expiring** — `trialEndsAt ∈ (now, now+24h] && FREE` →
     `buildTrialExpiringEmail`. Dedup 14 дней.
  2. **trial expired** — `trialEndsAt ∈ (now-24h, now] && FREE` →
     `buildTrialExpiredEmail`. Dedup 14 дней.
  3. **inactive 14d** — `User.plan="FREE"`, registered >14d, no `AiUsage`
     в последние 14d → `buildInactiveReengagementEmail`. Dedup 90 дней,
     cap 200 в сутки.
  4. **checkout abandoned** — `Payment.status ∈ {PENDING, WAITING_FOR_CAPTURE}`,
     `createdAt 6-72h назад`, `succeededAt=null` → `buildCheckoutAbandonedEmail`.
     Dedup 14 дней по (user, plan).
- Каждая отправка → `AuditEvent` с `email.*_sent` action (delivery
  audit + dedup key).
- Идемпотентен: повторный запуск не задвоит письма.

---

## 🔌 Внешние сервисы и env vars

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
| `FSSP_AUTH_KEY` | ФССП — банк исп.производств (api-ip.fssp.gov.ru, бесплатно) | Долги через заглушку |
| `RESEND_API_KEY` | Транзакционные письма | Noop-логгер |
| `RESEND_FROM_ADDRESS` | (опц.) sandbox-from | Default `no-reply@yakso.ru` |
| `YOOKASSA_SHOP_ID` + `YOOKASSA_SECRET_KEY` | Платежи | `/billing/checkout` вернёт 503 |
| `POSTHOG_API_KEY` + `POSTHOG_HOST` | Server-side аналитика | События не уходят |
| `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` | Client-side аналитика | Pageviews не уходят |
| `ADMIN_USER_IDS` | CSV `User.id` для `/admin` | `/admin` показывает 403 |
| `ADMIN_SEED_KEY` | Защита `/api/admin/*` | Default `dev-seed-key` (опасно в prod) |
| `CRON_SECRET` | Защита `/api/cron/billing-reminders` | В prod без него крон 401; в dev/preview доступ открыт для curl |

⚠️ **Все секреты должны быть проротейтены** если они когда-либо засветились
в чате.

⚠️ **pgvector в Neon** — `CREATE EXTENSION IF NOT EXISTS vector;`
руками в Neon SQL Editor один раз.

---

## ⚠️ Известные foot-guns (НЕ повторяй)

1. **`voyageai` SDK 0.2.1 сломан** — ESM imports без расширений. Прямой
   fetch в `voyage.ts`.

2. **`prisma db push` боится false-positive** на новых nullable unique
   constraints. Если nullable — push откажется. Workaround: оставь
   старый constraint, или сделай non-nullable + дефолт, или проверяй
   уникальность в коде + `@@index`.

3. **Migrations folder в SQLite-синтаксисе**. Новые — PG-стиле. Vercel
   build использует `db push`, не `migrate deploy`.

4. **`User.activeOrgId` — `String?`, не FK** (намеренно). `ensureActiveOrg`
   должен валидировать через `Membership`, не `IS NOT NULL`.

5. **Workspace switch требует `await update()` ДО `window.location.reload()`** —
   иначе JWT cookie keep'ает старый orgId.

6. **NextAuth v5 beta `useSession.update()` не всегда передаёт
   `trigger === "update"`**. JWT callback ВСЕГДА re-resolves `activeOrgId`.

7. **`prisma.$queryRaw` нельзя для композиции SQL** — используй
   `Prisma.sql` + `Prisma.empty`.

8. **OrgSwitcher должен иметь fallback** если `data.activeOrgId` не
   найден → `data.organizations[0]`.

9. **`.env` в `.gitignore`** — не возвращать. Не упоминать содержимое
   в чате.

10. **Refine patch-mode на Groq НЕ через `generate(zod)`** — добавляет
    ~700 токенов schema-dump'а + auto-retry удваивает input. Используй
    `generateText()` + ручной `safeParse`.

11. **План user-scoped, не organization-scoped.** `User.plan` —
    authoritative. `Organization.plan` — legacy mirror (write-through
    через webhook + activate-trial). `checkQuotaSafe()` находит OWNER →
    читает `User.plan`. Anti-abuse в `POST /api/organizations` тоже
    читает `User.plan`. После любого изменения схемы — пускай через
    `/api/admin/backfill-user-plan`.

12. **`User.trialActivatedAt` пишется один раз lifetime** через
    `/api/billing/activate-trial`. Удалить + пересоздать workspace
    второй триал не даст.

13. **Refine ops применяются `indexOf`'ом (no fuzzy match)**. Якорь
    должен встречаться РОВНО ОДИН РАЗ — иначе патч rejected, fallback
    на regen с `mode` SSE event.

14. **`POST /api/generated` создаёт v1 в той же транзакции**. БЕЗ этого
    «Нет версий» навсегда. `GET /versions` имеет self-heal для legacy.

15. **ЮKassa webhook — `applySucceededPayment()` re-fetches payment**
    через API, не доверяет body. Anti-spoofing. Идемпотентно.

16. **`Intl.NumberFormat("ru-RU")` thousands separator — U+00A0 (NBSP)**,
    не ASCII. В тестах `.replace(/\s+/g, " ")` перед `toContain`.

17. **PostHog client `autocapture: false` + manual page tracker**. Next 16
    app-router не работает с auto-capture.

18. **Tables `LegalKnowledge` + `LegalReference` orphan** — без UI /
    routes. Не удалять без `--accept-data-loss`.

19. **`TRIAL_DAYS = 2` и `TRIAL_DAYS_LABEL = "два"`** должны меняться
    синхронно. Тест `plans.test.ts` валит сборку иначе. Используется в
    `/offer`.

20. **OPERATOR placeholders начинаются с `[`**. ИП сейчас зарегистрирован
    — placeholders заменены. Если откатится в плейсхолдеры, тест
    `legal-info` (launch-guard) падает. Без реальных данных нельзя:
    (а) активировать ЮKassa, (б) корректно соблюсти 152-ФЗ, (в)
    предоставлять чеки 54-ФЗ.

21. **`otplib` v13 убрал `authenticator` singleton** — используем
    functional API. `verifySync` возвращает `VerifyResult`, не plain
    bool.

22. **2FA login flow двухшаговый** — `/api/auth/check-2fa` сначала,
    потом signIn с `totpCode`. Один pass нельзя: `signIn` collapse'ит
    «wrong password» и «creds OK + need TOTP» в `null`.

23. **`AuditEvent.orgId` nullable + `onDelete: SetNull`** — журнал
    переживает удаление workspace.

24. **`AuditAction` — controlled vocab**. Новый action = добавить в TS
    union в `src/lib/audit.ts` И в `ACTION_LABELS` в
    `/settings/organization/audit/page.tsx`.

25. **КАД — заглушка** (нужен api-fns.ru ~3000₽/мес или Контур). **ФССП —
    реальный env-gated провайдер** `fssp-api.ts` под `FSSP_AUTH_KEY`
    (без ключа работает заглушка; провайдер НЕ проверен на живом ключе —
    сверить контракт ответа при подключении). UI `/counterparty`
    показывает warning-плашку. **НЕ продавать «проверку контрагента»
    как ключевую фичу пока КАД не интегрирован** — иначе trust damage.

26. **`logAudit.payload` гоняется через `redact()`** — sensitive keys
    (`password`, `secret`, `token`, `email`, `phone`) → `"[redacted]"`.

27. **AI prompt caching работает только при cumulative prefix ≥ 1024
    токенов** (Sonnet/Haiku). Сейчас system + tool schema даёт ~3-4k —
    кэшируется. TTL 5 минут (ephemeral). Если запросы реже — каждый
    раз cache miss.

28. **Vercel Hobby plan capping function timeout 60s.** Анализ длинного
    договора easily > 60s. `maxDuration = 300` в route работает только
    на Pro plan ($20/мес).

29. **Neon free tier auto-suspend через 5 минут idle.** Cold-start первое
    соединение может фейлиться. Решено retry-обёрткой в build script
    (`scripts/db-push-with-retry.mjs`). Production-grade — Neon Launch
    ($19/мес) с always-on compute.

30. **`max_tokens` на Anthropic generate — 8192 ceiling** для Sonnet /
    Opus. Если контракт длинный + большая схема + verbose prompt → ответ
    обрезается → zod fails. Сейчас analyze single-pass = 8192, chunk
    extract = 4096, synthesis = 4096.

31. **Verdict labels в UI — «уровень риска», не «рекомендация
    подписать»**. Прямое «рекомендуется подписать» создаёт юридическую
    ответственность за плохой совет. Формулировки: «Низкий / Средний /
    Высокий уровень риска» + дисклеймер «это автоматическая оценка,
    не консультация».

32. **Vercel function memory limit на Hobby = 1024 MB.** Большой PDF +
    map-reduce + параллельные chunks могут упереться. Если будет — Pro
    (3 GB) или streaming-обработка чанков.

33. **Plan-коды — не закрытое множество.** После 5-tier rollout:
    `FREE / PRO / PRO_SOLO / PRO_TEAM / BUSINESS`. Любой `SOMEMAP[plan].xxx`
    без `?? fallback` падает на новом коде — так крешился дашборд
    (`usage-widget.tsx`, `PLAN_META` без PRO_SOLO). Любой lookup по
    plan-коду — с fallback или exhaustive `Record<Plan, …>` по
    типобезопасному ключу.

34. **Service worker регистрируется ТОЛЬКО в production.** В
    `npm run dev` его нет (мешает HMR). Офлайн / установку PWA
    тестировать на задеплоенном сайте. `public/**` исключён из eslint
    (там рукописный `sw.js` с service-worker-глобалами).

35. **Вложенный flex + `truncate`**: `min-w-0` нужен на КАЖДОМ flex-
    предке между truncate-элементом и ограничителем ширины, не только
    на ближайшем. Длинное имя файла рвало вёрстку дашборда из-за
    `<Link flex-1>` без `min-w-0`.

36. **Сетевые мутации gated на ACCEPTED-связь + rate-limit `network`
    (30/мин).** Шеринг/сообщения между несвязанными юзерами → 403.
    Новые `/api/network/*`-роуты не забывать гейтить
    (`areConnected` / `networkRateLimitOk`).

37. **Роль `VIEWER` — read-only, ранг 0** (ниже MEMBER).
    `requireMembership(…, "MEMBER")` отсекает её автоматически. Но
    AI-роуты (analyze / generate / chat / generated POST) НЕ ходят
    через `requireMembership` — там добавлен явный `getMembership` +
    блок `role === "VIEWER"`. Любой новый AI-роут, тратящий квоту, тоже
    гейтить явно.

38. **Уникальность `referralCode` — в коде, не DB-constraint** (foot-gun
    #2). Проверка коллизии перед записью + `@@index`. То же — для
    любого нового nullable-поля, которое «должно быть уникальным».
    **ИНН**: `claimed` НЕэксклюзивен (анти-сквоттинг), эксклюзивен
    только `verified`. `verified` пока недостижим в UI — путь через
    платёж с р/с компании ждёт активации ЮKassa B2B.

39. **Referral-бонус — пул, потребляется в `/api/analyze`.**
    `checkQuota` для FREE+analyze считает
    `limit = base + bonusAnalyses + max(0, used - base)` (держит
    месячный кап стабильным). `consumeReferralBonus(orgId)` декрементит
    пул ПОСЛЕ успешного анализа. Не дублировать декремент в других
    местах и не списывать в `checkQuota` (она вызывается и для
    отображения).

40. **`/r/[token]` — публичная страница без авторизации**,
    `force-dynamic` + `robots: noindex`. Токен (192 бита) — и есть
    доступ. Текст договора там НЕ показывается, только вердикт + риски.
    `/r/`, `/workspace/`, `/deadlines` добавлены в `robots.txt` Disallow.

41. **Anthropic в текущих моделях НЕ принимает `temperature`.** Запрос
    с этим полем падает: `400 invalid_request_error: "temperature is
    deprecated for this model"`. В `src/lib/ai/providers/anthropic.ts`
    параметр НЕ передаётся ни в одном из 4 вызовов — не возвращать
    обратно. Это ломало `/api/analyze` в проде (Groq-фолбэк не спас —
    413 по TPM-лимиту). `GenerateOptions.temperature` всё ещё
    используется Groq/Gemini-провайдерами — там оставить.

42. **`toGeminiSchema` конвертирует, а не молча режет.** Раньше функция
    выбрасывала ЛЮБОЙ нераспознанный ключ JSON-схемы — это тихо ломало
    дискриминированные union'ы: `oneOf` исчезал → `items: {}`, Gemini-
    фолбэк возвращал мусор, не проходящий zod. Теперь `oneOf`/`anyOf` →
    Gemini-`anyOf`, `const` → одноэлементный `enum`, бессмысленные
    ключи (`$schema`, `additionalProperties`…) дропаются, а любой
    ДРУГОЙ неизвестный ключ → `throw` (ловится fallback-цепочкой).
    Следствие: добавишь в схему конструкцию вне allowlist — Gemini-путь
    упадёт громко. Через Gemini идут 3 схемы: analyze, chunk-risks,
    synthesis. `refine-patch` — через `generateText` без схемы.
    `toAnthropicSchema` ключи НЕ фильтрует.

43. **Modal scrim — `bg-black/60`, НЕ `bg-foreground/40`.** Theme-aware
    `--foreground` в светлой теме тёмный (`#16202E`), в тёмной — светлый
    (`#e8e6e1`). «Затемняющий» overlay в тёмной становится «осветляющим»
    — содержимое под модалкой подсвечивается вместо ухода в фон.
    Везде фиксированный `bg-black/60 backdrop-blur-md`. Затронуты:
    `command-palette`, `onboarding-modal`, `refine-panel`,
    `send-for-review`, `sidebar` (drawer).

44. **Auth-страницы под `<AppShell>`, публичные — под `<Header>`.**
    Это две разные хром-системы; смешивать нельзя — получится двойной
    header. AppShell имеет mobile top-bar и sidebar, Header — горизонтальный
    навбар без sidebar. Каждая auth-страница: `<AppShell><PageHeader … />`.

45. **`next/og` Satori требует `display: flex` на любом div'е с более
    чем одним ребёнком.** Inline JSX вроде `<div>текст <span>ещё
    текст</span></div>` валит prerender: «Expected `<div>` to have
    explicit `display: flex/contents/none`». Лечится двумя способами:
    (а) разнести фразу на два stacked block-div'а (предпочтительно для
    typographic-эффектов вроде italic-фразы на новой строке), либо
    (б) поставить `display: flex` + `flex-wrap: wrap` на родителя.
    Затронуто Sprint 13 при добавлении italic terracotta на закрывающую
    фразу `opengraph-image.tsx`. CSS-переменные тоже не работают —
    Satori не читает `var(--…)`, только hex; вот почему favicon / OG /
    email хардкодят палитру и обновляются отдельным коммитом.

46. **Глобальное правило `h1, h2 { font-family: var(--font-serif); }` в
    `globals.css` делает любой `<h1>` / `<h2>` serif автоматически.**
    Класс `font-serif` явно ставить избыточно. Но `font-extrabold` /
    `font-bold` остаются — они контролируют font-weight, не семейство,
    и поверх serif читаются тяжелее, чем хочется. Стандарт для
    display-заголовков — `font-semibold tracking-tight`. Variable
    Source Serif при semibold уже передаёт достаточную плотность.

---

## 🐛 Дебаг — когда что-то не работает

### 1. Vercel

```powershell
npx vercel inspect <deployment-id> --logs
```

Или: Vercel dashboard → Project → **Logs** tab → fire request → ищи
`[ai]`, `[analyze]`, `[ai/client]`.

### 2. Browser

DevTools → Network → найди фейлящий request → **Response → Preview**.
Все 500 имеют `detail` поле с реальной exception message (см.
`/api/analyze` route).

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
FROM "User" ORDER BY "createdAt" DESC LIMIT 20;

-- Выдать себе PRO
UPDATE "User"
SET plan = 'PRO', "trialEndsAt" = NULL
WHERE email = 'твой@email';
-- → выход / вход для перевыпуска JWT

-- MRR / active subs
SELECT s.plan, COUNT(*), STRING_AGG(o.name, ', ')
FROM "Subscription" s JOIN "Organization" o ON o.id = s."orgId"
WHERE s.status = 'ACTIVE' AND s."currentPeriodEnd" > NOW()
GROUP BY s.plan;

-- AI-расход за неделю по моделям (для оценки cost)
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

## 🚧 Что НЕ сделано (продуктовый TODO)

### 🔥 Бизнес-блокеры (см. roadmap ниже)

- ЮKassa: `YOOKASSA_SHOP_ID`/`_SECRET_KEY` не выставлены → checkout 503.
- Расчётный счёт ИП не открыт → `OPERATOR.bank*` пустые → банковский
  блок оферты скрыт.
- Уведомление в Роскомнадзор не подано → `OPERATOR.rknOperatorNumber`
  не заполнен.
- Resend domain не подтверждён → welcome / password-reset не уходят на
  реальных юзеров.
- Домен `yakso.ru` не подключён к Vercel → ссылки в письмах / OG /
  `/r/[token]` ведут на 404.
- 0 каналов привлечения (SEO/PPC/партнёрки/комьюнити).

### 🚀 Расширения продукта

- REST API + API keys.
- Webhooks.
- Slack/Telegram bot.
- Email-уведомления о готовности длинного анализа.

### 🤝 Интеграции

- **Реальный КАД** (api-fns.ru ~3к/мес или Контур.Фокус ~40к/мес) —
  критично (foot-gun #25).
- E-signature (СберДок / Контур.Сайн).
- Битрикс24 / amoCRM коннектор.
- Email-to-analyze.

### 💰 Биллинг полировка

- Годовая подписка с 16% скидкой.
- Per-seat компонент для TEAM tier.
- Promo codes.
- Stripe для зарубежных клиентов.

### 📊 Retention infrastructure

- Onboarding video (90 сек, Loom/Tella).
- Tooltips на 5 ключевых UI элементах (driver.js).
- Crisp/Tawk бесплатный чат на сайт.
- Customer support: Telegram-канал `@yakso_support`.

### ⚙️ DX

- E2E Playwright.
- Pre-commit hooks (husky + lint-staged).
- Component tests (требует jsdom + testing-library).
- Storybook.

### 🎁 Большие бизнес-фичи

- Templates marketplace (юристы продают шаблоны).
- «Verified by lawyer» badge — +5000₽ живой юрист подписывает заключение.
- SSO (SAML/OIDC) для enterprise.
- Client portal (внешние юристы view-only).
- Approval workflows.

### 📚 Контент

- 30+ SEO-статей про конкретные договоры.
- Полная база ГК РФ / НК РФ / ТК РФ через embeddings (вернуть Справочник).
- Glossary терминов.

---

## 📈 Бизнес-roadmap на 6 недель до запуска

> Это план не для разработки, это план **запуска бизнеса**. Распределение
> усилий: 30% код, 70% всё остальное. Самая частая ошибка разработчика-
> фаундера — путать «продукт работает» с «бизнес работает».

### Неделя 1 — Легализация (без этого ничего не работает)

| Задача | Кто | Стоимость | Где блокирует |
|---|---|---|---|
| ~~Открыть ИП~~ ✅ | — | — | — |
| Подать в ЮKassa documents → получить `shop_id` | Founder | 0 | Платежи |
| Уведомление в Роскомнадзор о обработке ПДн | Founder | 0, 1 час онлайн | 152-ФЗ |
| ~~Заполнить OPERATOR в `legal-info.ts`~~ ✅ | — | — | — |
| Verify домена в Resend | Dev | 0 | Email-onboarding |
| Подключить `yakso.ru` к Vercel (A-запись на IP Vercel) | Founder + Dev | 0 | OG / письма / `/r/` |
| Открыть расчётный счёт ИП | Founder | 0 | Банковский блок оферты |

**Деливерабл:** legal-чистый продукт, готовый принимать платежи.

### Неделя 2 — Critical product cleanup

| Задача | Сделано? |
|---|---|
| ~~Удалить fake reviews / cleanup landing~~ | ✅ |
| ~~Verdict → «оценка рисков»~~ | ✅ |
| ~~Скрыть КАД/ФССП до интеграции~~ | ✅ |
| ~~Hard cap на PRO~~ | ✅ (PRO_SOLO 100 / PRO_TEAM 500) |
| ~~FREE на Haiku вместо Sonnet (cost control)~~ | ✅ |
| ~~Dual-consent на /register~~ | ✅ |
| ~~Pricing 5-tier с годовой скидкой~~ | ✅ (без скидки пока) |
| Подключить api-fns.ru для КАД (или Контур.Фокус) | ⬜ TODO ($30-50/мес) |

**Деливерабл:** продукт честно показывает возможности, cost под контролем.

### Неделя 3 — Channel buildup (самое важное)

| Задача | Effort | Откуда юзеры |
|---|---|---|
| 5-10 SEO-статей на блоге (договор-оферта, ГПХ, NDA для ИТ, аренда для онлайн-школ, и т.д.) | 1 неделя content-маркетолога | Long-tail Google |
| Telegram-канал `@yakso` (1-2 поста/день) | 2ч/день | Direct sharing |
| Telegram-канал `@yakso_support` | 30 мин/день | Customer retention |
| vc.ru / Habr / Skillbox — статья «Как мы построили AI-юриста» | 1 день | One-time spike |
| LinkedIn / cold DM 100 ИП с «хочу подарить тебе подписку» | 2 дня | First 5-10 testimonial users |

**Деливерабл:** запущенные каналы. Первые 50 регистраций.

### Неделя 4 — Pricing + Free Tier optimization

Новая структура:

| Тариф | Цена/мес | Год | Лимиты | ICP |
|---|---|---|---|---|
| **Старт** | 0 | — | 10 анализов + 5 генераций + 0 OCR | Evaluation |
| **Pro Solo** | 1 990 ₽ | 19 990 ₽ (−16%) | 1 user, 100 анализов | Фрилансер / ИП |
| **Pro Team** | 4 990 ₽ | 49 990 ₽ (−16%) | До 5 user, 500 анализов | Малый бизнес |
| **Business** | 14 990 ₽ | 149 990 ₽ (−16%) | До 20 user, unlimited + Opus | Корпорация |
| **Enterprise** | по запросу | — | SLA, on-premise, custom | F500 |

Год пока без скидки в БД — добавить.

### Неделя 5 — Retention + Support infrastructure

- Onboarding video 90 секунд (Loom/Tella, хостить на Vercel).
- `<DriverTour>` на 5 экранов после первого signup.
- Crisp бесплатный чат до 100 контактов.
- Customer support standard: ответ в 24ч, public Telegram.

### Неделя 6 — Data + Iteration

- PostHog funnels: visit → register → upload → analyze → activate trial
  → upgrade → renew.
- A/B test 2 варианта pricing page.
- 20 user interviews (15 минут zoom) → exit interview / NPS.
- Конкурентный мониторинг: Lawrocket, Contract.io, mainContract.io.
- Iterate based on data.

**После 6 недель — продукт реально готов к запуску.**

---

## 💰 Финансовая модель

### Unit economics на Pro Solo юзере (1990₽/мес ≈ $22)

| Cost | Per юзер/мес |
|---|---|
| AI (Anthropic Sonnet, 100 анализов × $0.15) | $15 |
| Infra (Vercel Pro / 100 юзеров) | $0.2 |
| DB (Neon Launch / 200 юзеров) | $0.1 |
| Email (Resend) | $0.02 |
| DaData (premium / N юзеров) | $1 |
| **Total cost** | **~$16** |
| **Revenue** | **$22** |
| **Gross margin** | **27%** |

⚠️ **Gross margin 27% низкий для SaaS** (target 70-80%). Решение: либо
снизить лимит до 50 анализов, либо повысить FREE на Haiku (более частый
юзер cost $7 вместо $15), либо поднять цену до 2990₽.

### Pro Team (4990₽/мес ≈ $55)

| Cost | Per юзер/мес |
|---|---|
| AI (500 анализов × $0.15 — shared между 5 user) | $75 |

⚠️ Pro Team при безлимите **убыточен**. Решение: лимит 500 жёсткий +
add-on usage pricing.

### Realistic targets

- **Год 1**: 200 платящих, MRR 600k₽, ARR $80k → положительный
  cash-flow founder-проекта.
- **Год 2**: 1000 платящих, MRR 3M₽, ARR $400k → можно нанимать.
- **Год 3**: $1M+ ARR — целевая отметка, без раунда возможно только
  через partnership.

---

## 🥊 Конкурентная позиция

| Игрок | Сильная сторона | Слабая | Цена |
|---|---|---|---|
| **Контур.Сайн / Контур.Норматив** | Brand, ЭЦП, ЕГРЮЛ | Дорого, бюрократический UX, не AI | 4990-39990₽/мес |
| **Lawrocket** | AI, российский, поддержка | Стартап ~2024 | 1990-9990₽/мес |
| **Garant.ru / КонсультантПлюс** | База норм, авторитет | Не AI, дорого | 50000+₽/мес |
| **ChatGPT / Claude / Gemini** | Бесплатно, мощно | Не специализированы под РФ | 0-$20/мес |

**Текущий moat: 0.** Возможные углы:
1. **Узкая ниша.** «Договоры для маркетплейсов» (WB / OZON / Я.Маркет) —
   концентрированная аудитория, ясный pain.
2. **Fine-tune на корпусе ВС РФ + арбитраж практики.** ~$5-10к,
   повышает точность.
3. **Network effect через workspaces.** Команда юриста + менеджера +
   бухгалтера в одной системе.

---

## 📞 Контакты infrastructure

- **GitHub**: https://github.com/zzzz212/don
- **Production**: https://yakso.ru
- **Vercel**: zzzz212-projects/don
- **Neon**: console.neon.tech → don / yakso
- **Sentry**: yakso
- **Anthropic Console**: console.anthropic.com (баланс, ключи, usage)
- **Yandex Cloud**: console.cloud.yandex.ru (OCR service account)
- **Voyage AI**: voyageai.com
- **PostHog**: us.posthog.com или eu.posthog.com (см. POSTHOG_HOST)
- **ЮKassa**: yookassa.ru/my (после регистрации ИП)
- **Resend**: resend.com (после подтверждения домена)

---

## 📋 Полный список коммитов (новейшие сверху)

### Sprint 13 — «тёплый минимализм» (последний заход)

PR #7, ветка `claude/sprint-8-ui-polish`, в `main` НЕ смержено.

```
7b57d64 Redesign 2E: brand chrome and email under the new palette
6c86b92 Redesign 2D: serif headings through the platform shell
f2b4144 Redesign 2C: align public-page typography and recolour templates
2482cf2 Redesign 2B: rebuild landing on the new palette and tone
87d6dfd Redesign 2A: switch palette tokens to warm minimalism
```

Sprint 12 был эффективно re-skin (палитра + шрифт + кнопки + плейтформенная
оболочка) — структура и тон лендинга остались «как у любого B2B SaaS». В
Sprint 13 двойной swing: новая палитра + переписанный с нуля лендинг.

Пять фаз, по одной на коммит:

**2A — токены.** `:root` и `.dark` в `globals.css` полностью перепрошиты:
cream `#f5eddf` фон, terracotta `#c2613f` primary, warm ink `#1f1b16`,
sage `#6e7f62` accent, danger burgundy `#9b2d26` (явно отдельный по
тону от terracotta). Тени с warm-сепия rgba'шкой. Тёмная — coffee
charcoal с lifted terracotta. viewport theme-color подбит.

**2B — лендинг.** `src/app/page.tsx` переписан с нуля. Hero split
(copy 7/12 + live SampleReportCard 5/12 mirror'ит /sample-report).
Новый headline: «Юрист, который читает _договор за вас_» с italic
terracotta на закрывающей фразе. Снесли fake-stats / feature-dump /
4-grid «Как мы это делаем». Новые секции: «Что мы ловим» 2×2 без
иконок, «Никакой магии» 3 шага с крупными serif-номерами, pricing с
Pro Solo в `border-2 border-primary` + пилл «Рекомендуем» (не
«Популярный»), FAQ 4 вопроса со ссылкой на /help, final CTA с
cream-кнопкой на warm-ink band.

**2C — публичные страницы.** Типографика приведена к новой системе на
LegalPageShell, blog (list + slug), help, login (h1: «С возвращением»),
register, forgot-password, password-reset — `font-extrabold` →
`font-serif font-semibold tracking-tight`, eyebrows uppercase
`tracking-[0.18em] text-primary`. `/sample-report` bottom CTA
переделан с `from-primary to-blue-700` в warm-ink slab. `/templates`
category colors: purple/indigo → stone/teal (Конф./Финансы), rose-800
text для Кадров для контраста на pale bg.

**2D — auth chrome.** PageHeader title теперь serif → 27 экранов
подхватывают за один коммит. InlineEdit + OnboardingModal: `font-extrabold`
→ `font-serif font-semibold`. Три места с jewel-tone Tailwind зачищены:
/chat assistant avatar (`from-primary to-blue-700` → solid terracotta),
/report violet OCR-pill → surface/foreground, DocumentSearchBar
violet AI-tag → primary. /billing pricing — serif цены, «Популярный»
→ «Рекомендуем», `text-white` → `text-primary-fg`.

**2E — brand chrome + email.** favicon / apple-icon / pwa/icon /
manifest / opengraph-image (landing + blog/[slug]) перерисованы: warm
ink tile `#1f1b16` с cream `#fcf7ef` «Я». OG-картинка landing'а
рендерит новый headline с italic terracotta — пришлось разнести на
два stacked div'а из-за Satori-ограничения (foot-gun #45). Email
`renderEmailHtml` константы (`COLOR_FG`, `COLOR_PRIMARY`, etc.)
переведены на warm-minimalism палитру. `tsc` / 389 тестов / `next build`
зелёные.

### Sprint 12 — редизайн + платформенная оболочка

```
d29d444 Close AccountMenu and OrgSwitcher on Escape too
83c9a89 Manage focus inside the mobile sidebar drawer
6afd04e Build a generic MenuButton and use it to thin out /report and /generated/[id] toolbars
41d5f13 Update CLAUDE.md for Sprint 12 — redesign + platform shell
1e133d6 Move billing, templates, version + share/profile detail onto PageHeader
e31500a Move admin pages onto PageHeader
d5e9c1c Move account, settings, referral, workspace chat, messages onto PageHeader
b92422e Recompose /chat, /network, /deadlines, /compare-contracts onto PageHeader
a73f0d4 Recompose /analyze, /templates, /counterparty, /bulk onto PageHeader
2e6b736 Recompose /report onto PageHeader
2e2b194 Roll AppShell out to every authenticated screen
c8907c2 Fix dark-mode modal scrim + propagate AppShell to top pages
a740061 Total redesign: platform shell + recomposed dashboard
0a62f2b Update CLAUDE.md for the completed redesign
04b5d36 Redesign 1F/1G: emails and app states
2711c00 Redesign 1E (part 3): templates and counterparty screens
178a4d0 Redesign 1E (part 2): dashboard and report screens
fb90f7a Redesign 1E (part 1): analyze and bulk screens
94b2986 Redesign 1D: landing page
fc00c25 Redesign 1C: Button and Badge primitives
a28c4ab Redesign 1B: brand identity
ebde47c Redesign 1A: new "деловой модерн" design system
4a45120 Fix counterparty risk score ignoring company status
eca4691 Remove dead code: orphaned route, prompts, components, deps
81844d2 Let users paste contract text on /analyze instead of a file
e0bd1f2 Add bulk contract analysis (/bulk)
6bd4bfd Tighten accessibility on the upload zone and two modals
18869e0 Add unit tests for three more untested pure-logic modules
c706097 Drop leftover debug logging; tie inline-edit error to its input
489cded Add unit tests for five untested pure-logic modules
ad4bd14 Convert schemas for Gemini instead of silently gutting them
```

Три волны:

**1. Код-долги + новые фичи** — массовая проверка `/bulk` (клиентская
оркестрация очереди файлов через существующий `/api/analyze`, кап 20),
вставка текста на `/analyze` (переключатель «Загрузить файл / Вставить
текст», обёрнут в `.txt`-`File` на клиенте, гард `MIN_PASTE_LENGTH=200`),
зачистка мёртвого кода (knip + ручная вычитка: удалён `/api/generate`,
4 deps, шимы), +13 тестов до 389, a11y-фиксы, counterparty risk-score
учитывает статус компании, Gemini-фолбэк не режет `oneOf` (foot-gun #42).

**2. Семь фаз 1A–1G** — палитра/font/айдентика/примитивы/лендинг/экраны/
email. Это был re-skin (палитра + шрифт + кнопки), не re-architecture.
Пользователь после 1G сказал: «дашборд тот же, изменился только шрифт.
Мне нужен полный полный редизайн».

**3. Платформенная оболочка** — новые компоненты `<AppShell>` /
`<Sidebar>` / `<PageHeader>`, `<Header>` остался только на публичных
страницах, 27+ auth-страниц мигрированы (perl-bulk + manual outliers),
modal scrim hotfix (foot-gun #43), 21 страница на PageHeader-band,
`<MenuButton>` overflow-dropdown для `/report` и `/generated/[id]`,
WCAG focus-trap на mobile drawer, Escape close на всех dropdown'ах.

Результат: каждая auth-страница имеет одинаковую структурную подпись.
`tsc` / 389 тестов / `lint` / `next build` — зелёные.

### Sprint 11 — социальный слой + анти-абуз + ребрендинг

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

10 фич: ИНН-привязка (`claimed` неэксклюзивно — анти-сквоттинг;
`verified` через будущий платёж с р/с компании), слоистый анти-абуз
(`normalizedEmail`/`signupIp`/`signupFingerprint` + risk-score при
активации триала + `/admin/abuse`), чат компании
(`WorkspaceMessage`, один канал на воркспейс), роль VIEWER (read-only),
пересылка договоров в чаты (`attachmentGeneratedDocId`), AI-напоминания
о сроках (`ContractDeadline`, AI-извлечение дат), сравнение двух
договоров (`/compare-contracts`), публичные ссылки `/r/[token]`,
рефералка (`referralCode`, `bonusAnalyses`).

Плюс: ребрендинг ЮрИИст → Яксо (`yakso.ru`, логотип-«Я»), регистрация
ИП (реквизиты заполнены), CI (GitHub Actions), security-ревью,
hotfix Anthropic `temperature` (foot-gun #41).

### Sprint 10 — сеть + PWA + доработки

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
[смержено в одной волне] Lifecycle email expansion: inactive-14d + checkout-abandoned + help + 3 more SEO articles + welcome refresh + dashboard sample CTA + backfill rename
63a9d5d Trial-conversion email cron + 3 more SEO articles + per-post OG images
b6b8706 SEO foundation: blog scaffold + sitemap + robots + 3 cornerstone articles
2551d8c Sample report page: preview of value without auth
690dbd6 Refresh landing copy
28ac21d Ground analyze/chat prompts in legal reference
523a97d 5-tier pricing rollout
f579027 152-ФЗ dual-consent
fc6a9a5 FREE → Haiku
```

### Sprint 8 — UI polish + AI calibration + trial rework

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

### Sprint 1-4 — foundation (до Sprint 8)

```
7a0ad86 CLAUDE.md handoff polish
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
... (ещё ~50 коммитов в wave 1: AI core, OCR, storage, workspaces,
    тесты, Sentry, embeddings, рейт-лимит)
```

---

## 🧠 Оперативный кэш (что свежо в голове)

### Sprint-итоги по убыванию

- **Sprint 13** (закрыт, этот заход, 2026-05-21) — «тёплый минимализм».
  Палитра ушла от глубокого синего на cool off-white к terracotta на
  cream warm-ink. Лендинг переписан с нуля: split-hero с live
  sample-card, новый headline с italic terracotta, снесли fake-stats и
  feature-dump'ы. Прокидка через 27 auth-экранов автоматически (токены
  + serif h1 в PageHeader). Brand chrome (favicon/PWA/OG, обе) и email
  шаблоны перерисованы под палитру. Пять коммитов 2A-2E. `tsc` /
  389 тестов / `next build` зелёные. PR #7 НЕ смержен.
- **Sprint 12** — Sprint 12 был эффективно re-skin (палитра + Geist +
  Source Serif + кнопки) + платформенная оболочка
  (AppShell+Sidebar+PageHeader+MenuButton). После 1G пользователь
  сказал «дашборд тот же, изменился только шрифт» — отсюда Sprint 13.
- **Sprint 11** — социальный слой (10 фич: ИНН, анти-абуз, чат
  компании, VIEWER, пересылка в чаты, напоминания, сравнение договоров,
  публичные ссылки, рефералка) + ребрендинг в Яксо + регистрация ИП +
  CI + hotfix Anthropic.
- **Sprint 10** — cross-user network + установка как PWA + реальный
  ФССП + `consequence`/`balance` в анализе.
- **Sprint 9** — sample-report + blog + /help FAQ + sitemap/robots/
  JSON-LD + 5-tier pricing + dual-consent + FREE→Haiku + lifecycle
  cron (4 стадии).
- **Sprint 8** — UI foundation (dark mode + i18n + ⌘K + AccountMenu +
  custom 404/500 + motion) + AI calibration (verdict + tier policy +
  cache_control) + plan/trial → User.

### Что осталось user-side до запуска

- **Запуск** — ИП ✅ зарегистрирован. Осталось:
  - ЮKassa: получить `YOOKASSA_SHOP_ID` / `_SECRET_KEY`, включить
    B2B-платежи `b2b_sberbank` для будущей проверки ИНН.
  - Уведомление в Роскомнадзор → положить полученный номер в
    `OPERATOR.rknOperatorNumber`.
  - Подключить `yakso.ru` к Vercel (A-запись `@` на IP Vercel). Пока
    домен не подключён, ссылки в письмах / OG / `/r/[token]` ведут на
    404.
  - Verify домена в Resend → переключить welcome / password-reset на
    реальную доставку.
  - Открыть расчётный счёт ИП → заполнить `OPERATOR.bank*` (раскроется
    банковский блок оферты).
  - Каналы привлечения (см. roadmap, Неделя 3).
- **PR #7** (база — `claude/complete-previous-tasks-rzcSp`, это и есть
  «main») открыт, в `main` НЕ смержен. После merge — auto-deploy на
  Vercel.

### Операционные напоминания

- **AI prompts** — sweet spot: ~1.5k токенов system + 4k tool schema =
  ~5.5k кэшируемого префикса. Anthropic кэширует, TTL 5 минут. Tone
  сбалансированный — «защищаю клиента, но не выдумываю риски».
- **TRIAL_DAYS = 2.** Активация только через `/billing` (auto-trial при
  signup убран). One trial per user lifetime.
- **Verdict UI говорит «уровень риска», не «рекомендация подписать»**
  (юр.ответственность).
- **КАД — заглушка; ФССП — реальный провайдер под `FSSP_AUTH_KEY`**.
  Не продавать «проверку контрагента» как ключевую фичу пока КАД не
  интегрирован.
- **Vercel maxDuration = 300** на AI routes. Только Pro plan ($20/мес).
  Hobby clamps to 60s.
- **Neon cold-start** ловится retry-обёрткой в build script.
- **Себе PRO выдать**: SQL в Neon →
  `UPDATE "User" SET plan = 'PRO', "trialEndsAt" = NULL WHERE email = 'твой@email';`
  → выход/вход для перевыпуска JWT.
- **Backfill после plan-on-user миграции** (если ещё не сделан):
  `curl -X POST -H "x-admin-key:..." https://yakso.ru/api/admin/backfill-user-plan`.
- **AI стоит $0.15–0.30 за анализ** на Sonnet, $0.02 на Haiku.
  Cache hit снижает input cost в ~3 раза.
- **План user-scoped.** OWNER membership определяет какой `User.plan`
  применяется к workspace. НЕ пиши в `Organization.plan` напрямую —
  он только legacy mirror.
- **Anthropic без `GEMINI_API_KEY` опасен** — при падении Anthropic Groq
  не вытягивает analyze по TPM-лимиту (12k free vs ~24k нужно). Ставь
  Gemini key хотя бы как страховку.
- **CI** — GitHub Actions гоняет `lint` / `tsc --noEmit` / `vitest` /
  `next build` на каждый PR и пуш в `main`.
- **Тесты — 389.** Перед commit: `npx tsc --noEmit && npm test`. Перед
  push: `npx next build` (нужны `DATABASE_URL` и `AUTH_SECRET` — см.
  опенинг-промт).

---

**Когда читаешь это в новой сессии**: сначала отвечай 7-9 буллетами,
потом спрашивай что делаем. Не пиши код без явного запроса.

@AGENTS.md

# ЮрИИст — состояние проекта (last updated 2026-05-10)

Russian legal-tech SaaS: AI-анализ договоров + генерация документов + чат с цитатами + проверка контрагентов + workspaces для команд.

**Stack**: Next.js 16 / React 19 / TypeScript / Prisma + Neon Postgres / NextAuth v5 / Tailwind 4. Read `node_modules/next/dist/docs/` before changing Next.js patterns — это Next 16, не та Next.js которую помнит твоё обучение.

---

## Что построено (по слоям)

### AI core — `src/lib/ai/`
- **`client.ts`**: главная точка `generate()` / `generateText()` / `chat()` / `streamChat()`. Tier-based выбор модели (`fast` / `smart` / `deep`), fallback chain anthropic → gemini → groq → demo.
- **Структурированный вывод через zod**: schemas в `src/lib/ai/schemas/`, никакого regex-парсинга.
- **Anthropic provider** поддерживает prompt caching (`cache_control`).
- **Streaming**: SSE через `src/lib/ai/sse.ts` (server) и `src/lib/sse-client.ts` (browser). `/chat` стримит ответы как ChatGPT.
- **Multi-pass анализ** длинных договоров через `chunkContract()` + map-reduce (`src/lib/ai/analyze.ts`).
- **RAG для чата**: `src/lib/ai/rag.ts` подмешивает топ-5 релевантных статей в system prompt → AI цитирует [1]/[2]/[N].

### Embeddings — `src/lib/embeddings/`
- **Provider abstraction** как и storage/ocr. Только Voyage AI пока (voyage-3-large, 1024 dim).
- **⚠️ Не использовать `voyageai` npm SDK** — он сломан (ESM imports без расширений). Прямой fetch в `voyage.ts`.

### OCR — `src/lib/ocr/`
- Yandex Vision adapter, multi-page split через pdf-lib.
- В `/api/analyze` автоматически подхватывается для скан-PDF.
- OCR доступен только PRO/BUSINESS (см. `plans.ts`).

### Storage — `src/lib/storage/`
- Vercel Blob adapter + noop fallback. Provider-agnostic для будущего Yandex Object Storage (152-ФЗ).

### Counterparty — `src/lib/counterparty/`
- Provider abstraction. DaData + ЕГРЮЛ работают; КАД и ФССП — **stub'ы с моками**. Замена — один файл, см. headers в `providers/{kad,fssp}.ts`.

### Workspaces — `src/lib/org.ts`
- `Organization` / `Membership` / `Invite` модели.
- **Lazy migration**: `ensureActiveOrg(userId)` создаёт Personal workspace + переносит все per-user данные при первом login. Идемпотентен.
- Каждый shared resource (Document, Generated, Chat, CounterpartyCheck, AiUsage) имеет `orgId` (nullable). `LegalReference` остаётся per-user.
- **CounterpartyCheck unique** на `(userId, inn)`, не `(orgId, inn)` — `prisma db push` отказался добавлять второй constraint без `--accept-data-loss`. Семантика: каждый member workspace имеет свою историю проверок (это хорошо для audit).

### Quotas + usage — `src/lib/quota.ts`, `src/lib/ai/usage.ts`
- Plan на Organization (не User). FREE: 3 analyse / 2 generate / unlimited chat / 0 OCR. PRO/BUSINESS: всё unlimited.
- AiUsage пишется при каждом AI/OCR вызове с `(userId, orgId, feature, ...)`.
- `checkQuotaSafe(orgId, feature)` — fail-open на DB ошибке.

### Rate limit — `src/lib/rate-limit.ts`
- Upstash Redis с in-memory fallback для local dev.
- Везде `await rateLimit(ip, "endpoint")` → 429 со структурированными headers.

### Telemetry — `src/lib/telemetry.ts`
- Sentry через instrumentation.ts (Next 15+ pattern). 4xx отфильтрованы в `beforeSend`.
- `reportError(error, { op, tags, extra, userId })` в catch'ах роутов.

### Tests — `vitest`
- 75 unit тестов в `src/**/__tests__/`. Pure logic only: chunking, dedup, json-parse, score, plans, factories, splitter.
- `npm test` / `npm run test:watch`.
- React component tests + E2E ещё нет.

---

## Все 38 коммитов работы (новейшие сверху)

```
bdc0e4c Hard-reload after workspace switch/create/leave/delete/invite-accept
18e62dd Keep CounterpartyCheck unique on (userId, inn) — db push refused (orgId, inn)
082834f Add OrgSwitcher to header + workspace settings + invite-accept page
bfe8965 Add organization management + invites API surface
83af267 Introduce Organization/Membership/Invite model + workspace-scope every shared resource
52743b9 Replace voyageai SDK with direct fetch — SDK has broken ESM packaging
0525342 Surface per-row error messages from embed-documents response
6c69749 Fix prisma.$queryRaw misuse in embed-documents WHERE composition
22cfb22 Surface contract semantic search on the dashboard
76c9085 Wire chunk embedding into analyze pipeline + add search and backfill APIs
fb8621b Add per-user contract search via DocumentChunk + pgvector
de464d5 Use prisma db push instead of migrate deploy on Vercel build
1b729b2 Wire RAG into chat, vector mode into /legal search and UI
7d2f465 Add pgvector column to LegalKnowledge + admin batch-embed endpoint
6919a06 Add embedding provider abstraction backed by Voyage AI
6e8baa5 Consume the SSE chat stream in the chat page UI
4eabb69 Stream chat responses via Server-Sent Events from /api/chat
e56a408 Run prisma migrate deploy on every Vercel build
fff9231 Stop tracking .env, fix Sentry deprecation, lock down env hygiene
ef0f783 Replace ad-hoc console.error with reportError in route catches
5d83c17 Add Sentry SDK with conditional initialisation
13cc57d Add vitest with 75 unit tests across critical pure logic
08f7e7d Extract pure helpers (dedupRisks, JSON parse) for testability
2a4f8d5 Refactor counterparty into provider abstraction
01aff11 Route multi-page scans through page-split OCR in /api/analyze
100f53c Add per-page OCR splitter + multipage orchestrator
f1efb45 Add re-analyze endpoint reusing the document's stored text
32a13de Surface storage, OCR, and quota state in the UI
cc464a3 Recognise scanned PDFs via OCR fallback in analyze route
ab4c77a Add Yandex Vision OCR provider abstraction with quota plumbing
89d83a7 Persist uploaded contracts and expose authenticated download
0e2230b Add object-storage abstraction backed by Vercel Blob
51fcf3a Replace 15k truncation with map-reduce analysis for long contracts
4b4f911 Enforce rate limit and plan quota on AI routes
afcb74e Add distributed rate limit and plan-based quota infrastructure
620bc23 Migrate analyze, chat, and generate to schema-driven AI client
2fc10ac Track AI usage per user, feature, and provider
0d6408a Add structured AI provider layer with zod schemas
```

---

## Внешние сервисы и env vars

См. `.env.example` для полного списка. Критичное:

| ENV | Что | Без него |
|---|---|---|
| `DATABASE_URL` | Neon Postgres | Не запустится |
| `AUTH_SECRET` | NextAuth JWT | Не запустится |
| `ANTHROPIC_API_KEY` или `GEMINI_API_KEY` или `GROQ_API_KEY` | Хотя бы один AI | Demo режим |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | Оригиналы не сохраняются |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Distributed rate limit | In-memory fallback (на serverless ≈ no rate limit) |
| `YANDEX_OCR_API_KEY` + `YANDEX_OCR_FOLDER_ID` | OCR сканов | OCR не работает |
| `VOYAGE_API_KEY` | Embeddings (RAG + поиск договоров) | Чат без цитат, поиск по словам only |
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_AUTH_TOKEN` для source maps) | Error tracking | console.error only |
| `DADATA_API_KEY` + `DADATA_SECRET_KEY` | Контрагенты ЕГРЮЛ | Только моки |
| `ADMIN_SEED_KEY` | Защита `/api/admin/*` | Default `dev-seed-key` (опасно в prod) |

⚠️ **Все секреты были в чате с предыдущим Claude — должны быть проротейчены**.

⚠️ **pgvector в Neon** — `CREATE EXTENSION IF NOT EXISTS vector;` руками в Neon SQL Editor один раз. Без этого `prisma db push` упадёт на embedding колонках.

---

## Build pipeline

`package.json` `build` script:
```
prisma generate && prisma db push --skip-generate && next build
```

`prisma db push` (а не `migrate deploy`) — потому что миграции в репо в SQLite-стиле от прошлой жизни проекта, не PG-совместимые. `db push` синхронизирует схему напрямую от `schema.prisma`, миграции игнорирует.

После любого деплоя добавляющего embedding колонки — нужно один раз бэкфилить:
```bash
curl -X POST -H "x-admin-key: dev-seed-key" https://juriist.vercel.app/api/admin/embed-legal
curl -X POST -H "x-admin-key: dev-seed-key" https://juriist.vercel.app/api/admin/embed-documents
```

---

## Известные баги и edge cases

1. **`voyageai` SDK сломан** в 0.2.1 — ESM imports без расширений. Используем прямой fetch в `src/lib/embeddings/voyage.ts`. Не возвращайся на SDK, пока не выйдет fixed версия.
2. **`prisma db push` боится false-positive** на новых unique constraints (см. CounterpartyCheck в schema). Если будешь добавлять новые unique — проверь не добавляет ли это nullable column в условие.
3. **Migrations folder в SQLite-синтаксисе** для legacy миграций. Новые писать в PG-стиле (TIMESTAMP, не DATETIME). Но Vercel build всё равно использует `db push`, не migrate.
4. **Workspace switch требует hard reload** — `router.refresh() + update()` не обновляют client state в OrgSwitcher. См. `bdc0e4c` коммит.
5. **`prisma.$queryRaw` нельзя использовать для композиции SQL** — это execute, не fragment. Для условных WHERE используй `Prisma.sql` + `Prisma.empty` (см. `src/app/api/admin/embed-documents/route.ts`).

---

## Что НЕ сделано (TODO список)

### 💰 Монетизация (1 в приоритете для revenue)
- **ЮKassa интеграция + Subscription модель** — без неё квоты декоративные. Нужны: ИП/ООО + ЮKassa shop_id + secret_key + webhook URL. Эстимейт ~4-5ч.
- **Free 14-day PRO trial** для новых регистраций (~2ч)
- **Promo codes** (~2-3ч)
- **Stripe** для зарубежных клиентов

### 📧 Коммуникация
- **Resend email**: registration confirmation, password reset, инвайт по email (вместо ручного копирования shareable link). Free tier. ~2-3ч
- **Email-уведомления** о готовности анализа

### 📊 Аналитика
- **PostHog** event tracking. Free tier EU. ~1.5-2ч
- **Admin dashboard** для тебя — все юзеры/orgs/usage. ~3-4ч

### 🔐 Security / Trust
- **2FA TOTP** через `otplib`. ~3-4ч
- **Audit log** для b2b. ~2-3ч
- **Privacy policy + ToS pages** (152-ФЗ). Юр-проверка нужна
- **Status page**

### 🚀 Расширения продукта
- **REST API + API keys** для интеграций. ~4-5ч
- **Webhooks** (после API keys). ~3-4ч
- **Bulk upload** — drop 50 файлов. ~3-4ч
- **Compare 2 contracts** — diff side-by-side. ~3-4ч
- **Streaming для `/api/generate`** — документы тоже стримятся. ~2-3ч
- **Onboarding tour** — first-time подсказки. ~2-3ч
- **Counterparty monitoring** — alerts при изменении статуса

### 🤝 Интеграции
- **Slack/Telegram bot** — анализы в канал команды
- **Битрикс24/amoCRM**
- **Email-to-analyze** — переслал договор → автоанализ
- **Реальный КАД** через api-fns.ru (~₽3000/мес) или Контур.Фокус (~₽40k/мес)
- **Реальный ФССП** — public API, free, 100 req/день
- **E-signature** (СберДок / Контур.Сайн)

### ⚙️ DX
- **GitHub Actions CI** — тесты + lint на PR. ~1-2ч
- **E2E Playwright** — критичные flow. ~4-5ч
- **Pre-commit hooks** (husky + lint-staged). ~30мин
- **Storybook**. ~3-4ч
- **API docs** (Mintlify / Scalar)
- **React component tests**

### 🎨 UI polish
- **Dark mode toggle**. ~2ч
- **Loading skeletons** вместо спиннеров. ~2ч
- **Empty states** с CTA везде
- **Mobile-first overhaul**
- **A11y audit**
- **i18n** русский+английский

### 🎁 Большие бизнес-фичи
- **Templates marketplace** — юристы продают свои шаблоны через тебя
- **Verified by lawyer** badge — реальный юрист подтверждает
- **SSO (SAML/OIDC)** для enterprise
- **Client portal** — внешние юристы получают view-only
- **Approval workflows** перед подписанием

---

## Приоритет для следующего спринта (моё мнение)

1. **ЮKassa** — без неё всё построенное теоретически
2. **Resend email** — invites через копирование URL — это 2010-й год
3. **Onboarding tour** — конверсия первого визита

После этого: PostHog (понимать что юзают) → 2FA + audit log (b2b ready) → REST API (интеграции).

---

## Как продолжить работу с новым Claude

В новой сессии скажи: "прочитай CLAUDE.md и скажи что делаем дальше". Этого хватит чтобы получить контекст за 10 секунд.

Если конкретный pending — скажи "беру #N из CLAUDE.md TODO" + любые твои уточнения.

---

## Контакты infrastructure

- **GitHub**: https://github.com/zzzz212/don
- **Production**: https://juriist.vercel.app
- **Production branch**: `main`
- **Active feature branch** (где вся эта работа): `claude/intelligent-cerf-a72ede` — уже смержена в main на момент написания этого файла
- **Vercel project**: zzzz212-projects/don (или juriist в Settings)
- **Neon project**: проверить console.neon.tech

@AGENTS.md

# 🚀 ОТКРЫВАЮЩИЙ ПРОМТ ДЛЯ НОВОЙ СЕССИИ

> **Скопируй это и вставь как первое сообщение Claude в новой сессии:**

```
Привет! Я работаю над ЮрИИст — Russian legal-tech SaaS на Next.js 16 +
Prisma + Neon. Над проектом велась длинная сессия с предыдущим Claude
(50+ коммитов: AI core с RAG, OCR, storage, workspaces, тесты, Sentry,
embeddings и т.д.). Все детали в CLAUDE.md в корне репозитория.

Сделай сейчас:
1. Прочитай CLAUDE.md полностью.
2. Кратко (5 буллетов) подтверди что понял:
   – Что построено (top-level)
   – Что в pending TODO с приоритетами
   – Какие foot-guns надо помнить (схема, JWT, voyageai SDK, и т.д.)
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

Russian legal-tech SaaS: AI-анализ договоров + генерация документов + чат с RAG-цитатами + проверка контрагентов + workspaces для команд.

**Stack**: Next.js 16 / React 19 / TypeScript / Prisma + Neon Postgres / NextAuth v5 beta.30 / Tailwind 4. **Read `node_modules/next/dist/docs/`** перед изменением Next.js паттернов — это Next 16, не та Next.js которую помнит твоё обучение.

---

## Что построено (по слоям)

### AI core — `src/lib/ai/`
- **`client.ts`**: главная точка `generate()` / `generateText()` / `chat()` / `streamChat()`. Tier-based выбор модели (`fast` / `smart` / `deep`), fallback chain anthropic → gemini → groq → demo.
- **Структурированный вывод через zod**: schemas в `src/lib/ai/schemas/`, никакого regex-парсинга.
- **Anthropic provider** поддерживает prompt caching (`cache_control`).
- **Streaming**: SSE через `src/lib/ai/sse.ts` (server) и `src/lib/sse-client.ts` (browser). `/chat` стримит ответы как ChatGPT, со Stop-кнопкой и AbortController.
- **Multi-pass анализ** длинных договоров через `chunkContract()` + map-reduce (`src/lib/ai/analyze.ts`). Параллельные batch'и по 4 chunk'а, dedup рисков, синтез структуры.
- **RAG для чата**: `src/lib/ai/rag.ts` подмешивает топ-5 релевантных статей в system prompt → AI цитирует [1]/[2]/[N].

### Embeddings — `src/lib/embeddings/`
- Provider abstraction. Только Voyage AI (voyage-3-large, 1024 dim).
- **⚠️ НЕ использовать `voyageai` npm SDK** — он сломан в 0.2.1 (ESM imports без расширений). Прямой fetch в `voyage.ts`.

### OCR — `src/lib/ocr/`
- Yandex Vision adapter, multi-page split через pdf-lib (`MAX_PAGES_PER_DOCUMENT = 30`).
- В `/api/analyze` автоматически подхватывается для скан-PDF (если pdf-parse вернул < 30 chars/page).
- OCR доступен только PRO/BUSINESS (см. `plans.ts`).

### Storage — `src/lib/storage/`
- Vercel Blob adapter + noop fallback. Provider-agnostic для будущего Yandex Object Storage (152-ФЗ).
- При upload sanitize'ит filename, использует random suffix против enumeration.

### Counterparty — `src/lib/counterparty/`
- Provider abstraction. DaData + ЕГРЮЛ работают; КАД и ФССП — **stub'ы с моками**. Замена — один файл, см. headers в `providers/{kad,fssp}.ts`.

### Workspaces (КРИТИЧНО! Сложная история) — `src/lib/org.ts`
- `Organization` / `Membership` / `Invite` модели.
- **Lazy migration**: `ensureActiveOrg(userId)` — три уровня восстановления:
  1. Happy path: проверяет что `User.activeOrgId` существует ЧЕРЕЗ `Membership` (не просто `IS NOT NULL`)
  2. Recovery: если stale, ищет любой существующий Membership и переключает на него
  3. Bootstrap: если ничего нет, создаёт Personal workspace + переносит все per-user данные
- **JWT callback теперь ВСЕГДА re-resolves** activeOrgId (не только на trigger==='update', т.к. NextAuth v5 beta не всегда передаёт правильный trigger). Cost: 1 SELECT на session lifecycle event, не на каждый request.
- **Workspace switch механика**:
  1. Client: POST `/api/organizations/[id]/switch` → DB updates `User.activeOrgId`
  2. Client: `await update()` → NextAuth re-runs JWT callback → re-signs cookie с новым activeOrgId
  3. Client: `window.location.reload()` → новая страница с свежим cookie
- Каждый shared resource (Document, Generated, Chat, CounterpartyCheck, AiUsage) имеет `orgId` (nullable). `LegalReference` остаётся per-user.
- **CounterpartyCheck unique** на `(userId, inn)`, НЕ `(orgId, inn)` — `prisma db push` отказался добавлять второй constraint без `--accept-data-loss`. Семантика: каждый member workspace имеет свою историю проверок (это хорошо для audit).
- **OrgSwitcher fallback**: если `data.activeOrgId` не найден в `data.organizations` → fallback на `data.organizations[0]` чтобы UI не исчезал.

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
- React component tests + E2E ещё нет (TODO).

---

## Все 50 коммитов работы (новейшие сверху)

```
9721d93 Always re-resolve activeOrgId in JWT callback, drop trigger=='update' guard
f1857b7 Refresh JWT before reload on workspace switch / leave / delete / accept
e04f250 Show OrgSwitcher on every viewport + fallback when active id missing
3f3c3cb Heal stale User.activeOrgId in ensureActiveOrg
d678499 Surface DB save errors from /api/analyze in the response body
4974ab0 Add CLAUDE.md continuity doc — full project state for the next session
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

См. `.env.example` для полного списка с инструкциями. Критичное:

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

⚠️ **Все секреты надо проротейтить** если они когда-либо засветились в чате.

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

## ⚠️ Известные баги, gotchas и foot-guns

(Эти все были встречены и зафиксированы — НЕ повторяй.)

1. **`voyageai` SDK 0.2.1 сломан** — ESM imports без расширений. Используем прямой fetch в `src/lib/embeddings/voyage.ts`. НЕ возвращайся на SDK пока не выйдет fixed версия.

2. **`prisma db push` боится false-positive** на новых unique constraints. Если будешь добавлять `@@unique` — проверь не nullable ли все колонки. Если nullable — db push откажется добавлять. Workaround: делай unique только на полностью populated данных, или оставь старый constraint.

3. **Migrations folder в SQLite-синтаксисе** для legacy миграций. Новые писать в PG-стиле (TIMESTAMP, не DATETIME, vector(N), и т.д.). Но Vercel build всё равно использует `db push`, не `migrate deploy`.

4. **`User.activeOrgId` — это `String?`, не FK** (намеренно — JWT держит это значение, FK forced бы cascade-delete юзера при удалении его последнего org). Поэтому ссылка может стать stale если Organization удалена. **`ensureActiveOrg`** должен валидировать через `Membership`, не просто `IS NOT NULL`.

5. **Workspace switch требует `await update()` ДО `window.location.reload()`** — иначе JWT cookie keep'ает старый orgId и reload пользы не приносит. См. `f1857b7`.

6. **NextAuth v5 beta `useSession.update()` не всегда передаёт `trigger === "update"`** в JWT callback. Поэтому JWT callback ВСЕГДА re-resolves `activeOrgId` (без guard на trigger). См. `9721d93`.

7. **`prisma.$queryRaw` нельзя использовать для композиции SQL** — это execute, не fragment. Для условных WHERE используй `Prisma.sql` + `Prisma.empty` (см. `src/app/api/admin/embed-documents/route.ts`).

8. **OrgSwitcher должен иметь fallback** если `data.activeOrgId` не найден в `data.organizations` — иначе UI исчезает. Сейчас fallback на `data.organizations[0]`.

9. **Хранение секретов**: `.env` теперь в `.gitignore`. НЕ верни его обратно в трекинг. НЕ кладите реальные значения в `.env.example`.

---

## Как дебажить когда что-то не работает

В порядке быстроты:

### 1. Что в Vercel?
```powershell
npx vercel inspect <deployment-id> --logs
```
Где `<deployment-id>` — из URL последнего failed deployment в Vercel UI.

### 2. Что в браузере?
Открой DevTools → Network → найди фейлящий request → скопируй **Response body**. Многие endpoint'ы теперь имеют `saveError` / `detail` поля для удобной диагностики.

### 3. Что в Sentry?
Если ошибка в catch блоке — она уже там с тегом `op:<route-name>`.

### 4. Что в Neon?
Открой Neon → SQL Editor. Полезные диагностические запросы:
```sql
-- Состояние схемы
SELECT
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='Organization') AS has_org_table,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Document' AND column_name='orgId') AS has_doc_orgid,
  EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') AS has_pgvector;

-- Stale activeOrgId юзеров
SELECT u."id", u."email", u."activeOrgId"
FROM "User" u
LEFT JOIN "Organization" o ON o."id" = u."activeOrgId"
WHERE u."activeOrgId" IS NOT NULL AND o."id" IS NULL;

-- Чистка stale activeOrgId (если нужно)
UPDATE "User"
SET "activeOrgId" = NULL
WHERE "activeOrgId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Organization" WHERE "Organization"."id" = "User"."activeOrgId"
  );
```

### 5. Локальная репродукция
```bash
npm install
cp .env.example .env  # потом подставить значения
npm run dev
```
Локально работает на SQLite или Neon в зависимости от `DATABASE_URL`. Test suite: `npm test`.

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
- **Weekly digest**

### 📊 Аналитика
- **PostHog** event tracking. Free tier EU. ~1.5-2ч
- **Admin dashboard** для тебя — все юзеры/orgs/usage в одном месте, поиск, ручное изменение плана. ~3-4ч
- **Per-org analytics** — OWNER видит активность команды

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
- **Counterparty monitoring** — alerts когда статус контрагента изменился
- **Custom AI prompts per org** — каждая команда настраивает свой стиль анализа

### 🤝 Интеграции
- **Slack/Telegram bot** — анализы прилетают в канал команды
- **Битрикс24/amoCRM коннектор**
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

## Оперативный кэш (что свежо в голове у предыдущей сессии)

- **Воркспейсы только что отлажены** через серию из 5+ фиксов. Если что-то с workspaces сломается — первое подозрение: JWT/cookie state. Используй `await update() + window.location.reload()` для любого action меняющего activeOrgId.
- **Документы сохраняются** — фикс был в `ensureActiveOrg` (validate via Membership) + surface saveError в response.
- **Vercel build pipeline стабильный** на `prisma db push --skip-generate`. Любое добавление unique constraint требует осторожности.
- **Tests запускаются** через `npm test`. Build через `npx next build`. Всегда оба перед push.
- **Pgvector + Voyage** работают — можно ссылаться на готовую инфру когда надо ещё что-то embeddable добавить.

---

## Контакты infrastructure

- **GitHub**: https://github.com/zzzz212/don
- **Production**: https://juriist.vercel.app
- **Production branch**: `main`
- **Active feature branch** (где вся работа): `claude/intelligent-cerf-a72ede`
- **Vercel project**: zzzz212-projects/don (или juriist в Settings → General)
- **Neon project**: console.neon.tech → don / juriist project
- **Sentry org**: juriist
- **Voyage AI**: voyageai.com — проверь dashboard для usage
- **Yandex Cloud**: console.cloud.yandex.ru → folder с OCR service account

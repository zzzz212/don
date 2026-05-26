@AGENTS.md

# 🚀 Открывающий промт для новой сессии

> Скопируй этот блок как первое сообщение в новой сессии. Дальше — этот же
> CLAUDE.md, читай его подряд.

```
Привет. Я работаю над Яксо — Russian legal-tech SaaS на Next.js 16 +
Prisma + Neon Postgres. ~210 коммитов, production https://yakso.ru,
активная ветка `claude/sprint-8-ui-polish`, мерж в `main` через PR #7.
Полная картина — в CLAUDE.md в корне репо.

ПЕРВОЕ ДЕЙСТВИЕ В НОВОЙ СЕССИИ

0. **СНАЧАЛА** invoke `superpowers:using-superpowers`. Без этого
   skill'а ниже не двигаться — он задаёт правила работы для всей
   сессии. Superpowers — приоритетный плагин №1, использовать
   ВСЕГДА, на каждом действии, без исключений.

1. Прочитай CLAUDE.md целиком (~2200 строк). Там вся архитектура, схема,
   foot-guns (#1-#64), env vars, дебаг-рецепты, бизнес-roadmap,
   полная история спринтов.

2. Подтверди 8-10 буллетами:
   – Что построено (top-level overview одним абзацем-конспектом —
     ВКЛЮЧАЯ Deal Room из Sprint 14, editorial design system из
     Sprint 13, durable async analyze + parallel + AI negotiation
     moves + ICS calendar export из Sprint 15A)
   – Минимум 8 критичных foot-guns:
       • #47 — Opus tool_use wrapping (`record_response` tool + defensive unwrap)
       • #58 — AiUsage пишется DURING analyze не at COMPLETED → parallel-start race
       • #59 — `?force=1` не должен использоваться для bypass FREE caps (только cache)
       • #60 — anonymous AI endpoints должны logUsage против deal.ownerId
       • #11 — план user-scoped (`User.plan`, не `Organization.plan`)
       • #28 — Vercel Hobby clamps function timeout to 60s
       • #41 — Anthropic не принимает `temperature` в текущих моделях
       • #43 — modal scrim ВСЕГДА `bg-black/60`, не theme-aware токен
   – Текущая ветка и production URL
   – AI tier policy (FREE→Haiku, PRO→Sonnet, BUSINESS→Opus только в analyze)
   – User-scoped план (НЕ Organization.plan)
   – Durable async analyze: 5 статусов (PENDING/RUNNING/COMPLETED/
     FAILED/CANCELLED), atomic claim через updateMany, Vercel self-
     invoke pattern, INTERNAL_SECRET ОБЯЗАТЕЛЕН в prod env
   – Бизнес-блокеры запуска (ЮKassa, домен на Vercel, Resend domain,
     счёт ИП, Роскомнадзор)
   – Sub-projects status: Sub-A (Sprint 15A) ✅ done в PR #7;
     Sprint 15A.1 (5 final-review deferred fixes: preemptive cancel,
     typed exception, ICS line folding, INTERNAL_BASE_URL,
     rate-limit на /active) ✅ done в PR #8. Sub-B (real two-sided
     Counter-AI + DECLINED/EXPIRED + audit-trail PDF при AGREED) и
     Sub-C (inbox dashboard + sidebar 6→3 + realtime presence) —
     впереди.
   – Что я должен сделать на стороне ЮKassa/Vercel/Resend/Neon если
     ты затронешь критичный путь

3. Спроси «что делаем сегодня». Если конкретики нет — следующий шаг
   по бизнес-roadmap в CLAUDE.md (приоритет: подключить домен к
   Vercel + установить INTERNAL_SECRET в prod env + завершить Sub-A
   manual smoke на preview).

═══ ПРАВИЛА РАБОТЫ В ЭТОЙ СЕССИИ ═══

🔴🔴🔴 SUPERPOWERS — ПРИОРИТЕТ №1, БЕЗ ИСКЛЮЧЕНИЙ 🔴🔴🔴

Плагин **superpowers** — это самый приоритетный плагин. Использовать
его НА КАЖДОМ шагу, В КАЖДОМ действии, в КАЖДОМ задании и запросе.
Буквально ВСЕГДА. Не «если задача сложная», не «если есть план», не
«если нужен code review» — а **на любом действии без исключений**:

- Открываешь сессию → `superpowers:using-superpowers` СНАЧАЛА.
- Получаешь ЛЮБОЙ запрос от пользователя (даже «привет», даже «как
  дела») → перебери superpowers skill'ы, найди применимый, invoke.
- Думаешь написать код → `superpowers:brainstorming` или
  `superpowers:writing-plans` ПЕРЕД редактором.
- Видишь bug / упавший тест / странное поведение →
  `superpowers:systematic-debugging` ПЕРЕД любым guess'ом.
- Реализуешь фичу или fix → `superpowers:test-driven-development`,
  пишешь тест ПЕРЕД кодом.
- Дошёл до «готово / работает / прошло» →
  `superpowers:verification-before-completion` ПЕРЕД commit.
- Готов commit/PR → `superpowers:requesting-code-review`.
- Получил ревью → `superpowers:receiving-code-review` ПЕРЕД фиксами.
- Несколько independent подзадач → `superpowers:dispatching-parallel-agents`.
- Закрываешь ветку → `superpowers:finishing-a-development-branch`.

**Тишина = нарушение правила.** Перед действием обязательно
проговори: «Использую superpowers:[skill] чтобы [цель]» — иначе ты
скипнул обязательный шаг.

**Rationalize'ы запрещены полностью**: «это слишком просто», «я и так
знаю», «overkill», «сначала по-быстрому посмотрю файлы», «процесс
замедлит», «не нужен skill на такой мелкий fix». Все эти мысли —
red flag из `using-superpowers`, означают что я скипаю обязательный
шаг.

**Прецедент 2026-05-24**: на production-инциденте Opus tool_use
wrapping я сначала пытался гадать («Counter-AI prompt block виноват»
→ revert → identical error). Только когда invoke'ил
`superpowers:systematic-debugging` и добавил instrumentation, нашёл
настоящую причину. **Два неработающих guess-фикса были прямым
нарушением этого правила.** Не повторять.

🔌 ПОЛНЫЙ РЕЕСТР ПЛАГИНОВ И SKILLS — ОБЯЗАТЕЛЬНО ПРОВЕРЯТЬ КАЖДЫЙ:

ВСЕГДА в начале задачи проверь список доступных skills и invoke каждый,
к которому есть хотя бы 1% релевантности. Это не опция, не «если
сложная задача», а железное правило для ЛЮБОЙ задачи — даже «простой
вопрос» или «маленький fix».

▸ superpowers (ПРИОРИТЕТ №1 — pre-flight для любой задачи):
  • superpowers:using-superpowers — в начале ЛЮБОЙ задачи / вопроса
  • superpowers:brainstorming — ПЕРЕД любым новым кодом / фичей / поведением
  • superpowers:writing-plans — есть спека / план на >1 шаг
  • superpowers:executing-plans — параллельная сессия по готовому плану
  • superpowers:subagent-driven-development — план в текущей сессии, fresh subagent per task
  • superpowers:test-driven-development — реализация фичи / багфикса, написание test'а ПЕРЕД кодом
  • superpowers:systematic-debugging — ЛЮБОЙ баг / упавший тест / странное поведение ПЕРЕД фиксом
  • superpowers:verification-before-completion — перед "готово / работает / прошло" / commit / PR
  • superpowers:requesting-code-review — готовая фича / PR, прошу ревью
  • superpowers:receiving-code-review — получил ревью, перед implement'ом fix'ов
  • superpowers:dispatching-parallel-agents — 2+ независимых подзадач параллельно
  • superpowers:using-git-worktrees — нужна изоляция от текущего workspace
  • superpowers:finishing-a-development-branch — закрываю ветку, готовлю merge / PR
  • superpowers:writing-skills — создаю / редактирую skill (редко в этом проекте)

▸ frontend-design:frontend-design — создаю / меняю web-интерфейс с фокусом
  на дизайн (component, page, application). UI polish тоже сюда.

▸ claude-md-management:
  • claude-md-management:revise-claude-md — обновляю CLAUDE.md по итогам сессии
  • claude-md-management:claude-md-improver — аудит / улучшение существующего CLAUDE.md

▸ code-review (built-in CLI):
  • code-review:code-review — кодревью текущего diff / PR (low/medium/high effort)
  • code-review — алиас, тот же tool без префикса
  • review — slash-command вариант (для конкретного PR)

▸ security-review — security-аудит pending changes в ветке (отдельный
  pass от обычного code-review, фокус на OWASP top 10 / leak / auth).

▸ verify — запустить app и руками проверить что change реально работает.
  Использовать когда tsc / тесты прошли, но feature-correctness не доказана.

▸ run — запустить app для скриншота / визуальной проверки. Выбирает
  правильный launcher для типа проекта (Next.js dev server здесь).

▸ claude-api — building / debugging / migrating Claude API & Anthropic SDK
  кода. Включает prompt caching, model migrations (4.5→4.6→4.7), tool use,
  thinking, batch, files, citations, memory. Применяется когда трогаем
  `src/lib/ai/providers/anthropic.ts` и подобное.

▸ plugin:context7:context7 — current docs по библиотекам / SDK / API /
  CLI / cloud services. Use ВМЕСТО web search для library docs (Next.js,
  React, Prisma, Tailwind, etc.) — свежее и точнее чем training data.

▸ plugin:telegram:telegram — Telegram bot integration (если пользователь
  настроил /telegram:configure и /telegram:access). Reply на сообщения,
  download attachments. Не запрашивай /telegram:access от своего имени.

▸ telegram:* (admin skills) — управление Telegram-каналом, доступом,
  pairing. Запускаются ТОЛЬКО когда пользователь сам просит.

▸ Прочие CLI-skills:
  • init — инициализирует CLAUDE.md для нового проекта (не для этого)
  • fewer-permission-prompts — анализ transcript'ов на read-only commands
  • update-config — настройка hooks / permissions / env vars в settings.json
  • keybindings-help — кастомизация Claude Code shortcuts (~/.claude/keybindings.json)
  • loop — recurring task на интервале (используется для polling / babysit)
  • schedule — cron-расписание для remote agents

▸ MCP-серверы доступны как deferred tools (load через ToolSearch):
  • plugin:context7:context7 — см. выше (docs)
  • plugin:telegram:telegram — см. выше (messaging)
  • claude_ai_Google_Drive — auth + read/write GDrive (если нужно)
  • bybit / bybit-prod — crypto trading; в этом проекте не применимы,
    игнорируй

▸ Built-in inline tools (всегда доступны без ToolSearch):
  Read, Edit, Write, Glob, Grep, Bash, PowerShell, Agent, AskUserQuestion,
  ScheduleWakeup, ShareOnboardingGuide, Skill, ToolSearch

ПРИОРИТИЗАЦИЯ:
- Процесс-skills (brainstorming, debugging, TDD) → СНАЧАЛА, они задают КАК
- Implementation-skills (frontend-design, claude-api) → ПОТОМ, они задают ЧТО
- "Build X" → brainstorming → writing-plans → implementation
- "Fix bug Y" → systematic-debugging → implementation
- Перед коммитом ВСЕГДА verification-before-completion

═══ КАДЕНЦИЯ КОТОРАЯ ДАЛА КАЧЕСТВО В SPRINT 14 + 15A ═══

Проверено на ~30 коммитах: эта цепочка даёт высокий и стабильный
результат с минимальным rework. Не упрощать без причины.

1. **`superpowers:brainstorming`** — даже если задача кажется простой.
   Особенно важно: **scope decomposition** если запрос затрагивает
   несколько независимых подсистем. Один spec должен охватывать ОДИН
   вертикальный slice. Sprint 15A был разбит на Sub-A/Sub-B/Sub-C
   именно так, и Sub-A прошёл цельно.

2. **`superpowers:writing-plans`** — план должен иметь verbatim код
   в каждом step'е. Это позволяет subagent'ам исполнять без догадок.
   НО: **проверять shape API/типов перед verbatim в плане** — в Sprint
   15A несколько раз пришлось корректировать (`messages`→`prompt`,
   `tier`→`model`, `relativeTime`→`timeAgo`). Перед `writing-plans`
   читай реальный код целевых модулей.

3. **`superpowers:subagent-driven-development`** — fresh subagent на
   каждый task + две стадии review (spec compliance + code quality).
   Model selection:
   - Mechanical/single-file → **haiku** (cron route, env config)
   - Multi-file integration → **sonnet** (большинство tasks)
   - Architecture/judgment/final whole-implementation review → **opus**

   Не запускай два implementer'а в parallel — конфликты файлов.

4. **Final whole-implementation review (opus) после ВСЕХ tasks** на
   полный branch range. Ловит cross-task issues которые per-task review
   пропускает. В Sprint 15A нашёл 3 critical: parallel-quota race
   (#58), `?force=1` bypass (#59), anonymous unmetered AI (#60).
   **Не пропускать** этот шаг — он окупается всегда.

5. **`superpowers:finishing-a-development-branch`** — push к existing
   PR (правило проекта — мерж только через GitHub UI), НЕ локальный
   merge. Перед merge — manual smoke на preview deploy (особенно для
   schema migrations + новых env vars).

ПРОТОКОЛ ПЕРЕД ОТВЕТОМ:
- Skill-checklist'ы → разворачивай в TodoWrite по пункту на задачу.
- Перед действием проговори: «Использую [skill] чтобы [цель]».
  Тишина = ты skip'нул skills.
- Rationalize'ы запрещены: «это слишком просто», «я и так знаю»,
  «overkill», «сначала по-быстрому посмотрю файлы». Это red flag —
  означает skip обязательного шага.
- Skills — выше привычки «сразу читать код» и «отвечать коротко».

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

**Дата последнего обновления**: 2026-05-24 (после Sprint 15A «Durable
async analyze + parallel + AI negotiation moves + ICS calendar export»
— ~38 коммитов поверх Sprint 14). Хронология последних трёх заходов:

- **Sprint 14 (Deal Room MVP)** — Network-first pivot. 16 коммитов
  разработки + 4 hot-fix под Opus tool_use wrapping (foot-gun #47)
  + 4 коммита design-polish round 1-2. Итог: spec, plan, 4 Prisma
  модели, 6 API роутов, editorial `/deal/[token]` page, branded OG,
  bespoke `<DealRoomIllustration>`.
- **Sprint 14 design completion** — 12 коммитов: SendAsDeal editorial
  rewrite, dashboard Active Deals editorial + lastSeenAt + sentinel
  dot, "Sprint 14" leaks removed, audit-trail bullet removed,
  Counter-AI prompt restored inline (foot-gun #51 mitigation),
  optimistic UI на agree/disagree, perspective chip в DealRoom header,
  loading skeleton (ClauseSkeleton), specific 404/429 error states,
  misclick guard.
- **Sprint 15A (текущий заход)** — 18 коммитов + 1 fixup. Schema
  migration (AnalysisStatus enum + 6 fields + DealClause.suggestedMoves),
  durable async analyze (`/api/analyze/{start,run,[id]/status,[id]/result,[id]/cancel,active}`),
  cron `/api/cron/restart-stuck-analyses` (5-min), Vercel self-invoke
  pattern + INTERNAL_SECRET, `<ActiveAnalysesStrip>` multi-track UI,
  killer feature #1 (AI negotiation moves в Deal Room с MovesSchema +
  3 cards + apply-Accept/Compromise/Stand), killer feature #3 (ICS
  RFC 5545 export). Final whole-implementation review нашёл 3 critical
  + 5 important — 4 fix'нуты в коммите `154402a`, остальные 5 закрыты
  в Sprint 15A.1 (PR #8): preemptive cancel (AbortController через
  всю провайдер-цепочку), typed `CancelledByUser` exception, ICS line
  folding RFC 5545 §3.1, `INTERNAL_BASE_URL` env var, rate-limit на
  `/api/analyze/active`.

| | |
|---|---|
| **Production** | https://yakso.ru |
| **Repo** | https://github.com/zzzz212/don |
| **Active branch** | `claude/sprint-8-ui-polish` (мерж в `main` через PR #7) |
| **Main branch** | `claude/complete-previous-tasks-rzcSp` (та, что зовём «main») |
| **Stack** | Next.js 16 / React 19 / TypeScript / Prisma + Neon Postgres (pgvector) / NextAuth v5 beta.30 / Tailwind 4 (CSS-first + @custom-variant) / Geist + Source Serif 4 / motion (Framer v12) / Anthropic Claude 4.x (Haiku/Sonnet/Opus) с prompt caching |
| **Тесты** | 417 unit-тестов через vitest (`npm test`) |

Russian legal-tech SaaS: AI-анализ договоров с verdict и per-risk apply-fix
+ **Deal Room MVP (Sprint 14)** — двусторонняя переговорная по договору
с anonymous receiver flow без логина, Counter-AI (one-sided AI inference
о позиции второй стороны), agree/disagree/comment per-clause, public
`/deal/[token]` URL, branded OG-preview — + 20 шаблонов генерации +
AI-refine + чат-юрист + проверка контрагентов (DaData/ЕГРЮЛ работают;
ФССП — env-gated провайдер под `FSSP_AUTH_KEY`, КАД — заглушка) +
workspaces + ЮKassa-биллинг + 2FA + audit log + admin-панель + PostHog +
dark mode + i18n + ⌘K + AccountMenu + onboarding + кастомные 404/500/OG
+ /blog с 9 cornerstone-статьями + /help FAQ + /sample-report preview +
sitemap/robots/JSON-LD + Vercel cron для lifecycle-писем + сеть между
пользователями («Связи» — профили / подключения / ревью / личные
сообщения) + установка как PWA на телефон + массовая проверка договоров
+ платформенная оболочка (sidebar + page-header) на всех authenticated
экранах + editorial design system (paper-grain texture, hairline rules,
serif marginalia, bespoke SVG illustrations).

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
- В sidebar nav и /network header переименовано «Сеть» → «Связи», EN
  `Contacts`. Внутренняя таба «Связи» → «Подключения» чтобы не было
  Связи→Связи crumb-trail.

### Deal Room (Sprint 14) — `src/lib/deals.ts` + `src/lib/deal-session.ts`

**Network-first pivot** — Яксо переориентирован с «AI читает договор»
на «переговорная для договоров». Receiver-first entry: контрагент
открывает invite-ссылку без логина и видит AI-разбор плюс кнопки
agree/disagree/comment per-clause. Spec: `docs/superpowers/specs/
2026-05-23-sprint-14-deal-room-design.md`. Plan: соседний файл в
`docs/superpowers/plans/`.

**Модели Prisma** (после миграции через `prisma db push`):
- `Deal` — id, ownerId, orgId, documentId, title, status (ACTIVE | AGREED),
  inviteToken (192-bit hex, @unique non-nullable). Один SENDER + один
  RECEIVER на Deal через `@@unique([dealId, role])` на DealParticipant.
- `DealParticipant` — role (SENDER | RECEIVER), userId? (set для SENDER
  всегда; для RECEIVER если он залогинится), sessionId? (cookie-bound,
  set когда anonymous receiver открывает link первый раз — atomic
  claim через updateMany), guestName?, guestEmail?, lastSeenAt.
- `DealClause` — ord, text, riskLevel, yourSide (Json — снимок
  AnalysisRisk описание + consequence + recommendation + legalReference;
  recommendedText НЕ хранится тут, см. foot-gun #50), theirSide
  (Json? — Counter-AI inference: theirGain + optional compromise),
  status (PENDING | AGREED | DISPUTED | RESOLVED).
- `ClauseAction` — kind (AGREE | DISAGREE | COMMENT | PROPOSE_EDIT),
  body?, participantId, createdAt. История голосов и комментариев.

**AI**: расширение `AnalysisRiskSchema` в `src/lib/ai/schemas/analyze.ts`
добавляет `counterPerspective: CounterPerspectiveSchema.optional()`.
Поле необязательное → старые анализы парсятся без него. Counter-AI
prompt-инструкция выкл'ючена в Sprint 14, **восстановлена в Sprint 14
design completion** (коммиты `0e1757b` + `373e960`) в правильной inline-
форме без top-level JSON-примера (foot-gun #51 mitigation). Plus
`z.coerce.number()` на `score` для устойчивости к Anthropic'овской
квази-числовой сериализации (foot-gun #48).

**Сервис-слой** (`src/lib/deals.ts`):
- `generateInviteToken()` — `randomBytes(24).toString("hex")`, 48-char.
- `reconcileClauseStatus(actions, senderId, receiverId)` — pure logic:
  latest AGREE/DISAGREE per participant, COMMENT/PROPOSE_EDIT
  игнорируются. Both AGREE → AGREED, любой DISAGREE → DISPUTED, иначе
  PENDING. Покрыто 8 unit-тестами.
- `createDealFromDocument(args)` — org-scoped owner check (foot-gun
  замечание из ревью Task 4: WHERE userId AND orgId — иначе мульти-
  workspace юзер может прикрепить чужой документ), Array.isArray guard
  на parsed Analysis.risks, bounded retry на коллизию inviteToken (до 5
  попыток с throw), одна `$transaction` для Deal + 2 DealParticipants
  + N DealClauses.

**Session identity** (`src/lib/deal-session.ts`):
- `DEAL_SESSION_COOKIE = "yakso_deal_session"`, 128-bit hex.
- Cookie path = `"/"` (НЕ `"/deal"` — foot-gun #49). Cookie должна
  передаваться И на /deal/[token] страницу И на /api/deals/by-token/*
  POST'ы. httpOnly + sameSite=lax + 90 days + secure в prod.

**API роуты**:
- Sender (authed, VIEWER гарданы по foot-gun #37):
  - POST /api/deals — создаёт Deal + invite email. Rate limit
    `deals.create` (10/мин). Audit `deal.created` с key `email` (не
    `counterpartyEmail` — foot-gun #26 redaction).
  - GET /api/deals — список deal'ов в активном org. Возвращает
    `inviteToken` для dashboard-link'ов.
  - GET /api/deals/[id] — full deal payload (sender perspective).
  - POST /api/deals/[id]/clauses/[clauseId]/actions — sender action,
    реконсилит clause status и promote/demote deal.status.
- Receiver (anonymous, session-bound):
  - GET /api/deals/by-token/[token] — атомарный claim RECEIVER через
    `updateMany WHERE sessionId IS NULL AND userId IS NULL`; если
    authed-owner — возвращает SENDER perspective (дверь reuse одного
    URL для обеих ролей). Rate limit token-scoped (`deals.action` 60/мин).
    **owner.email НЕ возвращается** — PII protection. **document.rawText
    НЕ возвращается** — foot-gun #50.
  - POST /api/deals/by-token/[token]/identify — set guestName. Требует
    что sessionId уже забит на participant (anti-hijack — foot-gun #50).
    Rate limit per-session.
  - POST /api/deals/by-token/[token]/clauses/[clauseId]/actions —
    receiver action, session→participant binding обязательна.

**UI** (`/deal/[token]`):
- Editorial design: title page как фронтиспис договора (две стороны с
  initial-кругами + центральная hairline), § 01 marginalia clause
  numbers в serif tabular, Counter-AI справа через hairline rule,
  компромисс в margin note. StatusBar — 2px hairline progress.
  Motion-stagger на clauses (motion/react, 50ms increments).
- IdentifyModal: bottom-border-only input (НЕ боксированный field —
  feels like signing a document).
- `/deal/[token]/opengraph-image.tsx` — branded OG-preview (letterhead +
  serif title + italic «от <sender>» + terracotta dot + yakso.ru).
  Когда ссылку шарят в Telegram/WhatsApp — выглядит как обложка договора.

**Bespoke SVG**: `src/components/deal-room-illustration.tsx` — два
контрактных листа со скрепляющей terracotta-нитью и сургучной печатью.
currentColor + CSS vars → theme-aware. Используется на dashboard
empty-state (когда есть docs но нет deals — slim promo card) и на
landing в Deal Room band.

### Durable Async Analyze (Sprint 15A) — `src/lib/analyze/`

Превратили `/api/analyze` из синхронного fire-and-forget POST (60-300с
без возможности reload) в полноценную durable job-систему. User может
загрузить N договоров параллельно, перезагрузить страницу — анализ
продолжается в фоне.

**Схема** (`prisma/schema.prisma`):
- `Analysis` расширен: `status AnalysisStatus @default(COMPLETED)`,
  `startedAt DateTime?`, `finishedAt DateTime?`, `progress Int
  @default(100)`, `stage String?`, `errorMessage String?`. Defaults
  делают migration безопасной для всех existing rows.
- `AnalysisStatus` enum: `PENDING | RUNNING | COMPLETED | FAILED | CANCELLED`.
- Defaults на existing NOT NULL columns: `score @default(0)`,
  `summary @default("")`, `risks @default("[]")` — нужны чтобы worker
  мог создать PENDING row ДО того как analyze результат известен.
- `@@index([status, startedAt])` — для cron-запроса stuck-job.
- `DealClause.suggestedMoves Json?` — кэш для AI negotiation moves.

**Модули** (`src/lib/analyze/`):
- **`job.ts`** — pure types + constants: `AnalysisJobStatus`,
  `AnalysisJobStage`, `AnalysisJobView`, `pickStageFromProgress()`,
  `STUCK_PENDING_MS = 30_000`, `STUCK_RUNNING_MS = 1_800_000`.
  Zero imports — client-safe. Используется UI компонентом и cron.
- **`prepare.ts`** — `prepareDocument(file, ocrAllowed, userId, orgId)`
  выносит parse + OCR + length-check из старого `/api/analyze` в
  переиспользуемую функцию. Возвращает `PrepareResult` или
  бросает `PrepareError` с typed code'ом.
- **`run.ts`** — `runAnalyzeJob(analysisId)` — orchestrator.
  Atomic claim через `updateMany WHERE status='PENDING'`, прогресс
  checkpoints на 5/30/50/90/100, cancellation check на каждом
  checkpoint'е через sentinel `__CANCELLED__`, persist final result
  + status=COMPLETED. Failure path → markFailed + reportError.
  Embed-chunks + captureEvent + consumeReferralBonus fire-and-forget.
- **`kick-off.ts`** — `kickOffBackgroundAnalyze(analysisId)` —
  Vercel function self-invoke pattern. `fetch(POST /api/analyze/run)`
  без `await` (или с `void`), `x-internal-token` header guard.
  2-retry с 1s delay. Если оба провалились — cron подхватит через 30с.

**API роуты** (`src/app/api/analyze/`):
- `POST /start` — синхронная часть (parse+OCR+quota check, <15s),
  создаёт Document + PENDING Analysis, kick-off → returns `{analysisId,
  documentId}` за <2с. **Quota check учитывает PENDING+RUNNING в гейте**
  (foot-gun #58 fix) — не сжигает квоту, worker запишет AiUsage на
  завершении.
- `POST /run` — internal-only (INTERNAL_SECRET header check). Вызывает
  `runAnalyzeJob`. `maxDuration = 300`. Возвращает `{ok, claimed}`.
- `GET /[id]/status` — `{status, stage, progress, errorMessage,
  finishedAt}` для polling. Owner check. Rate-limit `analyze.poll`
  (300/min).
- `GET /[id]/result` — full analysis payload только когда `status ===
  COMPLETED`, иначе 425 Too Early.
- `POST /[id]/cancel` — owner-only atomic `updateMany` PENDING|RUNNING
  → CANCELLED.
- `GET /active` — list PENDING+RUNNING для current user (cap 20,
  recent first). Используется для resume hydration на reload.

**Cron** (`src/app/api/cron/restart-stuck-analyses/route.ts`):
Schedule `*/5 * * * *` в `vercel.json`. Auth — `Bearer ${CRON_SECRET}`.
Два recovery path:
- `status=PENDING AND createdAt < now-30s` → re-kick через
  `kickOffBackgroundAnalyze`. Atomic claim в runAnalyzeJob защищает
  от двойного запуска.
- `status=RUNNING AND startedAt < now-30min` → mark FAILED с
  тарифо-aware errorMessage («Анализ занял слишком много времени.
  Возможно, документ слишком сложный или превысил лимит вашего
  тарифа. Попробуйте ещё раз или обновитесь до тарифа Про.»).

**Client UI** (`src/components/active-analyses-strip.tsx`):
Sticky multi-track панель сверху `/analyze` и `/dashboard`. Render
null когда нет active jobs. Hydration на mount: `GET /api/analyze/active`
(server truth) + localStorage `yakso.activeAnalyses` (фоллбэк). Polling
каждые 2.5с per active job. Window event `yakso:analyze-started`
от `/analyze` page при успешном start → новая строка появляется без
round-trip. На COMPLETED — превращается в `Перейти →` ссылку на 5с,
потом убирается. На FAILED — показывает errorMessage + close-кнопку.

**Quota policy**:
- `/start` НЕ списывает квоту — только проверяет (foot-gun #58
  fix: в гейте учитываются PENDING+RUNNING + completed AiUsage)
- `runAnalyzeJob` пишет AiUsage **DURING** analyzeContract (через
  внутренний `logUsage` в analyze.ts) — не at COMPLETED. Failed
  посередине жалоб НЕ списывает (worker не дойдёт до final write).
  Cancelled — частично списано (тем, что успело).

### Killer Feature #1 — AI Negotiation Moves (Sprint 15A)

Когда clause в Deal Room имеет `status === "DISPUTED"`, под clause-card
появляется панель «AI рекомендует» с 3 cards: Согласиться (A) /
Компромисс (B, с готовой формулировкой в mono-slab'е) / Стоять на
своём (C).

**Schema**: `DealClause.suggestedMoves Json?` — cache для AI ответа.
**Schema** (`src/lib/ai/schemas/negotiation.ts`): `MovesSchema`
требует ровно 3 объектa с `id ∈ {A, B, C}`, `title 1-80`, `body 1-800`,
`proposedText` ≤2000 nullable+optional.

**Prompt** (`NEGOTIATION_MOVES_PROMPT` в `src/lib/ai/prompts.ts`):
inline (без top-level JSON-примера, foot-gun #51 mitigation), с явным
guard «Не оборачивай moves в дополнительный объект на уровне ответа».

**API**: `POST /api/deals/[id]/clauses/[clauseId]/suggest-moves` (sender)
+ `POST /api/deals/by-token/[token]/clauses/[clauseId]/suggest-moves`
(receiver). Оба:
- Server-side DISPUTED-only gate (foot-gun #6 из final review)
- Cache hit returns `DealClause.suggestedMoves`, `?force=1` bypass'ит
  cache (но НЕ FREE quota — foot-gun #59)
- FREE plan: 10 chat-feature AiUsage rows / 24h cap (применяется
  ВНЕ зависимости от `?force=1`)
- Receiver path: `logUsage(deal.ownerId, deal.orgId, ...)` — spend
  атрибутируется sender'у (foot-gun #60 fix). Anonymous receivers
  никогда не давали logUsage с null userId — `logUsage` bail'ит.
- Rate limit: `negotiation.suggest` (15/min per user или per session).
- AI: `generate({schema: MovesSchema, system: NEGOTIATION_MOVES_PROMPT,
  prompt, model: pickTier('chat', plan), maxTokens: 1500})`. На FREE
  → Haiku, PRO+ → Sonnet.

**UI** (`src/app/deal/[token]/negotiation-moves.tsx`): 4-state
component (idle trigger, loading skeleton 3-card, error+retry,
loaded 3-card grid). Apply A → POST AGREE action. Apply B → POST
PROPOSE_EDIT action с `proposedText` как body. Apply C → POST
COMMENT с `body` как rationale. Refresh button → `?force=1`.

### Killer Feature #3 — ICS Calendar Export (Sprint 15A)

В overflow menu на `/report/[id]` появилась кнопка «Скачать в
календарь (.ics)». Один клик — файл сразу открывается в
Google/Apple/Outlook Calendar, все extracted deadlines ложатся
событиями на нужные даты.

**Builder** (`src/lib/ics.ts`): pure RFC 5545. CRLF line endings,
day-level `DTSTART;VALUE=DATE:YYYYMMDD`, UTC `DTSTAMP:YYYYMMDDTHHmmssZ`,
escape order MATTERS (backslash first, потом `;,`, потом newlines).
Используется именно через `IcsEvent[]` + `buildIcsCalendar(events, now?)`.

**Route** (`src/app/api/documents/[id]/deadlines.ics/route.ts`):
GET, owner-only (session.user.id vs Document.userId), читает
`ContractDeadline.where({documentId, dismissed: false}).orderBy({dueDate})`,
строит `IcsEvent[]` с label из `KIND_LABEL` (`expiry/renewal/payment/
notice/other` → русские названия), возвращает `text/calendar; charset=utf-8`
с `Content-Disposition: attachment; filename="{sanitised}-deadlines.ics"`.

**UI**: `src/components/ics-download-button.tsx` — standalone компонент
с disabled-state когда нет deadlines (на случай переиспользования
вне overflow menu). На `/report` интегрировано напрямую через
`overflow.push({label, icon: Calendar, href: ...})` в MenuButton.

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
| `CRON_SECRET` | Защита `/api/cron/billing-reminders` + `/api/cron/restart-stuck-analyses` | В prod без него крон 401; в dev/preview доступ открыт для curl |
| `INTERNAL_SECRET` | **Sprint 15A**. Защита `/api/analyze/run` (background worker endpoint). Self-invoke в `kickOffBackgroundAnalyze` шлёт `x-internal-token: ${INTERNAL_SECRET}`. **Production MUST set** — без него worker возвращает 503, analyses зависают PENDING, cron через 30 мин помечает FAILED. Generate: `openssl rand -hex 32` или (Windows PowerShell) `$bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); ($bytes \| ForEach-Object { $_.ToString('x2') }) -join ''`. Scope: Production + Preview. |
| `INTERNAL_BASE_URL` | **Sprint 15A.1**. (опц.) Override base URL for self-invoke в `kickOffBackgroundAnalyze`. Default — `BRAND.publicUrl` (`https://yakso.ru`). На preview deploys полезно установить в preview URL (e.g. `https://don-<hash>-zzzz212-projects.vercel.app`), иначе self-invoke улетает на prod с local-only `analysisId` → wasted request. Без unset на prod — фоллбэк работает корректно. | Self-invoke в dev/preview уходит на prod URL, PENDING висит до cron'а |

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

47. **Anthropic Opus 4.7 заворачивает tool_use payload в
    `{"result": {...}}`** когда tool назван `submit_result` или
    description начинается с "Submit the structured result". Модель
    трактует schema как описание объекта `result` вместо top-level
    shape. Sonnet/Haiku этого не делают.
    Защита в `src/lib/ai/providers/anthropic.ts`: (a) tool теперь
    `record_response` с описанием "Provide the response fields…as
    direct top-level properties. Do NOT nest them under any wrapper
    key"; (b) defensive `isResultWrapper` unwrap на случай регресса —
    распознаёт ровно `{ result: object }` shape (один ключ, non-null
    object) и не может false-positive (ни одна схема в `src/lib/ai/
    schemas/` не имеет top-level `result`). 8 unit-тестов пинят
    контракт. Production-инцидент 2026-05-24: Sprint 14 deploy ломал
    весь analyze flow до фикса.

48. **Anthropic иногда сериализует numeric JSON как строку** —
    `{"score": "8"}` вместо `8`. Под высокой токен-нагрузкой / у
    конкретных моделей. Schema на `analyze.ts` использует
    `z.coerce.number().int().min(1).max(10)` — конвертит без потери
    range-валидации. JSON Schema, отдаваемая Anthropic / Gemini, всё
    равно `{type: "integer"}`, fallback-цепочка не страдает.

49. **Deal session cookie path = `"/"`, НЕ `"/deal"`** — кука должна
    travel'ить и на page navigation `/deal/[token]`, И на POST
    `/api/deals/by-token/[token]/(identify|clauses/…/actions)`. С
    path `/deal` cookie не отправлялась на `/api/...` → каждый POST
    минтил новый sessionId → identify и actions возвращали 403. Не
    меняй scope назад.

50. **На /api/deals/by-token GET НЕ возвращай sensitive поля**:
    - `document.rawText` — invite token == access control; форвард
      ссылки давал бы полный текст договора любому.
    - `owner.email` — PII; только `owner.name`.
    - `recommendedText` внутри `yourSide` — это negotiating position
      sender'а, не показывается receiver'у до согласования. В
      `createDealFromDocument` оно сознательно НЕ хранится в `yourSide`
      JSON (см. Sprint 14 спецификацию).
    Дополнительно: identify endpoint требует чтобы sessionId уже был
    забит на receiver row (anti-hijack — атакер с токеном не мог бы
    pre-claim слот до того как настоящий получатель откроет ссылку).

51. **Tool descriptions подсказывают модели shape ответа**, не только
    функцию. Tool name `submit_result` + description «Submit the
    structured result» → Opus 4.7 копирует «result» как wrapper key
    (см. #47). Tool name `record_response` + description «Provide the
    response fields…as direct top-level properties. Do NOT nest them
    under any wrapper key» — модель отвечает плоско. То же касается
    JSON-примеров В САМОМ ПРОМПТЕ — изолированный `ПРИМЕР: { "foo":
    {...} }` блок ближе к концу system prompt'а в Sprint 14 Task 3
    привёл к тому, что Opus echo'ил пример как top-level ответ. Не
    показывай JSON-примеры в виде отдельных верхнеуровневых блоков —
    встраивай поля inline в bullet-описание схемы.

52. **`/api/documents/[id]` GET возвращает И `id`, И `documentId`**
    (как альяс). `/api/analyze` возвращает `{ documentId, ... }`, и
    report page `/report/[id]` читает `analysis.documentId` чтобы
    рендерить collaboration-кнопки. Без alias на reload кнопки
    PublicShare / SendForReview / DeadlineScan / SendAsDeal тихо
    исчезают. Не убирай alias.

53. **AccountMenu placement prop**: dropdown в sidebar нижнем рейле
    должен `placement="up"` И `absolute left-0` (а не `right-0`).
    Триггер в bottom-LEFT viewport'а, `top-full right-0` улетал
    одновременно ВНИЗ за экран и ВЛЕВО за край. Mobile top-bar — default
    `down` + `right-0` (anchor правый верхний угол).

54. **Sprint 15A. `Analysis` schema-defined NOT NULL columns нужны
    defaults** для background-worker pattern. Если worker создаёт
    PENDING row до того как у него есть данные analyze, `score/summary/
    risks` нужны `@default(0/""/"[]")`. Без default'а — `prisma.document.
    create` с nested analysis create падает. После Sprint 15A: defaults
    стоят, существующие rows получили `status=COMPLETED, progress=100`
    автоматически — zero-backfill migration.

55. **Sprint 15A. `updateMany WHERE status='PENDING'` — atomic claim
    pattern**. Возвращает count=1 для победителя, count=0 для проигравших.
    Single-fire даже при гонке нескольких kick-off'ов. Используется в
    `runAnalyzeJob` в `src/lib/analyze/run.ts`. Заменяет необходимость в
    Redis-lock / advisory lock для durable job systems. Этот паттерн
    подходит для любого PENDING→RUNNING перехода в schema.

56. **Sprint 15A. Vercel function self-invoke pattern**: `fetch(POST /api/
    analyze/run)` БЕЗ `await` (с `void`) даёт мгновенный возврат на
    caller'е + отдельную 300s function на worker'е. Auth — `x-internal-
    token` header против `INTERNAL_SECRET`. Без INTERNAL_SECRET в prod
    worker не аутентифицируется, analyses зависают PENDING, cron через
    30 мин помечает FAILED. См. `src/lib/analyze/kick-off.ts`.

57. **Sprint 15A. `await fetch()` resolves на response headers, НЕ на
    connection accept**. Если worker идёт 300с — `await fetch()` ждёт
    всё это время. Для true fire-and-forget нужен `void fetch(...)` (без
    await вообще). Caller в `/api/analyze/start` использует `void
    kickOffBackgroundAnalyze(...)` — функция `kickOff` сама await'ит
    response чтобы видеть OK/non-OK для retry-логики, но top-level caller
    не блокируется.

58. **Sprint 15A. AiUsage пишется DURING analyze, НЕ at COMPLETED**.
    `prisma.aiUsage.count` отражает только actual spend, не зарезервированный.
    Background job system, который проверяет квоту ТОЛЬКО на `/start`,
    имеет race: 5 parallel start'ов от FREE user'а с 9/10 used — все 5
    проходят гейт, все 5 пишут AiUsage. Fix в `/api/analyze/start`: count
    `Analysis WHERE status IN ('PENDING','RUNNING') AND document.userId=
    userId` и добавлять к `quota.used` перед `>= limit`. Уже применено в
    коммите `154402a`. Не убирать.

59. **Sprint 15A. `?force=1` нельзя использовать как bypass для FREE-
    quota**. Negotiation moves endpoint в первой версии имел `if
    (effectivePlan === "FREE" && !forceRegenerate)` — кнопка «Обновить»
    всегда отправляла `?force=1`, тривиально обходя 10/day cap. Любой
    FREE-cap должен применяться regardless of force. **Правило: force
    — это ТОЛЬКО cache-bypass, не quota-bypass.** Применить ко всем
    будущим caching endpoint'ам.

60. **Sprint 15A. Anonymous AI endpoints должны logUsage против deal
    owner'а**. `logUsage(userId, orgId, usage, feature)` bail'ит на falsy
    userId — `logUsage(null, ...)` ничего не пишет. Receiver-perspective
    AI calls (без `session.user`) должны передавать `clause.deal.ownerId`
    как userId, чтобы spend атрибутировался sender'у (его workspace,
    его квота). Иначе anonymous endpoint = unmetered Anthropic spend
    vector. Уже применено для receiver suggest-moves.

61. **Sprint 15A. Cancel в durable job — cooperative, НЕ preemptive**
    (закрыто в Sprint 15A.1). `runAnalyzeJob` проверял CANCELLED только
    на progress checkpoint'ах (5/30/50/90). Между checkpoint 50 и 90
    сидел весь `analyzeContract` (20-150с) — `AbortController` в provider
    не был проброшен. Закрыто в Sprint 15A.1: `runAnalyzeJob` спинит
    AbortController + 2s interval-poll; `signal` threaded через
    `analyzeContract` → `{single,multi}-pass` → `mapChunks` /
    `extractRisksForChunk` / `synthesizeStructure` → `generate()` →
    провайдер. Anthropic/Groq SDK принимают `{signal}` 2-м аргументом;
    Gemini SDK не понимает signal natively, используется `withAbort`
    race-helper.

62. **Sprint 15A. `__CANCELLED__` sentinel theoretically collidable**
    (закрыто в Sprint 15A.1). Заменено на `class CancelledByUser
    extends Error {}` + `if (err instanceof CancelledByUser)` в
    `src/lib/analyze/run.ts`. Контракт явный, не зависит от того что
    провайдер не вернёт случайно эту строку.

63. **Sprint 15A. RFC 5545 ICS escape order MATTERS**. В `src/lib/ics.ts`
    `escapeText` ОБЯЗАН escape'ить backslash ПЕРВЫМ (`\\` → `\\\\`),
    потом `;`, `,`, и newlines. Иначе двойной escape добавит `\` к
    уже-добавленным escape'ам — поломанный output. Также: CRLF line
    endings обязательны, day-level events через `VALUE=DATE:YYYYMMDD`
    (без TZ block — простой для подавляющего большинства cases).
    **Line folding на 75 octets — закрыто в Sprint 15A.1** через
    `foldLine` helper, который режет на UTF-8 byte boundaries (важно
    для кириллицы: 1 символ = 2 байта, SUMMARY:Срок оплаты по договору
    легко выходит за 75 octets).

64. **Sprint 15A. Self-invoke в dev/preview может уйти на prod URL**
    (закрыто в Sprint 15A.1). Добавлен `INTERNAL_BASE_URL` env var с
    фоллбэком на `BRAND.publicUrl`. На preview deploy — set
    `INTERNAL_BASE_URL=<preview-url>`. На prod — оставить unset.

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
- `GEMINI_API_KEY` не выставлен в Vercel → fallback-цепочка фактически
  только Anthropic+Groq, и Groq режется TPM-лимитом 12k на длинных
  договорах → analyze падает на «All providers failed» если Anthropic
  flake'нёт. Бесплатно: `aistudio.google.com/apikey`, set в Vercel
  Project Settings → Environment Variables → Production.
- Расчётный счёт ИП не открыт → `OPERATOR.bank*` пустые → банковский
  блок оферты скрыт.
- Уведомление в Роскомнадзор не подано → `OPERATOR.rknOperatorNumber`
  не заполнен.
- Resend domain не подтверждён → welcome / password-reset / deal-invite
  не уходят на реальных юзеров.
- Домен `yakso.ru` не подключён к Vercel → ссылки в письмах / OG /
  `/r/[token]` / `/deal/[token]` ведут на 404.
- 0 каналов привлечения (SEO/PPC/партнёрки/комьюнити).

### 🌐 Sprint 15B — Deal Room evolution (Sub-B)

- **Real two-sided Counter-AI** — когда receiver реально заполнил
  свою позицию через текстовое поле, Counter-AI должен пересчитать
  обе стороны симметрично, а не использовать prompt-инференс
  Sender'а. Требует: input UI для receiver position, prompt update,
  schema field `DealClause.receiverInput Json?`.
- **DECLINED / EXPIRED статусы Deal'а** + UX отказа («Отклонить
  предложение полностью», expiry policy через TTL config), новые
  ENUM values в `DealStatus`, кнопка «Отклонить» на Deal Room для
  receiver'а.
- **Audit-trail PDF при AGREED** — когда оба participants AGREE'нули
  все clauses, генерируется combo DOCX (final контракт) + PDF
  audit-trail (кто/когда/что отметил), bundle attached к email
  Deal-completed.

### 🌐 Sprint 15C — Inbox + IA reorg + realtime (Sub-C)

- **Sidebar 6→3 reorg**: Deal Rooms / Drafts & Templates / Tools
  collapse (Counterparty / Bulk / Chat / Compare / Deadlines уходят
  под Tools nav).
- **Inbox-style главный экран** заменяет `/dashboard`: «Ждут вас /
  Ждут их / Готово» вместо документ-карточек. Депенды от DECLINED/
  EXPIRED статусов из Sub-B.
- **Realtime presence** (Liveblocks или `@vercel/pubsub`) — cursors,
  online dots, live action streaming в Deal Room. Заменяет 2.5s
  polling Sub-A на push-based updates.

### 🌐 Sprint 16 — Public-facing + monetization

- Лендинг переписать вокруг live Deal Room demo (current Sprint 14
  band — promo proxy, не полный pivot).
- `/sample-report` → `/sample-deal` static showcase.
- Pricing model invert: Receiver (free, unlimited) / Solo Sender
  (1990₽) / Pro Sender (4990₽) / Business (14990₽). Backfill
  существующих подписок.
- Email-capture phase 2 (hybrid receiver entry): read-without-login,
  email-magic-link для actions.

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

### Sprint 15A — Durable Analyze + Parallel + 2 Killer Features (последний заход)

PR #7, ветка `claude/sprint-8-ui-polish`, в `main` НЕ смержено.
Pushed как range `cef8b32..154402a` (19 коммитов на remote).

```
154402a Sprint 15A final-review fixes: quota race, force-bypass, anonymous spend, status gate
7261e20 Add ICS calendar export for contract deadlines (killer feature #3)
0c8494e Add NegotiationMoves component + integrate into DISPUTED clauses
fe7417f Add suggest-moves endpoints for sender + receiver perspectives
5836967 Add MovesSchema + NEGOTIATION_MOVES_PROMPT for killer feature #1
332a26f Mount ActiveAnalysesStrip on /dashboard
b9f6abf Switch /analyze to durable job flow with parallel + resume support
3448b24 Add ActiveAnalysesStrip — sticky multi-job progress panel
3537663 Add stuck-analysis recovery cron (5-minute interval)
2632dee Add /api/analyze/[id]/{status,result,cancel} + /api/analyze/active
21e2153 Add /api/analyze/start (sync prep) and /api/analyze/run (background worker)
5229268 Add runAnalyzeJob orchestrator with atomic claim + progress + cancel
b8ec1ef Add kickOffBackgroundAnalyze helper for self-invoke pattern
182a1d8 Initialise contractText to empty string, drop non-null assertions
c0971e8 Extract document parse + OCR into src/lib/analyze/prepare.ts
642d99f Add pure analyze-job types + stage helper + stuck-job thresholds
99f1e0f Schema: AnalysisStatus enum + durable-job fields + DealClause.suggestedMoves
f8713f8 Plan Sprint 15A — 16 tasks for durable analyze + 2 killer features
1da666a Spec Sprint 15A — Durable analyze + parallel + 2 killer features
```

Четыре волны:

**1. Spec + plan** (`1da666a` + `f8713f8`). Через `superpowers:brainstorming`
→ scope decomposition в 3 sub-projects (Sub-A/B/C), затем
`writing-plans` развернул Sub-A в 16-task implementation plan с verbatim
кодом в каждом step'е.

**2. Implementation** (16 tasks, `99f1e0f` → `7261e20`). Через
`superpowers:subagent-driven-development` — fresh subagent per task,
two-stage review (spec compliance + code quality), model selection
по сложности (haiku для mechanical, sonnet для multi-file, opus для
final review). Foundation-first: schema → pure helpers → orchestrator
→ endpoints → cron → UI → killer features → verification.

Несколько adjustments по ходу:
- T3 reviewer попросил `let contractText = ""` initializer вместо
  `!` non-null assertions — implementer применил fixup (`182a1d8`).
- T13 (suggest-moves endpoints) — plan имел `messages: [{role,content}]`
  но реальный `GenerateOptions` это `prompt: string` + `system:
  SystemPromptInput`. Implementer сделал правильный adjustment.
- T15 implementer завершил все 5 файлов но не успел commit'нуть до
  session limit — controller commit'нул вручную (`7261e20`).

**3. Final whole-implementation review (opus)** на `f8713f8..HEAD`
range. Нашёл 3 critical + 5 important:
- **Critical**: parallel-start quota race, `?force=1` обходит FREE cap,
  anonymous receiver не logUsage'ит.
- **Important**: cancel cooperative not preemptive, sentinel collision
  potential, no DISPUTED gate on suggest-moves, INTERNAL_BASE_URL,
  no rate-limit on `/active`.

**4. Final-review fixes** (`154402a`). 3 critical + 1 important (DISPUTED
gate) fix'нуты сразу. Остальные 5 important + minor → Sprint 15A.1.

Acceptance Sprint 15A (12 criteria из spec): static gates ✅ — tsc
clean, **437/437 tests** (417 baseline + 20 new), `next build` clean.
Manual smoke deferred до preview deploy с установленным INTERNAL_SECRET.

### Sprint 14 design completion — «editorial alignment + Counter-AI restore + UX»

PR #7, ветка `claude/sprint-8-ui-polish`. Range `8f08383..cef8b32`,
12 коммитов реализации (через `subagent-driven-development`).

```
cef8b32 Disable the already-selected vote button to prevent duplicate actions
1036959 Map Deal Room error states to specific editorial messages
89a9d5b Replace bare-spinner loading with editorial clause skeleton
6b17756 Add perspective chip to Deal Room title-page header
14652c3 Optimistic UI for agree/disagree/comment in Deal Room
b74cc44 Extract reconcileClauseStatus into client-safe src/lib/deal-status.ts
d0516e5 Drop "Sprint 14" eyebrow leaks and false-advertising audit-trail bullet
0e746e2 Editorial Dashboard Active Deals list + sentinel dot + lastSeenAt formatting
0ebfad7 Rewrite SendAsDeal modal in editorial style to match IdentifyModal
9d56444 Add Counter-AI fallback when theirSide is null on a clause
373e960 Tighten Counter-AI bullet — explicit response-shape guard
0e1757b Restore Counter-AI prompt instruction inline (no top-level JSON example)
71833c4 Plan Sprint 14 design completion — 12 tasks, Counter-AI first
5906af5 Spec Sprint 14 design completion — editorial alignment + Counter-AI restore + UX
```

Закрыло 6 gap'ов после Sprint 14:
1. SendAsDeal editorial alignment (`IdentifyModal` parity)
2. Dashboard Active Deals editorial + sentinel dot + lastSeenAt formatting
3. "Sprint 14" eyebrow leaks убраны + false-advertising "Аудит-трейл" bullet
4. Counter-AI prompt restored (inline, foot-gun #51 mitigation)
5. Counter-AI empty-state fallback
6. UX upgrades: `reconcileClauseStatus` → client-safe module, optimistic
   UI, perspective chip, loading skeleton, specific 404/429 error states,
   misclick guard

### Sprint 14 + design polish — «Deal Room + editorial» (заход до того)

PR #7, ветка `claude/sprint-8-ui-polish`, в `main` НЕ смержено.

```
8b96a1f Polish round 2: motion-stagger clauses, refresh empty-states, /report editorial touches, landing Deal Room band
9583167 Editorial Deal Room redesign + bespoke illustration + branded OG
579d9fc Lighter dashboard + Каталог: slim KPI strip, tight rows, compact search
9eee9e9 Dashboard polish — account menu anchor, slim usage strip, rename Сеть → Связи
3927777 Fix three post-Sprint-14 prod issues
d7a7314 Revert Counter-AI prompt block — model copied JSON example as full response
5920b5e Instrument Anthropic provider to dump raw tool_use.input
264c290 Unwrap Anthropic tool_use {result: {...}} envelope (Opus 4.7 regression)
d9a1ae2 Coerce analyze score from string to number (Anthropic JSON serialisation drift)
3d64f4b Close three Sprint 14 final-review findings before merge
0deacce Wire Deal creation into report page + add Active Deals to dashboard
3dcf1d4 Add Deal Room page UI: two-column layout, clause cards, identify modal, status bar
443bd34 Flesh out deal-invite email body with personal message + value props
dbd9020 Fix critical Deal Room receiver bugs: cookie path, PII leak, claim race
db04b96 Add receiver API: anonymous /deal/[token] endpoints
d945944 Demote deal.status from AGREED to ACTIVE when a clause flips back open
5cf8116 Add sender clause-action endpoint
6413937 Harden POST /api/deals: VIEWER guard, status mapping, audit redaction, email XSS fix
4884942 Add sender API: POST /api/deals, GET /api/deals, GET /api/deals/[id]
60bbbaf Add anonymous deal session identity (cookie-based)
83d591c Clarify DealParticipant.sessionId lifecycle in schema comment
b8da7b8 Harden createDealFromDocument: org-scoped owner check, non-array JSON guard, bounded retry
64d2972 Add Deal service layer: token gen, status reconciliation, deal creation
7e203ef Translate prompt section header to Russian for consistency
28f39fd Tell analyze prompt to generate counterPerspective per risk
31f44a4 Tighten Counter-AI rejection test + drop unused import
7cf80b5 Extend analyze schema with Counter-AI counterPerspective field
7f8e4a6 Clarify Deal.inviteToken comment — foot-gun #38 only applies to nullable @unique
3918013 Add Deal Room schema — Deal, DealParticipant, DealClause, ClauseAction
ff348c3 Plan Sprint 14 — Deal Room MVP implementation steps
5f604b9 Spec Sprint 14 — Deal Room MVP
```

Три волны:

**1. Sprint 14 core (3918013 → 3d64f4b, 17 коммитов).** Spec / план через
`superpowers:brainstorming` + `writing-plans`, исполнение через
`subagent-driven-development` (fresh subagent per task + spec compliance +
code quality review). 4 модели Prisma + Counter-AI schema extension + 6
API роутов + UI + email + integration. Spec compliance reviews находили
проблемы и закрывали их (~9 security-grade fixes в ходе работы):
- Task 4 review: org-scoped owner check, Array.isArray guard, bounded
  retry, RECEIVER cookie lifecycle invariant clarified
- Task 6 review: XSS в email body (escapeHtml на user-controlled fields),
  VIEWER guard, status mapping 404/422 вместо 500, key `email` not
  `counterpartyEmail` для redact()
- Task 7 review: deal-status demote AGREED→ACTIVE когда clause flips
- Task 8 review (security-focused): cookie path `/` not `/deal`,
  receiver claim atomic updateMany, owner.email PII drop
- Final review: document.rawText leak fix, identify-hijack guard +
  rate-limit, recommendedText leak из yourSide JSON

**2. Production hot-fixes (d9a1ae2 → 3927777, 6 коммитов).** После
deploy Sprint 14 на prod analyze упал с zod-ошибкой:
- 1-й тур: думал что Anthropic возвращает `"score": "8"` (string) →
  добавил `z.coerce.number()` (d9a1ae2)
- 2-й тур: ВСЕ поля undefined → подумал что Counter-AI prompt block
  с `ПРИМЕР:` сбил модель → откатил блок (d7a7314)
- 3-й тур: identical error → понял что guess'ы не работают →
  `superpowers:systematic-debugging`. Добавил instrumentation,
  попросил production log (5920b5e). Log показал
  `input_keys: ['result']` → Opus 4.7 wraps tool_use в `{result:{...}}`
  из-за tool name `submit_result`. Defensive unwrap (264c290) +
  permanent fix через переименование tool в `record_response` +
  переписанное description (вошло в полировку, см. ниже). 3 prod-баг'а
  одного коммита 3927777: AccountMenu anchor улетал, usage widget
  четыре строки Безлимит, Сеть как nav-item → Связи переименование.

**3. Design polish (9eee9e9 → 8b96a1f, 4 коммита).** Через
`frontend-design`:
- Round 1 (9eee9e9 + 579d9fc): AccountMenu placement prop, hidden
  usage widget на Business, рестайл КPI / search / document rows под
  warm minimalism, Каталог Связей list-style вместо card grid.
- Round 2 (9583167 + 8b96a1f): editorial Deal Room (title page,
  marginalia clause numbers, hairline rules, paper-grain), bespoke
  SVG illustration (`<DealRoomIllustration>`), branded OG для
  /deal/[token], refresh empty-states (общий editorial vocabulary),
  /report subtle hairlines + ink-quiet, landing Deal Room band между
  «Что мы ловим» и «Как это работает», motion-stagger на Deal Room
  clauses. Token additions: `--rule`, `--ink-quiet`, `.paper-grain`
  utility (inline SVG fractalNoise).

Acceptance Sprint 14 (spec criteria 1-8): static gates ✅ — `tsc`,
417 тестов, `next build`. Manual smoke flow: sender → receiver flow →
agree/disagree → AGREED transition. Известные deferred-задачи на
Sprint 15: real two-sided Counter-AI (когда обе стороны заполняют свою
позицию), realtime presence (Liveblocks / @vercel/pubsub), inbox-style
dashboard, sidebar 6→3, email-capture phase 2, audit-trail на финальный
DOCX. Sprint 16: новый landing под Network thesis (текущая Deal Room
band — proxy), pricing model invert (Receiver free / Solo / Pro /
Business), `/sample-report` → `/sample-deal`.

### Sprint 13 — «тёплый минимализм»

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

- **Sprint 15A.1** (закрыт, 2026-05-26) — **Final-review deferred
  fixes**. 5 fix'ов из Sprint 15A whole-implementation review: ICS
  line folding RFC 5545 §3.1 (foot-gun #63, helper `foldLine` режет
  на UTF-8 byte boundary — критично для кириллицы), `INTERNAL_BASE_URL`
  env var с фоллбэком на `BRAND.publicUrl` для dev/preview isolation
  (foot-gun #64), rate-limit `analyze.poll` на `/api/analyze/active`
  (унификация с siblings status/result), `CancelledByUser` typed
  exception вместо `__CANCELLED__` sentinel string (foot-gun #62),
  **preemptive cancel** — `AbortController` через `runAnalyzeJob` +
  threaded через `analyzeContract` → `{single,multi}-pass` → `mapChunks`
  / `extractRisksForChunk` / `synthesizeStructure` → `generate()` →
  каждый provider (foot-gun #61). Anthropic/Groq SDK принимают
  `{signal}` 2-м аргументом; Gemini SDK — race-helper `withAbort`.
  **6 коммитов** (1 plan + 5 fixes), `tsc` + 442 тестов + `next build`
  зелёные. PR #8.

- **Sprint 15A** (закрыт, 2026-05-24) — **Durable async
  analyze + parallel + 2 killer features**. Через
  `superpowers:brainstorming → scope-decomposition (Sub-A/B/C) →
  writing-plans (16 tasks, verbatim code) → subagent-driven-development
  (haiku/sonnet/opus selection) → final whole-implementation review (opus)`.
  Замены: `/api/analyze` → durable async с 5 статусами, atomic claim
  через `updateMany`, Vercel self-invoke worker `/api/analyze/run`
  guarded INTERNAL_SECRET, cron `restart-stuck-analyses` каждые 5 мин,
  `<ActiveAnalysesStrip>` polling 2.5с + localStorage rehydration +
  resume on reload + parallel jobs. Killer #1: AI negotiation moves в
  DISPUTED clause (`<NegotiationMoves>` + sender/receiver suggest-moves
  endpoints + DealClause.suggestedMoves cache). Killer #3: ICS RFC 5545
  export (`/api/documents/[id]/deadlines.ics` + кнопка в `/report`
  overflow). Final review нашёл 3 critical (parallel-quota race,
  ?force=1 bypass, anonymous unmetered AI) + 1 important (no DISPUTED
  gate) — fix'нуто в `154402a`. Остальные 5 → Sprint 15A.1. **18+1
  коммитов** (1 spec + 1 plan + 16 impl + 1 fix), `tsc` / **437 тестов**
  (417 baseline + 20 new) / `next build` зелёные. PR #7 НЕ смержен.
  **INTERNAL_SECRET ОБЯЗАТЕЛЕН в Vercel envs до deploy**.
- **Sprint 14 design completion** (закрыт, 2026-05-24) — закрыло 6
  gap'ов после Sprint 14 + 2 design polish раундов: SendAsDeal
  editorial rewrite, Dashboard Active Deals editorial + lastSeenAt +
  sentinel dot, удалены «Sprint 14» eyebrow leaks + false-advertising
  audit-trail bullet с лендинга, Counter-AI prompt restored inline
  (foot-gun #51 mitigation), Counter-AI empty-state fallback, UX
  upgrades (optimistic UI на agree/disagree, perspective chip,
  ClauseSkeleton, 404/410/429 specific error states, misclick guard,
  `reconcileClauseStatus` → client-safe модуль). **12 коммитов**,
  417 тестов зелёные.
- **Sprint 14 + design polish** (закрыт, 2026-05-24) — **Network-first
  pivot + Deal Room MVP**. Через `brainstorming → writing-plans →
  subagent-driven-development`: 4 Prisma модели (Deal/DealParticipant/
  DealClause/ClauseAction), Counter-AI schema extension, 6 API роутов
  (3 sender + 3 receiver anonymous), `/deal/[token]` page, invite
  email, integration в /report и dashboard. Production-инцидент:
  Opus 4.7 wraps tool_use в `{result:{...}}` (foot-gun #47) — найден
  через `systematic-debugging` instrumentation, фикс: rename tool +
  defensive unwrap. Полный design-polish round 1+2 через
  `frontend-design`: editorial Deal Room (paper-grain, hairline rules,
  marginalia clause numerals), bespoke `<DealRoomIllustration>`,
  branded OG `/deal/[token]/opengraph-image.tsx`. Tokens added:
  `--rule`, `--ink-quiet`, `.paper-grain`. **~25 коммитов**.
- **Sprint 13** (закрыт, 2026-05-21) — «тёплый минимализм».
  Палитра ушла от глубокого синего на cool off-white к terracotta на
  cream warm-ink. Лендинг переписан с нуля: split-hero с live
  sample-card, новый headline с italic terracotta, снесли fake-stats и
  feature-dump'ы. Прокидка через 27 auth-экранов автоматически (токены
  + serif h1 в PageHeader). Brand chrome (favicon/PWA/OG, обе) и email
  шаблоны перерисованы под палитру. Пять коммитов 2A-2E. `tsc` /
  389 тестов / `next build` зелёные.
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

- **🚨 ПЕРЕД merge PR #7 (Sprint 15A)** — выставить `INTERNAL_SECRET`
  в Vercel envs (Production + Preview). Без него background analyze
  worker возвращает 503, анализы зависают PENDING, cron через 30 мин
  помечает FAILED. Generate: `openssl rand -hex 32` (Mac/Linux) или
  Windows PowerShell:
  `$bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''`
- **Manual smoke на preview deploy** — durable analyze (reload mid-
  analysis, parallel jobs, cancel), schema migration check (см. SQL в
  CLAUDE.md дебаг-разделе), AI negotiation moves на DISPUTED clause,
  ICS download в Google Calendar.
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
  Vercel + `db-push-with-retry.mjs` применит Sprint 15A schema migration.

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
  Gemini key в Vercel env (бесплатный, `aistudio.google.com/apikey`)
  хотя бы как страховку. Текущий boot-лог в Vercel: `gemini=✗` —
  цепочка фактически Anthropic-OR-Groq, без middle-tier защиты.
- **Opus tool_use wrapping** — foot-gun #47/#51. Если когда-нибудь
  поменяешь tool name в `src/lib/ai/providers/anthropic.ts` или
  description — проверь что Opus не начинает обратно заворачивать в
  `{result: {...}}`. Defensive `isResultWrapper` unwrap остаётся, но
  лучше не полагаться на него как на единственный слой.
- **Deal Room production smoke** (sender flow → receiver opens
  /deal/[token] → identify → agree/disagree → status flips → both
  AGREE → AGREED). Перед PR merge — пройти ручным smoke'ом, см.
  acceptance criteria в spec'е Sprint 14.
- **Durable analyze production smoke** (Sprint 15A) — загрузить
  договор → reload на середине → строка восстанавливается + продолжает
  поллить → запустить второй параллельно → cancel первого работает.
  AI negotiation moves на DISPUTED clause: 3 cards, Apply B (compromise)
  → PROPOSE_EDIT action создаётся. ICS export из overflow → файл
  открывается в Google Calendar. Schema проверять:
  ```sql
  SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname='AnalysisStatus') AS has_enum,
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Analysis' AND column_name='status') AS has_status,
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='DealClause' AND column_name='suggestedMoves') AS has_moves;
  ```
- **AiUsage attribution для Sprint 15A** — `runAnalyzeJob` пишет
  AiUsage DURING `analyzeContract` (через внутренний `logUsage` в
  `analyze.ts`), не на COMPLETED. Receiver suggest-moves пишет
  AiUsage против `deal.ownerId/orgId` (foot-gun #60 fix). Sender
  suggest-moves — против своего userId/orgId. Все три feed'ятся в
  один `chat` feature counter.
- **CI** — GitHub Actions гоняет `lint` / `tsc --noEmit` / `vitest` /
  `next build` на каждый PR и пуш в `main`.
- **Тесты — 437** (Sprint 15A добавил 20: 8 analyze-job + 7
  negotiation-schema + 5 ics). Перед commit: `npx tsc --noEmit && npm
  test`. Перед push: `npx next build` (нужны `DATABASE_URL` и
  `AUTH_SECRET` — см. опенинг-промт).

---

**Когда читаешь это в новой сессии**: сначала отвечай 7-9 буллетами,
потом спрашивай что делаем. Не пиши код без явного запроса.

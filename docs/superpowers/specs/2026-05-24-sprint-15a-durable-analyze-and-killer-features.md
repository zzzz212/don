# Sprint 15A — Durable Analyze + Parallel + 2 Killer Features

**Дата**: 2026-05-24
**Статус**: design approved, ready for implementation plan
**Ветка**: `claude/sprint-8-ui-polish` (та же что Sprint 14)
**Предыдущий spec**: [Sprint 14 design completion](./2026-05-24-sprint-14-design-completion.md)

## Контекст

Sprint 14 закрыт (Deal Room MVP + полный design polish). Следующий блок
работы — Sprint 15 — изначально планировался большим (realtime presence,
sidebar 6→3 reorg, inbox dashboard, two-sided Counter-AI, DECLINED/EXPIRED
deal statuses). Пользователь при kick-off запросил три дополнительных
направления: возврат к analyze после reload, параллельные анализы,
killer-фичи.

Sum-total scope ~4-6 недель и ~30 коммитов на разнородных surface area —
один spec не выдержит. Разбит на три sub-project'а:

- **Sub-A (этот spec)** — durable async analyze + parallel + 2 killer
  features. ~1.5 недели, ~12 коммитов. Фокус на user-facing проблеме:
  «потерял работу из-за reload» + «не могу запустить второй анализ» +
  два усиления уже построенного.
- **Sub-B (следующий spec)** — Real two-sided Counter-AI + DECLINED/
  EXPIRED + audit-trail PDF при AGREED. Deal Room evolution.
- **Sub-C (потом)** — Inbox dashboard + sidebar 6→3 + realtime presence.
  IA reorg + общая инфра для realtime.

Этот spec охватывает только Sub-A.

## Проблемы, которые закрываем

1. **«Я потерял анализ при перезагрузке».** Текущий `/api/analyze` —
   синхронный fire-and-forget POST на 60-300с. Reload — клиент
   теряет sessionStorage с результатом, server-side функция продолжает
   крутиться вслепую. User думает что надо начинать заново. Реально —
   квота уже сжигается, договор уже грузится, но визуально ничего не
   происходит. На медленной сети («Vercel edge → Neon US-East» + cold
   start) это происходит часто.
2. **«Я хочу запустить ещё один анализ пока этот крутится».** Сейчас
   технически возможно (rate-limit разрешает), но второй tab перетирает
   sessionStorage первого, и нет visual queue показывающего что вообще
   что-то идёт параллельно.
3. **«Сделка зашла в тупик — что делать?»** Sprint 14 даёт ВЫСТАВИТЬ
   позицию (agree/disagree/comment) но не помогает её разрешить. После
   DISAGREE — комментарий («дайте 0.1% вместо 0.5%») — тишина. Юзеры
   возвращаются в WhatsApp. AI-suggested negotiation moves закрывают
   этот gap.
4. **«Когда дедлайны?»** Договор подписан — а через 14 дней оплата, через
   30 дней поставка, через 60 дней право расторгнуть с уведомлением.
   Существующий `ContractDeadline` model + `DeadlineScanButton` AI-
   extract'ит эти даты, но юзер должен сам их где-то фиксировать.
   `.ics` export — нативный способ перенести их в Google Calendar /
   Apple Calendar / Outlook одной кнопкой.

## Архитектура

### Слой данных

**Migration на `Analysis`** (через `prisma db push` без `--accept-data-loss`):

```prisma
model Analysis {
  // existing fields unchanged
  id          String   @id
  documentId  String   @unique
  score       Int
  summary     String
  risks       String       // JSON
  metadata    String?      // JSON
  createdAt   DateTime

  // NEW fields, all backwards-compatible
  status       AnalysisStatus  @default(COMPLETED)
  startedAt    DateTime?
  finishedAt   DateTime?
  progress     Int             @default(100)
  stage        String?
  errorMessage String?
}

enum AnalysisStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

Defaults `status=COMPLETED, progress=100` означают что все существующие
анализы валидны как-есть — нулевой migration risk.

`Analysis.score` и `Analysis.summary` остаются NOT NULL — для PENDING/
RUNNING/FAILED рядов нужен initial value. Решение: создаём со score=0,
summary="" — а UI смотрит на `status` чтобы решить рендерить ли. Когда
worker завершает успешно — обновляет real values.

**Migration safety check**: для каждого нового поля — `@default` или
nullable. Существующие read-only paths (например, `/api/documents/[id]`)
продолжают работать. Foot-gun #2 не активирован (никаких новых
nullable unique constraints).

**Новое поле на `DealClause`** (для killer feature #1):

```prisma
model DealClause {
  // existing fields
  ...
  // NEW
  suggestedMoves Json?    // null = not requested yet, populated = cached AI moves
}
```

### Слой AI

**Существующий `analyze` flow остаётся неизменным** — мы только меняем КТО
его запускает (background worker вместо синхронного POST handler). Логика
chunking / map-reduce / synthesis / verify не трогается.

**Новый AI call для killer feature #1** — короткий single-pass:

- Файл: `src/lib/ai/prompts.ts` — экспорт нового системного промпта
  `NEGOTIATION_MOVES_PROMPT` (~300 токенов)
- Schema: `src/lib/ai/schemas/negotiation.ts` — `MovesSchema` (массив
  ровно из 3 объектов с полями id ∈ {A,B,C}, title, body, proposedText?)
- Tier: используем `pickTier("chat", plan)` — FREE→Haiku, PRO+→Sonnet.
  Соответствует существующей политике, не вводит новую.
- Cost estimate: ~1k input + ~300 output на one moves-set. Haiku: ~$0.003.
  Sonnet: ~$0.015. На FREE — 1 set/day cap по `AiUsage` row, на PRO+ —
  unlimited.

### Слой API

**Новые endpoints**:

```
POST /api/analyze/start
  Body: FormData(file) [как сейчас POST /api/analyze]
  Auth: workspace membership
  Returns: { analysisId, documentId } [< 1 сек, после parse+OCR]
  Effects:
    - Vercel Blob upload (sync, fire-and-forget результата)
    - PDF parse через pdf-parse (sync)
    - OCR check, если нужен — sync через Yandex Vision (5-15s)
    - Create Document + Analysis (status=PENDING, progress=0)
    - kick off background work: fetch /api/analyze/run (NO await)
    - return
  Rate-limit: 'analyze.start' (10/min), как сейчас 'analyze'
  Quota check: НЕ списывает — только проверяет что есть лимит на потом

POST /api/analyze/run  [internal, не публичный]
  Body: { analysisId }
  Auth: header `x-internal-token: ${INTERNAL_SECRET}` (новый env var)
  Returns: { ok: true } [фоновый процесс, ответ unimportant]
  Effects:
    - Atomic claim: UPDATE Analysis SET status='RUNNING', startedAt=now()
      WHERE id=? AND status='PENDING' — single-fire защита
    - Если updateMany.count === 0 → return (уже взят другим worker'ом)
    - Loop: progress checkpoints (parsing→25, chunking→40, analyzing→70,
      synthesizing→90, saving→95) — UPDATE progress + stage между этапами
    - На каждом checkpoint: SELECT status; если CANCELLED → exit clean
    - Final: UPDATE risks, score, summary, status='COMPLETED', progress=100,
      finishedAt=now()
    - Catch: UPDATE status='FAILED', errorMessage=err.message, finishedAt=now()
    - Quota списывается ТОЛЬКО при successful COMPLETED — consumeAiUsage
      записывает row с реальными tokens (как сейчас)

GET /api/analyze/[id]/status
  Auth: workspace membership + doc owner check
  Returns: { status, stage, progress, errorMessage?, finishedAt? }
  Rate-limit: 'analyze.poll' (300/min) — фактически unlimited

GET /api/analyze/[id]/result
  Auth: workspace membership + doc owner check
  Returns: full Document + Analysis (только если status === COMPLETED)
           иначе 425 Too Early с { status, progress }
  Rate-limit: 'analyze.poll' (300/min)

POST /api/analyze/[id]/cancel
  Auth: workspace membership + doc owner check
  Returns: { ok: true }
  Effects: UPDATE status='CANCELLED' WHERE id=? AND status IN ('PENDING','RUNNING')
  Worker увидит это на следующем checkpoint и exit'нет

GET /api/analyze/active
  Auth: workspace membership
  Returns: { jobs: [{ analysisId, documentId, fileName, status, stage, progress,
                      startedAt }] }
  Filter: status IN ('PENDING','RUNNING') AND user is owner
  Used: resume hydration на /analyze и /dashboard когда localStorage потерян
```

**Обратная совместимость**: `POST /api/analyze` (старый) НЕ удаляем сразу
— оставляем как deprecated alias который внутри зовёт `/start` + ждёт
COMPLETED через polling-loop. Это для существующих интеграций которые
могут на него полагаться. Удаление — Sprint 16.

**Killer feature #1 endpoints**:

```
POST /api/deals/[id]/clauses/[clauseId]/suggest-moves       [sender]
POST /api/deals/by-token/[token]/clauses/[clauseId]/suggest-moves [receiver]
  Auth: workspace membership (sender) или session cookie (receiver)
  Body: {} (нет input — всё уже в DealClause)
  Returns: { moves: [{id, title, body, proposedText?}, ...3] }
  Effects:
    - If DealClause.suggestedMoves != null AND status unchanged since last
      generation → return cached
    - Else: AI call (NEGOTIATION_MOVES_PROMPT + clause context)
    - Cache: UPDATE DealClause SET suggestedMoves = result
  Rate-limit: 'negotiation.suggest' (15/min)
  Quota: FREE → 1 per deal per day (via AiUsage feature='negotiation'),
         PRO+ → unlimited
```

Кэш в `DealClause.suggestedMoves` инвалидируется implicit: при любом
новом ClauseAction статус clause может измениться (PENDING ↔ DISPUTED ↔
AGREED), и UI запрашивает свежие moves когда видит DISPUTED после
изменения. Простой подход: кэш живёт пока clause.status не пере-
вычислится; UI решает запрашивать заново через query параметр `?force=1`
если user явно нажал «Обновить предложения».

**Killer feature #3 endpoint**:

```
GET /api/documents/[id]/deadlines.ics
  Auth: workspace membership + doc owner check
  Returns: text/calendar response (ICS string)
  Effects: None — pure read of ContractDeadline rows
  Content-Disposition: attachment; filename="{fileName}-deadlines.ics"
```

### Background execution — pattern

**Решение**: Vercel function self-invocation, не Inngest/QStash/cron.

`/api/analyze/start` после создания PENDING row делает:

```ts
// Fire and forget — НЕ await
void fetch(`${BRAND.publicUrl}/api/analyze/run`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-internal-token": process.env.INTERNAL_SECRET!,
  },
  body: JSON.stringify({ analysisId }),
});
return NextResponse.json({ analysisId, documentId });
```

Vercel запускает второй function instance для `/run` с full 300s window
(на Pro). Connection между ними HTTP, не in-process — поэтому если
первая function завершилась после kick-off, вторая продолжает.

**Защита от потери kick-off** (network glitch / fetch reject):
- Helper `kickOffBackgroundAnalyze(analysisId)` который пытается до 2 раз
  (1s delay)
- Если оба провалились — pre-existing PENDING row остаётся, и health-check
  cron (`/api/cron/billing-reminders` уже существует, добавляем новый job
  `/api/cron/restart-stuck-analyses`) обнаруживает PENDING > 30s и
  пере-kick'ает

**Cron addition** (`vercel.json`):

```json
{
  "path": "/api/cron/restart-stuck-analyses",
  "schedule": "*/5 * * * *"
}
```

Auth: `Authorization: Bearer ${CRON_SECRET}` как существующий
`billing-reminders`. Логика: select PENDING > 30s OR RUNNING > 30min →
either kick-off again (PENDING) или mark FAILED (RUNNING > 30min).

**Foot-gun #28 mitigation**: на Hobby (60s), длинный договор не успеет
even в /run. Стратегия:
- При updateMany count=0 на claim — log warning
- Если RUNNING > 90s без progress change — heuristic в cron'е помечает
  FAILED с errorMessage="Превышен лимит времени для бесплатного плана,
  обновитесь до PRO"
- UI показывает это сообщение + ссылку на upgrade

### Слой UI

**Новые компоненты**:

```
src/components/active-analyses-strip.tsx
  Sticky-полоса сверху /analyze и /dashboard. Editorial style — paper-grain
  card, hairline rules. Один <li> per active job с:
    - filename truncate
    - stage label (uppercase tracking eyebrow)
    - progress bar (hairline, terracotta fill, sage on completion)
    - cancel button
  Polling: 2.5s interval на каждый active job, useEffect cleanup на
  unmount

src/app/deal/[token]/negotiation-moves.tsx [и в sender path]
  3 cards horizontal на md+, stacked на mobile. Editorial:
  - serif title
  - ink-quiet body
  - proposedText в font-mono bg-surface/40 border-rule rounded-md
  - «Применить →» button: ghost variant до hover, primary on hover
  Loading state: skeleton-3-cards при первом запросе
  Error state: editorial fallback с retry button

src/components/ics-download-button.tsx
  Используется на /report/[id]. <Button variant="ghost" size="sm"> с
  Calendar icon. onClick → window.location.href = .../deadlines.ics
  Disabled state с tooltip если deadlines.count === 0
```

**Изменения на существующих экранах**:

- `src/app/analyze/page.tsx` — добавить `<ActiveAnalysesStrip>` сверху,
  заменить старую POST-flow на новую `/start` + добавить-job-в-strip;
  убрать sessionStorage handoff (теперь through DB)
- `src/app/dashboard/page.tsx` — `<ActiveAnalysesStrip>` сверху KPI-полосы
  если есть active jobs
- `src/app/deal/[token]/clause-card.tsx` — рендер `<NegotiationMoves>`
  под clause card когда `clause.status === "DISPUTED"`
- `src/app/report/[id]/page.tsx` — `<IcsDownloadButton>` в overflow menu

**Resume hydration logic** (псевдокод):

```ts
// в /analyze/page.tsx и /dashboard/page.tsx
useEffect(() => {
  async function hydrate() {
    // 1. Local registry
    const localIds: string[] =
      JSON.parse(localStorage.getItem("yakso.activeAnalyses") || "[]");

    // 2. Server-side truth
    const serverActive = await fetch("/api/analyze/active").then(r => r.json());

    // 3. Merge + de-dupe
    const merged = new Map<string, ActiveJob>();
    serverActive.jobs.forEach(j => merged.set(j.analysisId, j));
    // local-only ids that server doesn't know about → likely completed
    // already, just drop them from localStorage
    localStorage.setItem(
      "yakso.activeAnalyses",
      JSON.stringify(serverActive.jobs.map(j => j.analysisId))
    );

    setActiveJobs(Array.from(merged.values()));

    if (merged.size > 0) {
      toast({
        message: "Анализ продолжается в фоне",
        intent: "info",
      });
    }
  }
  void hydrate();
}, []);
```

### Слой email (опциональный для Sub-A, но фиксирую сейчас)

При Deal → AGREED transition (срабатывает уже сегодня в
`/api/deals/[id]/clauses/[clauseId]/actions` POST), если в documents
есть ContractDeadlines — добавить attachment к выходящему email
(`buildDealAgreedEmail` — TBD, сейчас этого email нет, в скоупе Sub-B).
В Sub-A только download-button. Email auto-attach — в Sub-B.

## Тестовое покрытие

**Новые unit tests**:

- `analyze-job-lifecycle.test.ts` — pure-function tests:
  - PENDING → RUNNING atomic claim works (count=1 для первого, 0 для
    последующих)
  - CANCELLED checkpoint exits cleanly
  - FAILED writes errorMessage
- `negotiation-moves-schema.test.ts` — zod validation:
  - 3 объекта парсятся, < 3 или > 3 отклоняется
  - id ∈ {A,B,C} unique
  - proposedText required для id='B', null для A и C
- `ics-generation.test.ts` — pure ICS string builder:
  - VCALENDAR wrapping корректный
  - DTSTART format `YYYYMMDD` для date-only
  - SUMMARY escaping (запятые, переводы строк)
  - Empty deadlines list → empty VCALENDAR (no events)

**Integration tests** (если есть pattern в репо — есть, через mock prisma):

- `/api/analyze/start` создаёт PENDING row + триггерит self-invoke (mocked)
- `/api/analyze/[id]/status` возвращает 404 для чужого doc, 200 для своего
- `/api/analyze/[id]/result` возвращает 425 пока RUNNING, 200 на COMPLETED
- Negotiation moves cached: второй POST возвращает cached без AI call (verify
  через AI mock fake call count = 1)

**E2E**: не требуется в Sub-A (Playwright не настроен).

Цель — пройти 417 существующих + добавить ~15-20 новых.

## Что НЕ входит в Sub-A (out-of-scope)

- Real-time WebSocket / SSE progress (sufficient polling at 2-3s)
- Bulk parallel (5+ одновременно) — 1-3 хватит, UI просто разбухнет
- Multi-step undo для negotiation moves apply
- ICS push to Google Calendar API (download only)
- ICS recurring events для periodic payments (TBD)
- Two-sided Counter-AI → Sub-B
- DECLINED / EXPIRED статус → Sub-B
- Audit-trail PDF при AGREED → Sub-B
- Inbox dashboard / sidebar reorg / realtime presence → Sub-C

## Риски и unknowns

- **Vercel self-invoke надёжность**: pattern работает в Next.js
  community, но не на 100% — sieve через cron restart-stuck-analyses.
  Если self-invoke flake rate > 1% — переключаемся на Inngest в Sub-B.
- **Hobby plan limitation** проявится для пользователей: «у вас застрял
  анализ». Mitigation: ясное сообщение об ограничении + upgrade CTA.
  Это давно подразумевалось foot-gun #28, теперь делаем visible.
- **Schema migration на `Analysis` через `prisma db push`** — все
  defaults гарантируют zero-downtime. НО: новые поля nullable/default
  должны быть проверены — нет ли FK / index конфликтов. Будем сверять
  во время implementation.
- **AI negotiation moves cost** — каждый DISPUTED clause × ≥1 sides ×
  unlimited PRO+ запросов. Cache по умолчанию → новые требования через
  `?force=1`. Без cache — стоимость может бить (5 disputed × 4 PRO юзеров
  × 10 запросов = 200 calls = ~$3/день при Sonnet). С cache — ~$0.3-0.5/день.
  Acceptable для PRO+, но мониторим в `AiUsage` per feature='negotiation'.
- **ICS edge cases**: timezone (поэтому только date-only events для v1),
  recurring (skip), all-day vs timed (skip — все all-day). Если user
  потом потребует recurring (например, ежемесячный платёж) — отдельный
  Sub-D.
- **`Analysis.score`/`summary` NOT NULL constraint** на новых
  PENDING/RUNNING/FAILED рядов — фиксируем initial values (0, "") и
  worker обновляет на real values. Если запрос UI вычислил `score=0`
  как реальную оценку — может выглядеть странно. Решение: UI смотрит
  на `status` field, не на `score === 0`.
- **localStorage потеря** при clear / incognito — server-side
  `/api/analyze/active` восстанавливает. Sync двусторонний.
- **Parallel analyses на одинаковом file** (двойной upload того же
  договора) — оба создают независимые Document rows. Это OK для v1.
  Если станет проблемой (юзер случайно тапнул дважды) — добавить
  dedup по hash в Sub-B.

## Acceptance criteria

Sub-A считается завершённым когда:

1. Загрузил договор на `/analyze` → за < 2 секунды появился в
   `<ActiveAnalysesStrip>` с stage="parsing" / progress=25
2. Reload страницы → strip восстанавливается, polling возобновляется,
   show toast «Анализ продолжается в фоне», prgoress продолжает
   увеличиваться
3. Загрузил второй договор пока первый в работе → оба видны
   параллельно как два <li> в strip
4. Cancel первого → строка пропала немедленно, второй продолжает
5. На completed → строка превращается в ссылку «Перейти к отчёту →»,
   через 5с убирается
6. На FAILED → строка показывает errorMessage + retry-кнопку
7. Quota НЕ списалась на CANCELLED или FAILED (verify через
   `/api/account/plan` или Neon query)
8. Open DISPUTED clause в Deal Room → видна `<NegotiationMoves>` с
   3 cards (cached на second visit, no extra AI call)
9. «Применить B» (compromise) → posts PROPOSE_EDIT action с
   proposedText как body. Clause UI обновляется (через optimistic UI
   ещё T7 из Sprint 14)
10. `/report/[id]` с extracted deadlines → ICS button в overflow menu,
    .ics file открывается в Google Calendar и показывает все events с
    правильными датами
11. Cron health-check `/api/cron/restart-stuck-analyses` идемпотентно
    обрабатывает stuck PENDING (auto-restart) и stuck RUNNING (mark
    FAILED после 30 мин)
12. `tsc --noEmit && npm test && npx next build` — все зелёные, тесты
    не убавляются (минимум 417 + добавленные)

## Sequencing — порядок реализации

Когда напишем implementation plan (writing-plans skill), порядок шагов:

1. **Schema migration**: добавить enum + 6 fields на Analysis, 1 field
   на DealClause, push без data-loss
2. **API: `/api/analyze/start`** — pure refactor существующего
   `/api/analyze` чтобы вынуть analyze logic в отдельную функцию +
   создать PENDING row + kick-off
3. **API: `/api/analyze/run`** — internal endpoint с claim logic +
   progress updates + completion writes
4. **API: status / result / cancel / active** — simple read endpoints
5. **Cron: restart-stuck-analyses** — health-check, добавление в
   `vercel.json`
6. **UI: `<ActiveAnalysesStrip>`** — новый компонент с polling
7. **UI: `/analyze` rewrite** — заменить sessionStorage flow на
   new-job + redirect-when-complete
8. **UI: `/dashboard`** — добавить strip
9. **UI: resume hydration** на mount обеих страниц
10. **Killer feature #1: AI prompt + schema** — `NEGOTIATION_MOVES_PROMPT`,
    `MovesSchema`, suggest-moves endpoint
11. **Killer feature #1: `<NegotiationMoves>` component + integration в
    clause-card** — render когда status=DISPUTED, apply handlers
12. **Killer feature #3: ICS endpoint + button** — text/calendar GET
    route + `<IcsDownloadButton>` в /report overflow menu
13. **Backwards-compat: keep `/api/analyze` POST as deprecated alias**
14. **Tests + verification** через `superpowers:verification-before-completion`
15. **PR update** на `claude/sprint-8-ui-polish`

---

**Когда читаешь это в новой сессии после restart**: spec одобрен,
переходи к `superpowers:writing-plans` чтобы развернуть sequencing в
полноценный implementation plan.

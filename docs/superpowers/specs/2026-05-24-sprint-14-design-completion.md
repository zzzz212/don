# Sprint 14 — Design Completion

**Дата**: 2026-05-24
**Статус**: design approved, ready for implementation plan
**Ветка**: `claude/sprint-8-ui-polish` (та же что Sprint 14 core)
**Предыдущий spec**: [2026-05-23-sprint-14-deal-room-design.md](./2026-05-23-sprint-14-deal-room-design.md)

## Контекст

Sprint 14 («Deal Room MVP») functionally завершён — все 8 acceptance
criteria выполнены, 417 тестов зелёные, два раунда design polish
(editorial Deal Room redesign, bespoke SVG illustration, branded OG,
motion-stagger, slim dashboard, Сеть→Связи rename) проведены.

При финальной разведке найдено шесть дыр, которые мешают называть
дизайн «полностью доработанным»:

1. `<SendAsDeal>` modal (`/report` → создать Deal) построен на product-
   style токенах (`rounded-xl`, `border-border`, `bg-card-hover`,
   `text-muted`, `ring-primary/20`). Не совпадает с editorial Deal Room
   ни в одном элементе. Modal — точка входа в Deal Room flow для
   sender'а; consistency критична.
2. Dashboard «Активные сделки» list строится на тех же старых токенах
   — list и empty-state ниже (`paper-grain border-rule`) не совпадают
   визуально, хотя стоят в одной секции.
3. Внутреннее sprint-naming «Sprint 14» торчит в публичном лендинге
   (`/`) и dashboard empty-state как eyebrow. Это leak product-management
   terminology в маркетинг.
4. Landing band обещает «Аудит-трейл — кто что отметил и когда. Готов
   к подписанию когда оба согласовали». Audit-trail заявлен Sprint 16
   deferred в Sprint 14 спецификации (`2026-05-23-sprint-14-deal-room-
   design.md` строка 332). False advertising.
5. **Counter-AI prompt-инструкция выключена** после prod-инцидента
   (foot-gun #47, коммит `d7a7314`). Все новые анализы создают
   `DealClause.theirSide === null`. Вторая колонка Deal Room
   («Другая сторона» + «Компромисс») визуально пустая для всех новых
   deals. Главная фича переговорной не видна.
6. UX-мелочи Deal Room: agree/disagree блокирующе await fetchDeal() →
   feels broken на медленной сети; нет sender/receiver-perspective
   chip в header; loading — bare spinner вместо skeleton clauses; нет
   specific error states (404 «ссылка устарела», 429 throttle); re-
   click того же голоса минтит duplicate action; на dashboard
   `receiver.lastSeenAt` не используется (всегда «ожидает открытия»).

Sprint 14 design completion закрывает эти шесть дыр. Расширение в
Sprint 15 (inbox dashboard, sidebar reorg, realtime presence) — out of
scope.

## Goals

1. **Editorial consistency.** Каждый visual element, который попадает
   на путь Sprint 14 (modal, list, empty-state, header, status bar),
   использует один словарь токенов: `paper-grain`, `border-rule`,
   `bg-card`, `text-ink-quiet`, serif headings, hairline gestures,
   bottom-border inputs.
2. **Counter-AI is visible in production.** Восстановить prompt-
   инструкцию в правильной inline-форме (foot-gun #51), без regression
   на Opus 4.7 tool_use wrapping (foot-gun #47).
3. **Production-grade Deal Room UX.** Agree/disagree даёт мгновенный
   feedback. Loading и error states выглядят намеренно. Кто я —
   видно. Misclick не создаёт мусор.
4. **Внутренний sprint-naming не виден пользователю.**

## Non-goals

- Real-time presence / live cursors (Sprint 15)
- Inbox-style dashboard reorg (Sprint 15)
- Sidebar 6→3 collapse (Sprint 15)
- DECLINED / EXPIRED статусы Deal'а (Sprint 15)
- Audit-trail DOCX export (Sprint 16)
- Multi-party deals (Sprint 17+)
- Pricing model invert (Sprint 16)
- `/sample-report` → `/sample-deal` (Sprint 16)

## Approach

### S1 — Editorial alignment

#### `<SendAsDeal>` modal (`src/components/send-as-deal.tsx`)

Полный rewrite container и form-controls под editorial словарь
(модель — `IdentifyModal`):

- Container: `paper-grain rounded-2xl border border-rule bg-card
  shadow-xl p-8`, scrim остаётся `bg-black/60 backdrop-blur-md`
  (foot-gun #43).
- Header: убрать иконку Handshake. Eyebrow `Прежде чем отправить`
  (uppercase `text-[10px] tracking-[0.28em] text-ink-quiet`). Title
  `font-serif text-2xl font-semibold tracking-tight` — `Отправить
  второй стороне` / `Сделка создана` в success.
- Inputs: `border-0 border-b border-rule bg-transparent px-0 py-2`,
  `focus:border-primary focus:outline-none focus:ring-0`. Labels —
  uppercase tracking eyebrows над input'ом.
- Submit: `<Button variant="primary" loading={submitting} className="w-
  full">Отправить</Button>`.
- Success: убрать `bg-success-light` круг с галочкой. Eyebrow
  `Письмо отправлено`, serif h2 `Сделка создана`, hairline-bordered
  cream block с URL в mono, две кнопки в ряд: `Скопировать ссылку`
  (primary) + `Закрыть` (ghost).

#### Dashboard «Активные сделки» list (`src/app/dashboard/page.tsx:298-329`)

- Section eyebrow `Активные сделки` uppercase tracking над serif h2
  (уже есть).
- List item: `border border-rule bg-card hover:bg-card/80
  transition-colors rounded-xl px-5 py-3.5`.
- Title — `font-medium text-foreground`.
- Sub-line — `text-xs text-ink-quiet` с receiver-info из S4.
- CTA — `text-sm font-semibold text-foreground hover:text-primary
  underline-offset-4 hover:underline transition-colors`. Терракотовая
  стрелка пропадает в пользу editorial hover-underline.

#### «Sprint 14» leaks

- `src/app/page.tsx:269` — `Sprint 14 · Deal Room` → `Новинка ·
  Deal Room`.
- `src/app/dashboard/page.tsx:339` — same.
- Bullet «Аудит-трейл — …» (`src/app/page.tsx:302-310`) — **удалить
  целиком**. Список схлопывается с 3 до 2 пунктов: «Получатель без
  логина» + «Counter-AI».

### S2 — Counter-AI prompt restoration

#### Где

`src/lib/ai/prompts.ts`, секция `═══ ВЫХОДНЫЕ ДАННЫЕ ═══` (строки
57-67). Сейчас bullets перечисляют поля `risks[].*`, последний —
`legalReference`. Между ним и следующим bullet'ом `missingClauses`
добавляется новый bullet — inline, в том же стиле, без визуального
break.

#### Что (текст инструкции)

```
- В risks[].counterPerspective (необязательно): объект с двумя полями.
  theirGain — одно предложение в свободной форме о том, что от этого
  пункта получает другая сторона договора (выгода или защита).
  compromise (опционально, пропусти если очевидного компромисса нет)
  — одна формулировка-компромисс, которая ослабляет риск для клиента
  и одновременно сохраняет разумную часть выгоды другой стороны. Не
  используй JSON-синтаксис в ответе для этого описания — заполни эти
  поля как обычные строковые свойства внутри объекта риска.
```

#### Защита от регрессии (foot-gun #47)

- `record_response` tool name + «Provide the response fields…as direct
  top-level properties» description в `src/lib/ai/providers/
  anthropic.ts` остаются нетронутыми.
- `isResultWrapper` defensive unwrap остаётся.
- `z.coerce.number()` на `score` (foot-gun #48) остаётся.
- `counterPerspective` остаётся `.optional()` — старые анализы парсятся
  без него.

#### Тесты

- `src/lib/__tests__/analyze-schema.test.ts` — добавить positive-test:
  валидный ответ модели с `risks[0].counterPerspective.theirGain`
  парсится корректно.
- Regression-test: ответ модели где модель сериализовала
  `counterPerspective` как top-level вместо вложенного в risk —
  ожидаем zod-fail (это тот самый wrapping bug; должен ловиться
  schema mismatch, не быть accept'нут).

#### Smoke-протокол перед merge

- Локально с реальным `ANTHROPIC_API_KEY`: `npm run dev`, загрузить
  тестовый договор, дождаться analyze, проверить что (a) запрос не
  падает; (b) минимум 30-50% рисков получили populated
  `counterPerspective.theirGain`; (c) при создании Deal Room из этого
  документа правая колонка показывает «Другая сторона» текст.
- Vercel preview deploy от branch'а — повторить smoke на real prod
  infrastructure (Anthropic API, Voyage, Neon) перед PR merge.

#### Empty-state fallback (старые анализы)

В `src/app/deal/[token]/clause-card.tsx`, внутри `<aside>` после блока
`{clause.theirSide && ...}` добавить:

```tsx
{!clause.theirSide && (
  <p className="italic text-[12px] leading-[1.5] text-ink-quiet/70">
    Counter-AI не сформирован для этого договора. Запустите повторный
    анализ, чтобы получить позицию другой стороны.
  </p>
)}
```

Не делаем CTA-кнопку «Перезапустить анализ» — это invariants Sprint 15
deal-reuse-from-reanalyzed-doc (как переносить existing actions на
новые clauses). Текстового объяснения достаточно.

### S3 — Deal Room UX upgrades

#### Optimistic UI (`src/app/deal/[token]/deal-room.tsx`)

- Вынести `reconcileClauseStatus` из `src/lib/deals.ts` в client-safe
  модуль `src/lib/deal-status.ts` (одна pure-функция, нулевые import'ы
  Prisma). Перепривязать `src/lib/deals.ts` к новому модулю.
- В `onAction`:
  1. Snapshot `deal.clauses` до мутации.
  2. Append synthetic `ClauseAction` локально (id = `optimistic-<uuid>`,
     createdAt = now, participant = `myParticipantId`).
  3. Пересчитать `clause.status` через `reconcileClauseStatus`.
  4. POST в фоне.
  5. На success → `fetchDeal()` для канонизации.
  6. На failure → restore snapshot, setError.

#### Perspective chip в title-page header (`deal-room.tsx:122-164`)

Под существующим eyebrow `Переговоры по договору` добавить inline-
chip строку:

```tsx
<p className="mt-2 inline-flex items-center gap-2 text-[10px] uppercase
              tracking-[0.18em] text-primary">
  <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
  {chipLabel}
</p>
```

Где `chipLabel`:
- `myRole === "SENDER"` → `Вы — отправитель`
- `myRole === "RECEIVER" && me.guestName` → `Открыто как ${guestName}
  (получатель)`
- `myRole === "RECEIVER" && !me.guestName` → `Открыто как гость`
- `myRole === null` (нет identity) → не показывать

Цвет dot'а: terracotta (`bg-primary`) для sender, sage (`bg-accent`)
для receiver — coherent с editorial accent system.

#### Loading skeleton (`deal-room.tsx:98-107`)

Заменить bare spinner на 3 skeleton clauses:

```tsx
<main className="paper-grain mx-auto max-w-5xl px-5 pt-8 sm:px-10">
  <header className="border-b border-rule pb-8 mb-12">
    <SkeletonLine className="h-3 w-32" />
    <SkeletonLine className="mt-3 h-8 w-3/4" />
  </header>
  <div className="space-y-10">
    {[0, 1, 2].map((i) => (
      <ClauseSkeleton key={i} />
    ))}
  </div>
</main>
```

`ClauseSkeleton` — границы `border-l-2 border-l-rule pl-5 sm:pl-7`,
три skeleton lines для текста + два для aside. Использует существующий
shimmer-sweep `<Skeleton>` (`src/components/skeleton.tsx`).

#### Specific error states (`deal-room.tsx:88-97`)

Расширить error-state до структуры `{ code, title, body, actions[] }`.
Map HTTP status → message:

- 404: `{ title: "Ссылка устарела или удалена", body: "Свяжитесь с
  отправителем — он перевыпустит приглашение.", actions: [] }`
- 410: same as 404 (Sprint 15 introduces EXPIRED status)
- 429: `{ title: "Слишком много действий подряд", body: "Подождите
  минуту и попробуйте снова.", actions: [{ label: "Обновить",
  onClick: reload }] }`
- 500 / other: `{ title: "Не удалось открыть", body: "Попробуйте
  обновить страницу.", actions: [{ label: "Обновить", onClick:
  reload }] }`

Render — editorial: serif h2, ink-quiet body, ghost-button actions.

#### Misclick guard (`clause-card.tsx:155-178`)

Кнопки AGREE/DISAGREE: `disabled={lastVote === kind}`,
`aria-pressed={lastVote === kind}`. Disabled-state visual: `opacity-60
cursor-default` без hover. Pressed-state остаётся `variant: "primary"`,
unpressed остаётся `variant: "ghost"`.

### S4 — Dashboard receiver indicator

#### `lastSeenAt` formatting (`src/app/dashboard/page.tsx:313-317`)

API `/api/deals` GET уже возвращает `receiver.lastSeenAt` (см.
`src/app/api/deals/route.ts:145`). `date-fns` не в зависимостях, и
добавлять его ради одной строки нерационально — `src/app/dashboard/
page.tsx:59-68` уже содержит локальный `relativeTime(date)` helper
с правильной русской морфологией («мин назад» / «ч назад» / «Вчера» /
«дн назад» / fallback на `toLocaleDateString`). Reuse его in-place;
если в S3-S4 окажется что helper нужен и в Deal Room — вынести в
`src/lib/format.ts` как побочный микрорефакторинг.

Sub-line generation:

```ts
function receiverLine(receiver: ActiveDealItem["receiver"]): string {
  if (!receiver?.lastSeenAt) return "Ссылка ещё не открыта";
  const name = receiver.guestName ?? "гость";
  return `${name} · открыто ${relativeTime(receiver.lastSeenAt)}`;
}
```

#### Sentinel dot

Слева от строки маленький dot, цвет по состоянию:
- `lastSeenAt === null` → `bg-primary` (terracotta — «не открыто, ждёт
  внимания»)
- `lastSeenAt < 24h` → `bg-success` (sage — «активный диалог»)
- `lastSeenAt ≥ 24h` → `bg-foreground/30` (нейтральный — «открывали,
  ничего не происходит»)

Размер 6px, `mt-2.5` чтобы align с baseline title.

## Acceptance criteria

1. **Editorial consistency**: `<SendAsDeal>` modal, dashboard Active
   deals list, Deal Room — единый словарь токенов. Никаких
   `border-border`, `bg-card-hover`, `text-muted`, `ring-primary/20`
   на пути Sprint 14 (grep across `src/components/send-as-deal.tsx`,
   `src/app/dashboard/page.tsx` Active Deals section).
2. **Counter-AI работает в production**: после deploy с восстановленным
   prompt'ом, ручной smoke на 3 разных договорах показывает populated
   `counterPerspective.theirGain` хотя бы у 50% рисков. Analyze не
   падает (Vercel logs чисты от zod-errors).
3. **Empty-state fallback виден**: создан Deal из document
   проанализированного ДО S2 deploy → правая колонка показывает
   ink-quiet italic строку про повторный анализ, не пустоту.
4. **Optimistic UI**: visual feedback на agree/disagree < 100ms (можно
   замерить в DevTools Performance). На rollback (mocked 500) state
   восстанавливается, error toast/строка появляется.
5. **Perspective chip**: открыть deal как owner (залогинен) — видно
   `Вы — отправитель`. Открыть тот же deal в incognito → identify →
   видно `Открыто как Илья (получатель)`. До identify — `Открыто как
   гость`.
6. **Loading skeleton**: medium throttle на DevTools Network, refresh
   `/deal/[token]` — видна editorial-skeleton, не bare spinner.
7. **Error states**: запрос на `/deal/[fake-but-valid-format-token]`
   → 404 message «Ссылка устарела или удалена», не generic. Rate-limit
   test — 429 с правильным сообщением.
8. **Misclick guard**: кликнул AGREE → AGREED. Повторный клик AGREE
   ничего не делает (button disabled, network не вызван).
9. **Dashboard sentinel**: создал deal но не открыл → terracotta dot
   + «Ссылка ещё не открыта». Открыл в incognito → sage dot + «гость
   · открыто 1 минуту назад».
10. **«Sprint 14» не виден пользователю**: grep `/Sprint 14/` по
    `src/app/page.tsx` и `src/app/dashboard/page.tsx` пусто.
11. **«Аудит-трейл» bullet удалён** с landing (`src/app/page.tsx`).
12. **Static gates**: `npx tsc --noEmit && npm test && npx next build`
    — все зелёные. Тесты не убавляются (минимум 417).

## Риски

- **Counter-AI prompt снова сломает analyze.** Mitigation: inline-
  формулировка без top-level JSON-примера (foot-gun #51), позитивный
  тест в analyze-schema.test, локальный smoke + preview deploy smoke
  перед merge в main. План отката: если prod analyze падает,
  немедленный revert одного коммита (prompt change изолирован) — не
  откатывать остальные UI-изменения.
- **Optimistic UI рассинхронизируется** с server state при сетевых
  гонках (два action'а одновременно). Mitigation: на каждый успешный
  POST идёт `fetchDeal()` который канонизирует — divergence
  schedule-bound к network latency, не permanent.
- **`receiver.lastSeenAt`** обновляется на каждый GET token endpoint
  (`src/app/api/deals/by-token/[token]/route.ts`). На длинной сессии
  receiver'а это write-on-read pattern — Neon-friendly, но если
  receiver держит вкладку открытой часами, мы пишем lastSeenAt раз в
  10-15s (если react-query или intervalpolling). Sprint 14 fetchDeal
  только в useEffect mount + после действий — write rate низкий.
  Mitigation: не добавлять polling в S3.
- **Misclick guard может сбить UX**: если user сменил мнение, AGREE
  → DISAGREE → AGREE невозможно (третий клик disabled). Mitigation:
  guard ловит только повторный клик ТОГО ЖЕ голоса. AGREE→DISAGREE
  работает, DISAGREE→AGREE работает, AGREE→AGREE — no-op. UX
  стандартный для toggle/radio групп.
- **Skeleton clauses могут «прыгать»** когда реальные данные приходят
  (clauses разной высоты). Mitigation: skeleton min-height ~120px на
  clause, real content почти всегда выше → перепрыгивание происходит
  ВНУТРИ клозура (text-areas), не layout shift body.

## Sequencing

Когда напишем implementation plan (writing-plans skill), порядок будет:

1. **S2 — Counter-AI prompt restoration** (один коммит, изолированный
   изменение в `prompts.ts` + новый тест). Сразу в начале — позволяет
   убедиться что не сломали prod до того как UI-изменения накладываются.
2. **S2 fallback в clause-card.tsx** (микроправка).
3. **S1.1 — SendAsDeal modal rewrite** (один коммит).
4. **S1.2 + S4 — Dashboard Active deals editorial + lastSeenAt**
   (один коммит, общая область).
5. **S1.3 — Sprint 14 leaks + Аудит-трейл bullet** (микроправка, в
   тот же коммит что 4 или отдельно).
6. **S3.1 — reconcileClauseStatus вынос + optimistic UI** (один
   коммит, требует осторожности с client/server split).
7. **S3.2 — perspective chip** (микроправка).
8. **S3.3 — loading skeleton** (один коммит, новый компонент
   `ClauseSkeleton`).
9. **S3.4 — error states map** (один коммит).
10. **S3.5 — misclick guard** (микроправка, в тот же коммит что 9).
11. **Verification** (`superpowers:verification-before-completion`)
    + manual smoke на (a) editorial visual consistency, (b) Counter-AI
    populated на новом анализе, (c) sender/receiver flow end-to-end.
12. **PR description update** на `claude/sprint-8-ui-polish` —
    добавить changelog «Sprint 14 design completion».

---

**Когда читаешь это в новой сессии после restart**: spec уже approved,
переходи к `superpowers:writing-plans` чтобы развернуть sequencing в
полноценный implementation plan.

# Sprint 14 — Deal Room MVP

**Дата**: 2026-05-23
**Статус**: design approved, ready for implementation plan
**Ветка**: будет ответвлена от `claude/sprint-8-ui-polish` после merge PR #7

## Контекст

Sprint 13 завершён («тёплый минимализм»). Sprint 12 был эффективно re-skin
(палитра + шрифт + кнопки) + платформенная оболочка. После Sprint 12
пользователь сказал «дашборд тот же, изменился только шрифт» — отсюда
Sprint 13. После Sprint 13 встаёт более фундаментальный вопрос:
**Яксо не имеет moat'а**. CLAUDE.md прямо констатирует «moat: 0».

Sprint 14 решает позиционирование, а не косметику. Это первый из трёх
sprint'ов под единую идею: продукт меняется с «AI читает договор» на
**«переговорная для договоров»** между двумя сторонами.

## Product thesis

> **Яксо — это переговорная для договоров. Получаете договор → AI занимает
> вашу сторону → договариваетесь со второй стороной в одной комнате →
> подписываете.**

Ось продукта = **Deal Room** = живое пространство договора между двумя
сторонами, с AI в роли советника каждой стороны отдельно.

### Стратегическое позиционирование (закреплено)

- **Hero** = Network (network effects = единственный defensible moat,
  который можно построить в одиночку за 6 недель)
- **Supporting** = Speed (время от «получил договор» до «есть позиция» <
  90 секунд)
- **Deferred**: Compliance + Глубина (после PMF)

### Первичный entry — Receiver-first

Юзер впервые попадает в продукт **как получатель** договора, через
ссылку из email. Каждый отправленный договор = новый юзер в воронке
(бесплатный CAC). Получатель → отправитель конвертируется органически
(он же будет дальше получать и слать договоры).

Sender-ICP (юристы, агенты, B2B-sales) платит. Receiver бесплатно.
Revenue inversion vs. текущая модель.

## Magic moment — Deal Room

Сцена, ради которой строим продукт:

1. Илья получает в почте: *«ООО Альфа хочет согласовать с вами договор
   поставки. Открыть в Яксо →»*
2. Кликает — попадает в Deal Room без логина. Видит:
   - Документ слева, AI-разбор «с вашей стороны» справа
   - Counter-AI: «вам выгодно X, им выгодно Y, компромисс Z»
   - Кнопки agree / disagree / comment на каждом пункте
3. Илья отмечает 5 пунктов как «согласен», на одном пишет «давайте 0.1%
   штрафа вместо 0.5%»
4. ООО Альфа (sender) на refresh видит обновления, отвечает «ок» — пункт
   зелёный
5. Когда все пункты зелёные → статус Deal Room меняется → DOCX готов к
   выгрузке (audit-trail добавляется в Sprint 16)

«Wow» за 90 секунд без регистрации, без обучения, без интерпретации.

## Архитектура Sprint 14

### Слой данных (Prisma)

**Новые модели**:

```
Deal
  id              cuid (PK)
  ownerId         User FK (sender)
  orgId           Organization FK (sender's workspace)
  documentId      Document FK (договор, который анализируется)
  title           String (display, по умолчанию = filename)
  status          DealStatus enum (ACTIVE | AGREED)
                  // Sprint 14 — только эти два состояния
                  // DECLINED / EXPIRED — Sprint 15 (требует UX для отказа + expire policy)
  inviteToken     String unique (192-bit hex для /deal/[token] URL)
  createdAt, updatedAt

DealParticipant
  id              cuid (PK)
  dealId          Deal FK (cascade)
  role            ParticipantRole enum (SENDER | RECEIVER)
  userId          User FK nullable (если зашёл с login'ом)
  guestName       String nullable (имя, введённое анонимно)
  guestEmail      String nullable (email из invite или ввода)
  sessionId       String nullable (cookie для no-login identity)
  joinedAt, lastSeenAt
  // Sprint 14: ровно один SENDER + ровно один RECEIVER на Deal.
  // Multi-party (>1 RECEIVER) — Sprint 17+, требует переработки Counter-AI и UI.

DealClause
  id              cuid (PK)
  dealId          Deal FK (cascade)
  ord             Int (порядок в документе)
  text            String (текст пункта из договора)
  riskLevel       String (low | medium | critical | none, mirrors analyze schema)
  yourSide        Json (риски для sender'а из существующего AI разбора)
  theirSide       Json (Counter-AI inference: что получает другая сторона)
  compromise      String nullable (AI-предложенная формулировка компромисса)
  status          ClauseStatus enum (PENDING | AGREED | DISPUTED | RESOLVED)

ClauseAction
  id              cuid (PK)
  clauseId        DealClause FK (cascade)
  participantId   DealParticipant FK
  kind            ActionKind enum (AGREE | DISAGREE | COMMENT | PROPOSE_EDIT)
  body            String nullable (для COMMENT и PROPOSE_EDIT)
  createdAt
```

**Маппинг с существующими моделями** (НЕ удаляем в Sprint 14, маппинг в
Sprint 15):

- `DocumentShare` → концептуально предшественник `Deal`. Оставляем как
  есть, новый Deal flow параллельный.
- `ShareComment` → предшественник `ClauseAction(kind=COMMENT)`.
  Оставляем как есть.
- `Conversation` / `DirectMessage` → НЕ затрагивает Deal Room в Sprint
  14 (Deal Room не имеет встроенного чата помимо comment'ов на clauses
  — это сознательно для focus).

**Foot-guns**:
- `inviteToken` — 192-bit (как существующий `/r/[token]` foot-gun #40),
  `force-dynamic`, `robots: noindex`. Добавить `/deal/` в `robots.txt`
  Disallow.
- `sessionId` для anonymous receivers — `httpOnly` cookie, scope =
  `/deal/`, expires 90 days.
- Уникальность `inviteToken` — в коде через retry-loop как с
  `referralCode` (foot-gun #38), не DB-constraint.

### Слой AI

Расширение существующей `analyze.ts` schema:

```ts
// src/lib/ai/schemas/analyze.ts
risks: z.array(z.object({
  // existing fields:
  category, severity, title, description, originalText,
  recommendedText, consequence,
  // NEW:
  counterPerspective: z.object({
    theirGain: z.string(),       // что выигрывает другая сторона
    compromise: z.string().optional(), // AI-предложенный компромисс
  }).optional(),  // .optional для бэк-совместимости с существующими analyses
})),
```

Counter-AI = **one-sided inference** в Sprint 14 (foot-gun: НЕ требует
участия second party — symmetric collaboration возможна в Sprint 17+).
Sender'у показывается «их позиция» как симуляция. Когда receiver
реально заполняет свои предпочтения — replaces simulation, но это
Sprint 17+ работа.

Prompt update в `src/lib/ai/prompts/analyze.ts`:
- Добавить инструкцию «для каждого риска коротко опиши, что от этого
  пункта получает другая сторона; если есть очевидный компромиссный
  вариант — предложи его в одной строке».
- Ограничение токенов: counterPerspective += ~50 токенов per-risk × ~10
  risks = ~500 токенов на ответ. Existing analyze budget = 8192,
  останется ~7600 для основного контента. OK.

Existing analyses без counterPerspective работают (zod `.optional()`),
UI показывает плашку «Counter-AI недоступен для этого анализа» — это
ок.

### Слой API (новые роуты)

```
POST /api/deals
  Body: { documentId, counterpartyEmail, counterpartyName?, message? }
  Returns: { dealId, inviteToken }
  Auth: workspace membership
  Effects:
    - создаёт Deal со status=ACTIVE и DealClause[] из existing analyze
    - upserts UserProfile для counterparty email (для tracking возврата)
    - sends invite email через Resend
    - rate-limit: 'deals.create' (10/мин)

GET /api/deals
  Returns: { deals: [...] }  // мои deals (sender перспектива)
  Filter: ?status=...
  Auth: workspace membership

GET /api/deals/:id
  Returns: full Deal + clauses + actions + participants
  Auth: workspace membership (sender)

GET /api/deals/by-token/:token
  Returns: full Deal + clauses + actions + participants
  Auth: НЕТ — это публичный endpoint для receiver'а
  Effects: при первом обращении создаёт DealParticipant(RECEIVER) с
    sessionId, при повторных — обновляет lastSeenAt

POST /api/deals/by-token/:token/identify
  Body: { name, email? }
  Returns: updated participant
  Auth: НЕТ, по sessionId
  Effects: заполняет guestName/guestEmail на existing participant

POST /api/deals/by-token/:token/clauses/:clauseId/actions
  Body: { kind: 'AGREE'|'DISAGREE'|'COMMENT'|'PROPOSE_EDIT', body? }
  Returns: ClauseAction + updated clause status
  Auth: НЕТ, по sessionId
  Effects:
    - создаёт ClauseAction
    - пересчитывает DealClause.status (AGREED если оба participants
      сделали AGREE, DISPUTED если конфликт)
    - rate-limit: 'deals.action' (60/мин per session)

POST /api/deals/:id/clauses/:clauseId/actions
  Same body, but sender perspective (через workspace auth)
```

**Rate limits**: новые keys `deals.create`, `deals.action`.

### Слой UI

**Новая страница**: `app/deal/[token]/page.tsx`

Layout двухколоночный, без AppShell (это публичная страница, foot-gun
#44):

```
┌─────────────────────────────────────────────────────────────────┐
│ Logo  •  Договор поставки № 47        Илья ↔ ООО Альфа          │
├─────────────────────────────────────────────────────────────────┤
│  ДОКУМЕНТ                       │  COUNTER-AI                   │
│                                 │                               │
│  1.1 Предмет договора           │  pending                      │
│      [текст пункта]             │  Ваш риск: нет                │
│                                 │  [✓ согласен] [💬 комментарий]│
│                                 │                               │
│  1.2 Срок поставки              │  ⚠ DISPUTED                   │
│      [текст пункта]             │  Ваш риск: жёсткий штраф 0.5% │
│      [⚠ риск]                   │  Их выгода: регулярный приток │
│                                 │  Компромисс: 0.1%, потолок 5% │
│                                 │  [✓ согласен] [✗ не согласен] │
│                                 │  💬 «давайте 0.1%» — гость    │
│                                 │                               │
├─────────────────────────────────────────────────────────────────┤
│ 5/12 согласовано  •  3 на обсуждении  •  4 не тронуты           │
└─────────────────────────────────────────────────────────────────┘
```

Components:
- `<DealRoom>` — главный двухпанельный layout
- `<DealClauseCard>` — отдельный пункт с двумя perspectives
- `<ClauseActionButtons>` — agree/disagree/comment кнопки
- `<DealStatusBar>` — счётчик внизу (НЕ полноценный timeline, тот в Sprint 15)
- `<IdentifyModal>` — модалка «представьтесь» при первом действии

Identity tracking: при первом GET по `/api/deals/by-token/:token`
создаётся session cookie + DealParticipant с пустым именем. При
первом действии (agree / comment / etc.) показывается
`<IdentifyModal>` с одним полем «Ваше имя» — без email в Sprint 14.

**Изменения в существующих экранах**:

- `app/dashboard/page.tsx` — добавить секцию «Активные deals» сверху
  списка документов (НЕ заменять дашборд — это Sprint 15)
- `app/analyze/page.tsx` — после успешного анализа добавить кнопку
  «Отправить второй стороне» рядом с «Скачать DOCX»; ведёт в модалку
  создания Deal
- `app/(app)/generated/[id]/page.tsx` — если документ есть, тоже кнопка
  «Создать Deal» (для шаблонов)

**Что НЕ меняется**:
- Sidebar (это Sprint 15)
- Главный лендинг (Sprint 16)
- Pricing (Sprint 16)
- Email-capture phase 2 (Sprint 16)
- Realtime presence (Sprint 15)

### Слой email

Новый шаблон `src/lib/email/templates/deal-invite.ts`:

```
Тема: «<Имя отправителя> отправил вам договор для согласования»

Здравствуйте.

<Имя отправителя> (<Организация>) хочет согласовать с вами договор
«<Название>».

[Открыть в Яксо →]   ← кнопка

Что это значит:
• AI разберёт договор за вас и покажет, что внутри
• Можно отметить, с чем согласны и что хочется поменять
• Логин не требуется
```

Использует `renderEmailHtml` helper, palette из Sprint 13. Trigger в
`POST /api/deals` после успешного создания Deal.

## Тестовое покрытие

Unit tests:
- `Deal` creation flow (с проверкой clauses materialization из existing analyze)
- `DealClause.status` reconciliation logic (когда AGREED, когда
  DISPUTED, когда RESOLVED)
- `inviteToken` uniqueness retry loop (как `referralCode` test pattern)
- Counter-AI schema parses когда `counterPerspective` отсутствует
  (бэк-compat)
- Anonymous receiver session cookie lifecycle

Integration tests (если уже есть pattern в репо для API роутов):
- POST /api/deals → ожидает Deal + email sent через Noop provider
- GET /api/deals/by-token/:token → создаёт participant при первом
  hit, не создаёт при втором
- POST .../actions → меняет clause status корректно

E2E НЕ требуется в Sprint 14 (Playwright не настроен — это в DX
roadmap).

Цель — пройти 389 существующих тестов + добавить ~15-20 новых.

## Что НЕ входит в Sprint 14 (explicit out-of-scope)

- Realtime presence / live cursors → Sprint 15
- Status timeline (визуальная полоса состояний) → Sprint 15
- Sidebar reorg (6→3 пункта) → Sprint 15
- Inbox-style dashboard → Sprint 15
- Новый лендинг под Deal Room thesis → Sprint 16
- Новый pricing (Receiver / Solo / Pro / Business) → Sprint 16
- Email-capture phase 2 (hybrid receiver entry) → Sprint 16
- Audit trail для финальной подписи → Sprint 16
- ЭЦП интеграция → за пределами 9-week roadmap
- Real two-sided Counter-AI → Sprint 17+
- Templates marketplace → отложено

## Что дропается из проекта в долгосрочной перспективе

(Не в Sprint 14, фиксирую как принятое направление)

- `/network` catalog + connections + DocumentShare UI — backend
  фундамент для Deals, но текущая UX-сеть архивируется в Sprint 15
- `/dashboard` в текущем виде — заменяется Deal Rooms inbox в Sprint 15
- `/analyze` отдельной страницей — Sprint 15 интегрирует «New Deal»
  как первичный flow, `/analyze` остаётся как «загрузить чтобы
  посмотреть без отправки»
- `/sample-report` — Sprint 16 заменяет на `/sample-deal`
- `/counterparty`, `/chat`, `/bulk`, `/deadlines`, `/compare-contracts`
  → Sprint 15 в Tools collapse, остаются доступны но не первичны

## Риски и unknowns

- **Counter-AI качество**: AI-симуляция «другой стороны» может быть
  слабой при асимметричных договорах (трудовой, с физлицом). Mitigation:
  если AI не может сгенерить compromise — поле `optional`, UI
  показывает только yourSide+theirSide.
- **Token cost**: counterPerspective добавляет ~500 токенов на ответ,
  ~$0.02 per analyze на Sonnet. Hit Haiku FREE → ~$0.003 per. OK.
- **Email deliverability**: Resend без подтверждённого домена сейчас
  работает в sandbox-режиме (foot-gun: deal-invite не уйдёт реальным
  получателям до Resend domain verify). Это блокер запуска, не
  Sprint 14.
- **Migration safety**: четыре новые таблицы + один nullable field в
  `analyze` schema (через JSON). `prisma db push` без `--accept-data-loss`
  должен пройти. Foot-gun #2 — для nullable unique constraint на
  `inviteToken` через @@index, не @unique.
- **Anonymous identity юр.значение**: действия гостей фиксируются с
  оговоркой «гость» и не имеют полной юр.силы. Финальная подпись
  (Sprint 16+) потребует identified-юзеров или ЭЦП.
- **Anti-abuse на anonymous endpoints**: 192-bit inviteToken не
  угадывается, основной вектор — перехват реальной ссылки. Mitigation
  в Sprint 14: rate-limit `deals.action` (60/мин per session) +
  `deals.create` (10/мин per workspace). Эскалация (CAPTCHA, IP-based
  throttle) — если будет реальный abuse после launch.
- **Существующие documents без analyze**: при создании Deal из
  документа, который ещё не был проанализирован — нужно запустить
  analyze перед тем, как материализовать DealClauses. Опция: блокирующий
  call (медленно) или background job (требует infra). Sprint 14:
  блокирующий call с 60-sec spinner. Если плохо — Sprint 15
  background.

## Acceptance criteria

Sprint 14 считается завершённым когда:

1. Я могу залогиниться → загрузить .docx → дождаться анализа → нажать
   «Отправить второй стороне» → ввести email → отправить.
2. На указанный email уходит письмо со ссылкой `/deal/<token>`.
3. Я открываю эту ссылку в incognito → вижу Deal Room без логина с
   реальным двухколоночным layout, Counter-AI работает по каждому
   пункту.
4. Я могу нажать «Согласен» / «Не согласен» / оставить комментарий на
   любом clause.
5. Я возвращаюсь в свою sender-сессию → вижу обновления (после
   ручного refresh, не realtime).
6. Если оба участника нажали «Согласен» на пункт → status = AGREED
   (зелёный).
7. 389 существующих тестов проходят + ~15-20 новых тестов на Deal flow.
8. `tsc --noEmit`, `npm test`, `npx next build` — зелёные.

## Sequencing — порядок реализации внутри Sprint 14

Когда напишем implementation plan (writing-plans skill), порядок шагов
будет такой:

1. Prisma schema + db push (4 новые модели + поле в analyze schema)
2. Counter-AI: расширение `analyze.ts` zod schema + prompt update +
   тест что existing analyses не ломаются
3. Backend: 5 новых API роутов + rate limits + audit log actions
4. Frontend: страница `/deal/[token]` + components + identity flow
5. Email template + send hook в POST /api/deals
6. Изменения в существующих экранах (dashboard секция + analyze
   кнопка)
7. Тесты
8. Verification (verification-before-completion skill) перед PR

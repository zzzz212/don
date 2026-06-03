# Яксо — план улучшения платформы (2026-06-03)

> Подготовлено многоагентной оркестрацией: 5 ридеров параллельно картировали реальный код по подсистемам (AI-ядро/durable analyze, Deal Room, рост, монетизация/retention, платформа) → 8 идеаторов с разными линзами → дедуп 55→28 идей → состязательный скоринг каждой против настоящего кода и foot-guns → синтез (Opus). Все ссылки на файлы/строки проверены ридерами против репозитория.

## TL;DR

- **Самый большой рычаг — не новая фича, а закрытие петли.** Весь network-first pivot держится на тезисе «получатель → отправитель», но в коде эта петля имеет **ноль точек замыкания**: на живой `/deal/[token]` нет ни одной конверсионной CTA (единственный `yakso.ru`-стринг живёт в `opengraph-image.tsx`, который никогда не рендерится на странице). Контрагент разбирает реальный договор по пунктам на пике интента — и уходит. Это `DR-1`, эффорт S, и это #1 утечка во всём репозитории.
- **Главная стратегическая ставка — Deal Room как настоящая переговорная, а не «отчёт с кнопками».** Сегодня три вещи делают «переговорную» фикцией: Counter-AI — односторонняя галлюцинация (`DR-4`), ход «Компромисс» постит `PROPOSE_EDIT`, который `reconcileClauseStatus` игнорирует — то есть AI-движок не умеет урегулировать спор на новом тексте (`DR-3`), и комната не показывает действия второй стороны без ручного reload (`DR-8`). Связка DR-3 + DR-4 + DR-8 превращает продукт в то, чем он себя продаёт.
- **Ничего из этого не приносит ни рубля, пока не сняты launch-блокеры.** YooKassa `shop_id` не выставлен (checkout → 503), `yakso.ru` не подключён к Vercel (все ссылки/OG/письма → 404), Resend не верифицирован, `GEMINI_API_KEY` пуст (analyze падает на длинных договорах при флапе Anthropic). **Любая growth- или монетизация-фича сегодня отгружается «вхолостую».** Это не код — это 4 действия фаундера, и они идут первыми.
- **Монетизация требует не новых тарифов, а recurring cash и нового value-metric.** `MON-3`: нет `/api/billing/cancel` и нет авто-продления — MRR в `/admin` это снимок, а не повторяющийся доход (после `currentPeriodEnd` план не даунгрейдится никогда). `MON-1`: создание Deal-комнат вообще не метрится, хотя это и есть core-действие пивота.
- **Единственный некопируемый moat — данные.** Market-norm benchmarking (`AI-1`) на уже хранимом pgvector-корпусе — то место, где Kontur/Garant (нормы без AI) и ChatGPT (AI без RU-корпуса) расходятся. Но это пост-PMF ставка: корпус сегодня пуст и грубый (whole-doc блобы, не клаузы), а перцентили на n<20 — это trust-damage класса КАД-заглушки. Заложить схему дёшево, рендерить перцентили — только за hard-N-гейтом.
- **AI-гигиена дешева и обязательна:** receiver suggest-moves не проверяет FREE-cap владельца (`DR-6`, unmetered Anthropic spend против `deal.ownerId`), а apply-fix молча отваливается на парафразе без телеметрии (`AI-7`). Оба — копии уже существующей логики.

---

## Стратегический тезис

Moat Яксо — **не AI-качество анализа** (его за квартал догонит любая команда на хорошем промпте) и **не нормативная база** (она есть у Контур/Гарант). Moat — это **share-native переговорная комната как сетевой артефакт**: каждый отправленный Deal Room вносит в орбиту Яксо тёплого, интент-пикового контрагента, которого конкуренты структурно не могут перехватить (у Kontur/Garant нет переговорной вовсе; ChatGPT не share-native под RU). Ставка, которая строит ров: **сделать Deal Room настоящей двусторонней переговорной (реальный ввод позиции получателя → симметричный rebalance → counter-propose loop, который реально урегулирует спор на новом тексте → доказательный артефакт при AGREED) и замкнуть петлю «получатель→отправитель»**, затем — поверх растущего корпуса — построить market-norm benchmarking, единственную фичу с настоящим data-flywheel. Чего **НЕ** догонять: мульти-провайдерную «AI читает договор» гонку качества (это уравнивающая table-stakes), мульти-party переговоры (schema `@@unique([dealId, role])` жёстко двусторонняя, отложено до «Sprint 17+»), per-document микро-платежи (`MON-4`: маржинально-отрицательны на 54-ФЗ чеках, хуже trial-нуджа), и magic-link receiver identity как growth-рычаг (`GR-4`: добавляет friction в core-действие, плагается на несуществующий re-marketing).

---

## Карта приоритетов

| id | название | тип | измерение | impact | effort | moat | вердикт |
|---|---|---|---|---|---|---|---|
| **GR-1** | Drop mandatory email → copy-link + Telegram share | улучшение | growth | 3 | S(1) | 1 | **strong** |
| **DR-6** | Receiver suggest-moves FREE-cap дыра (unmetered spend) | улучшение | deal-room | 2 | S(1) | 1 | **strong** |
| **DR-1** | Receiver→sender CTA «разберите свой договор» на пике интента | киллер | deal-room | 4 | S(1) | 2 | **strong** |
| **DR-2** | PostHog-инструментирование вирусной воронки | улучшение | deal-room | 3 | S(2) | 1 | rider к DR-1 |
| **AI-7** | Apply-fix телеметрия (без fuzzy-fallback) | улучшение | ai-analysis | 2 | S(1) | 1 | half-ship |
| **DR-3** | Counter-propose→accept loop: AI «Компромисс» реально RESOLVE | киллер | deal-room | 4 | M(2) | 2 | **strong** |
| **DR-8** | Lightweight presence + auto-refresh (polling-first) | улучшение | deal-room | 3 | M(2) | 1 | **strong** |
| **MON-3** | Self-serve cancel (сейчас) + auto-renew (после YooKassa) | киллер | monetization | 4 | L(3) | 1 | split |
| **DR-4** | True two-sided Counter-AI (rebalance) | киллер | deal-room | 4 | L(3) | 3 | после блокеров+DR-6 |
| **DR-7** | Deal lifecycle: DECLINED/EXPIRED + revoke | киллер | deal-room | 3 | M(2) | 2 | foundation для PLT-1 |
| **DR-5** | AGREED → итоговый DOCX + история согласования | киллер | deal-room | 3 | L(3) | 2 | после DR-3 |
| **MON-1** | Pay-per-Deal sender metering | киллер | monetization | 3 | M(2) | 1 | после DR-7+домен |
| **MON-2** | In-flow trial activation на 402 paywall | улучшение | monetization | 3 | S(1) | 1 | после YooKassa |
| **AI-6** | Proactive insight fusion (auto-deadline + панель действий) | улучшение | ai-analysis | 3 | M(2) | 1 | после logUsage-fix |
| **AI-1** | Market-norm benchmarking на pgvector-корпусе | киллер | ai-analysis | 4 | L(4) | 4 | пост-PMF moat |
| **PLT-1** | Inbox-дашборд «Ждут вас / Ждут их / Готово» | киллер | platform | 3 | L(3) | 1 | после DR-7 |
| **GR-3** | Программный SEO под WB/OZON нишу | киллер | growth | 3 | L(3) | 2 | после домена |

Не вошли как deprioritized/drop: `AI-2` (taxonomy — только как rider к AI-1), `AI-3` (взять confidence-половину, score-reweight отбросить), `AI-4` (cross-clause Opus — после первого BUSINESS-клиента), `AI-5` (eval-гейт — тонкая CI-половина с миграцией модели), `AI-8` (drop — лейблы уже есть), `GR-2` (referral — part a после трафика, part b заблокирован), `GR-4` (drop), `MON-4` (drop), `MON-5` (после MON-3), `RET-1` (после домена).

---

## Горизонт 0 — Quick wins (1-2 спринта)

Все эти задачи **отгружаются «вхолостую» до подключения домена** — но это ровно те изменения, которые делают продукт функциональным в день, когда фаундер подключит `yakso.ru`. Готовим их параллельно с launch-блокерами.

### GR-1 — Снять обязательный email при создании Deal: copy-link + Telegram/WhatsApp
- **Проблема.** `CreateSchema` в `src/app/api/deals/route.ts:16` жёстко требует `counterpartyEmail` через `z.string().email()` — а единственный канал доставки (Resend) сегодня не работает вообще. В RU B2B договорная переписка идёт в Telegram/WhatsApp, не в email. Красивый contract-title-page OG (`opengraph-image.tsx`) построен ровно под messenger-превью и простаивает.
- **Решение.** Сделать `counterpartyEmail` опциональным (колонка `guestEmail String?` уже nullable, `schema.prisma:987`; POST уже возвращает `{ url, inviteToken }`, lines 115-119). При отсутствии email — пропустить `buildDealInviteEmail`, показать share-sheet в `SendAsDeal` (`src/components/send-as-deal.tsx` уже имеет кнопку «Скопировать ссылку», lines 82-90; добавить `t.me/share/url?url=…&text=…` + WhatsApp). Ветвить success-копию (сейчас хардкодит «Письмо отправлено», lines 68-76).
- **Почему сейчас.** Email-инвайты non-functional в проде прямо сейчас — copy-link это **единственный работающий канал** в окне launch-блокеров, а не просто «приятнее».
- **Код.** `src/app/api/deals/route.ts` (валидация + условный audit), `src/components/send-as-deal.tsx` (share UI), `src/lib/deals.ts` (уже принимает null email).
- **Метрика успеха.** Доля сделок, созданных без email; share-method распределение (через DR-2).
- **Foot-guns.** Audit-лог на `route.ts:112` безусловно передаёт `email: counterpartyEmail` — сделать условным, иначе `email: undefined` в логе (foot-gun #26). Cookie path `/` (#49), by-token GET продолжает withhold `rawText`/`owner.email` (#50). **Виральность всё равно гейтится подключением домена** — ссылка `https://yakso.ru/deal/<token>` сегодня резолвится в 404; GR-1 убирает email-зависимость, но НЕ домен-зависимость.

### DR-6 — Закрыть unmetered-spend дыру в receiver suggest-moves
- **Проблема.** Receiver-роут `by-token/.../suggest-moves/route.ts` корректно атрибутирует spend на `deal.ownerId` (`logUsage`, foot-gun #60), но в отличие от sender-роута **НЕ проверяет FREE daily-cap владельца** перед `generate()` — только rate-limit 15/min (line 24). Плюс хардкодит `pickTier('chat', null)` (line 100) → всегда Haiku, игнорируя тариф PRO-владельца. `?force=1` амплифицирует каждым нажатием «Обновить». Невидимо в Sentry (4xx дропаются в `beforeSend`) — всплывёт только на счёте Anthropic.
- **Решение.** Перед `generate()`: загрузить план владельца через `getEffectiveUserPlan` (`src/lib/plans.ts:187`); если FREE → `aiUsage.count({ userId: ownerId, feature:'chat', createdAt gte 24h }) >= 10` → 402 («лимит AI-предложений исчерпан»). `?force=1` остаётся cache-bypass ONLY (#59). Передать реальный `effectivePlan` в `pickTier`. **Вынести cap-чек в общий хелпер** (`src/lib/ai/`), чтобы два роута не разъехались снова.
- **Почему сейчас.** Живой cost-correctness баг на продукте с 27% gross margin и слабым prod-фоллбэком (Gemini пуст). Чистая копия соседнего sender-блока (lines 80-107 + 127).
- **Код.** `src/app/api/deals/by-token/[token]/clauses/[clauseId]/suggest-moves/route.ts`, новый `src/lib/ai/free-cap.ts` (shared helper + unit-тест — единственный способ получить CI-гейт, т.к. vitest исключает `src/app`).
- **Метрика успеха.** 402-rate на receiver-роуте; отсутствие spend-spike против FREE-владельцев.
- **Foot-guns.** Tier-fix (передавать план владельца) **повышает** cost на PRO-сделках ($0.02→$0.15/call) — осознанное решение «качество», не freebie. Реальная экспозиция сегодня мала (Haiku, rate-limited, session-gated) — это **гигиена, не emergency**; не прыгать вперёд launch-блокеров. Ехать вместе со следующим Deal Room PR.

### DR-1 — Receiver→sender CTA на пике интента
- **Проблема.** Вся петля пивота не замкнута. На живом `src/app/deal/[token]/deal-room.tsx` — ноль конверсионных touchpoint'ов, единственный бренд-якорь это footer-колофон. Контрагент видит полный clause-by-clause разбор реального договора, голосует по каждому пункту, доходит до AGREED — и его интент молча выбрасывается.
- **Решение.** Editorial CTA-карточка (warm-minimalism), монтируемая **только для `myRole === 'RECEIVER'`** (флаг уже в state, `deal-room.tsx:72/93`) на пиках: после первого голоса и на AGREED-колофоне. Копия: «Понравилось, как Яксо разобрал этот договор? Загрузите СВОЙ — без логина, за 30 секунд». Ссылка на **`/sample-report` (value-first) или `/register`** — переиспользовать проверенный паттерн `/r/[token]` (`src/app/r/[token]/page.tsx:242-256`). Чистая навигация, без AI → обходит foot-gun #60.
- **Почему сейчас.** Получатель только что наблюдал препарирование реального договора — интент на абсолютном пике, продукт его сейчас теряет. Самый высокий leverage-to-effort в репозитории.
- **Код.** `src/app/deal/[token]/deal-room.tsx` (+ опц. `clause-card.tsx` для post-vote триггера). Schema/AI не трогаем.
- **Метрика успеха.** receiver→register конверсия (требует DR-2 для измерения).
- **Foot-guns.** **НЕ ссылаться на `/analyze`** — она за `<AppShell>`, `/api/analyze/start` отдаёт 401 анону → login-стена (`analyze/page.tsx:70`). `?ref=<owner.referralCode>` — косметика: by-token GET селектит только `owner:{name}` (route.ts:61), и `grantReferralReward` платит только на trial-активацию (мёртвый valve) — давать плоскую ссылку, ref оставить «на потом». **Ценность = $0 до подключения домена.** Тон editorial, не назойливый.

### DR-2 — PostHog-инструментирование вирусной воронки (rider к DR-1)
- **Проблема.** `grep` по `src/app/api/deals` на `captureEvent`/`posthog` → пусто. Создание сделки, открытие, identify, agree, AGREED — ноль событий. Воронку invite→open→engage→register нельзя увидеть, значит DR-1 и весь пивот отгружаются неизмеримо.
- **Решение.** Fire-and-forget `captureEvent` (`src/lib/analytics/server.ts`, lazy posthog-node, flushAt:1, никогда не throws, distinctId PII-free) на стыках: `deal_created` (с `clauseCount`), `deal_link_opened` (by-token claim), `receiver_identified`, `clause_agreed`/`clause_disputed`, `deal_agreed_complete`. **Добавить имена в закрытый TS-union `EventName`** (server.ts L65-97) — иначе `tsc` падает.
- **Почему сейчас.** Прекондишн честной оценки DR-1. Дешёво, безопасно.
- **Код.** `src/lib/analytics/server.ts` (union), `src/app/api/deals/route.ts`, by-token-роуты, action-роуты.
- **Метрика успеха.** Полная воронка с per-stage drop-off; виральный коэффициент K (числитель появляется только с DR-1).
- **Foot-guns.** Грузонесущая метрика (receiver→sender K) **недостижима в изоляции** — attribution-путь зависит от register-CTA из DR-1 и нового source-param через register. DistinctId для анона = `deal.ownerId`/`sessionId`, **никогда null+PII**. **Шиппить ВМЕСТЕ с DR-1, не раньше** — иначе инструментируешь воронку без трафика и без endpoint'а, получая ложное «петля мертва».

### AI-7 (половина) — Apply-fix телеметрия
- **Проблема.** `verifyRiskQuotes` чинит только пробелы; на парафразе `findVerbatimQuote` → null, кнопка «Применить» молча disabled, **без телеметрии** — headline-фича (patched DOCX) может тихо деградировать после любого промпт/модель-бампа, и Sentry это не покажет (4xx дропаются).
- **Решение.** Только телеметрия-половина: `captureEvent('analyze.applyfix_unavailable', { level, clauseTitle })` на null-ветке `findVerbatimQuote`. **Расширить `EventName` union.** `clauseType` недоступен (contractType — free-text) → использовать `level`/`clauseTitle`.
- **Почему сейчас.** Делает headline value-prop наблюдаемым, даёт будущему eval-харнессу prod-сигнал. 1 день.
- **Код.** `src/lib/ai/quote-verify.ts`, `src/lib/analytics/server.ts`.
- **Метрика успеха.** applyfix-unavailability rate в PostHog (тренд, не точное число).
- **Foot-guns.** **Fuzzy-fallback половину — НЕ делать сейчас.** Apply-fix это `text.split(originalText).join(...)` — **глобальный replace-all** (`report/[id]/page.tsx:107`); ложный или неуникальный fuzzy-якорь молча **портит каждое вхождение** в DOCX (ровно foot-gun #13). Если делать — за uniqueness/occurrence-гейтом, и это уже не S.

---

## Горизонт 1 — Средние ставки (1-2 месяца)

Здесь живут самые сильные улучшения существующих фич — они делают Deal Room тем, чем он себя продаёт. **Предполагается, что домен подключён** (иначе всё это полирует тёмную поверхность).

### DR-3 — Counter-propose → accept loop (сделать AI «Компромисс» реальным)
- **Что это.** Сегодня переговорный движок — структурный тупик. `reconcileClauseStatus` (`src/lib/deal-status.ts:24-37`) считает только последний `AGREE`/`DISAGREE` per participant; `PROPOSE_EDIT` и `COMMENT` отфильтрованы; `RESOLVED` (тип/лейбл/акцент уже отрисованы) **никогда не эмитится**. При этом headline-фича Sprint 15A `NegotiationMoves` вяжет ход B (Компромисс) на `PROPOSE_EDIT` с готовым `proposedText`, а ход C на `COMMENT` — **оба no-op для статуса**. DISPUTED-пункт может дойти до AGREED только если обе стороны согласятся на **исходную** формулировку. Самое AI-native действие продукта подключено в никуда.
- **Решение.** (1) Рендерить последний открытый `PROPOSE_EDIT` в `clause-card.tsx` как redline-карточку («Контрагент предлагает новую формулировку») с кнопкой «Принять формулировку» для **другой** стороны. (2) Новый `ClauseAction.kind = ACCEPT_PROPOSAL` (String, без enum-миграции) с `proposalId`. (3) Расширить `reconcileClauseStatus`: `PROPOSE_EDIT` + matching `ACCEPT_PROPOSAL` от контрагента → `RESOLVED`; снапшот принятого текста в новую nullable `DealClause.agreedText` (db-push safe). (4) Обновить promote/demote-запрос `deal.status` в **обоих** action-роутах, чтобы `RESOLVED` считался terminal-agreed наравне с `AGREED`.
- **Почему сейчас.** Генеративная половина (`MovesSchema` с `proposedText`) уже отгружена и сидит на мёртвом проводе. Прекондишн для DR-5 — нельзя экспортировать принятый текст, который никогда не захватывался. Это часть PR #9 (B-slice).
- **Код.** `src/lib/deal-status.ts`, `src/app/deal/[token]/clause-card.tsx`, оба `.../clauses/[clauseId]/actions/route.ts`, `prisma/schema.prisma` (`agreedText`, `ACCEPT_PROPOSAL`).
- **Foot-guns.** Promote/demote-запрос живёт в двух роутах — рассинхрон = `deal.status` desync. `RESOLVED` должен попасть в обе ветки. Schema additive nullable — безопасно под `db push`.

### DR-8 — Lightweight presence + auto-refresh (polling-first, без инфры)
- **Что это.** Deal Room — «двусторонняя комната» — **не имеет live-обновлений вообще**. `deal-room.tsx` фетчит на mount и рефетчит только после действия локального юзера; восстановление ошибки через `window.location.reload()` (~line 201). Действие получателя невидимо отправителю до ручного reload. (Замечание: «2.5s polling в Deal Room» в контексте неверно — это `ActiveAnalysesStrip`, другая подсистема.)
- **Решение.** Два дешёвых шага до Liveblocks/pubsub. (1) Отрисовать `lastSeenAt` как editorial presence-строку в шапке title-page («Контрагент смотрел 4 минуты назад» / sage online-dot при <60s) — **добавив `lastSeenAt` в ответ by-token GET** (колонка есть, но в payload `route.ts:113-129` не отдаётся). (2) Tab-visibility-gated рефетч (~4-5s, паттерн `ActiveAnalysesStrip`), диффящий by-token GET в state, **реконсилящий против optimistic-state по префиксу `optimistic-`** (id уже различимы от server cuid) — заменяет `window.location.reload()` костыль.
- **Почему сейчас.** Vercel serverless не держит websocket'ы → real push это большая ставка. `lastSeenAt` уже пишется, polling-идиома проверена. Превращает статичную страницу в видимо-живую за near-zero cost и де-рискует push-инвестицию.
- **Код.** `src/app/deal/[token]/deal-room.tsx`, `src/app/api/deals/by-token/[token]/route.ts` (одно поле в payload + интерфейс).
- **Foot-guns.** Optimistic-vs-poll реконсиляция — единственное место багов (диффить по `optimistic-` префиксу, не blind-replace). **Обязательно visibility-gating** (deep include на каждый тик — затратно при многих idle-табах); паузить при `status===AGREED`. Presence через `lastSeenAt` — мягкий лаговый сигнал (не heartbeat), «онлайн <60s» приблизителен. Zero incremental AI cost — единственное Deal Room улучшение, не трогающее 27% маржу. **Парить с DR-2**, иначе влияние на same-session resolution неизмеримо.

### MON-3 (split) — Self-serve cancel (сейчас) + auto-renew (после YooKassa)
- **Что это.** Нет `/api/billing/cancel` и нет recurring-charge. `savePaymentMethod`-плумбинг есть, `Subscription.providerPaymentMethodId` хранится, но читается только как boolean. После `currentPeriodEnd` оплаченный `User.plan` живёт вечно (ничто не даунгрейдит). `/admin` MRR — снимок active-subs, не повторяющийся cash. Платящий юзер **не может сам отменить** — а оферта (`offer/page.tsx:211-214,247-248`) уже обещает «отключить автопродление в любой момент» → живой compliance-долг 152-ФЗ.
- **Решение — split.** **Сейчас (дёшево, ~0.5-1 день):** `POST /api/billing/cancel` (OWNER-only, ставит `Subscription.cancelAtPeriodEnd` — колонка есть, `/api/billing/status` уже её селектит) + UI-тоггл на `/billing` + expiry-шаг даунгрейда `User.plan→FREE` (dual-write User+Org, foot-gun #11). **После активации YooKassa:** новый метод на `YookassaClient` для charge сохранённого `payment_method_id` (отдельная форма запроса, `capture:true`, без confirmation-блока — `createPayment` сегодня умеет только interactive flow), daily renewal-cron (паттерн `billing-reminders`: Bearer `CRON_SECRET` + AuditEvent-dedup), результат через **существующий идемпотентный** `applySucceededPayment`, + `PAST_DUE`/dunning для отказов карты.
- **Почему сейчас (cancel-половина).** Закрывает живую offer-compliance-обязанность, schema+status уже поддерживают. Это **редкая монетизация-фича, которая защищает 27% маржу**, а не размывает.
- **Код.** `src/app/api/billing/cancel/route.ts` (новый), `src/app/billing/page.tsx`, `src/lib/billing/yookassa.ts` (auto-renew, позже), новый renewal-cron (позже).
- **Foot-guns.** Auto-renew — **real-money-on-a-timer**: per-cycle idempotence-key + explicit `cancelAtPeriodEnd`-guard в charge-запросе, иначе двойные списания/chargebacks. Требует отдельной активации «Автоплатежей» на merchant-аккаунте ЮKassa (шаг фаундера сверх `shop_id`). Строить renewal-loop против неконфигурированного провайдера, который нельзя end-to-end тестировать — **преждевременно**. Отгрузить cancel сейчас, renew — когда YooKassa живой.

### AI-6 — Proactive insight fusion (auto-deadline + панель «Что сделать перед подписанием»)
- **Что это.** `deadlines.ts` (extractDeadlines → ICS + email-cron) уже существует, и результат анализа уже несёт `balance`, `missingClauses[]`, `preSigningChecklist[]` — но `deadlines` за отдельной кнопкой, остальное — пассивный текст. Нет единого «вот что делать дальше». (Уточнение: `balance`/`missingClauses`/`preSigningChecklist` **уже рендерятся** на `report/[id]` L566-589 — silo-claim наполовину неверен; `compare.ts` к fusion непригоден — нужны два договора, выкинуть из скоупа.)
- **Решение.** Net-new: (1) auto-trigger `extractDeadlines` fire-and-forget на analyze COMPLETED через существующий блок в `run.ts` (Haiku, ~$0.02), surface inline; (2) one-click CTA («добавить в календарь» через существующий `deadlines.ics`-роут, «открыть Deal Room» для несбалансированных пунктов).
- **Почему сейчас.** Превращает пассивный вердикт в proactive «do this next», что кормит и retention, и Deal Room funnel (несбалансированный пункт = повод открыть переговорную).
- **Код.** `src/lib/analyze/run.ts` (auto-deadline в fire-and-forget блоке, **не** в standalone `deadlines`-роуте с `maxDuration=60`), `report/[id]/page.tsx` (панель + CTA).
- **Foot-guns.** **`extractDeadlines` сегодня НЕ вызывает `logUsage` и `checkQuotaSafe` (0 вхождений)** — auto-trigger без добавления `logUsage(document.userId, orgId)` амплифицирует unmetered-spend (класс #60). **Сначала пофиксить logUsage.** Template-routing CTA нужен controlled `contractType` enum (нет) → ненадёжен, отложить.

---

## Горизонт 2 — Big bets / moat (кварталы)

### DR-4 — True two-sided Counter-AI (rebalance)
- **Что это.** Pitch пивота — «двусторонние переговоры, Counter-AI выводит позицию второй стороны» — в коде это **односторонняя галлюцинация**. `theirSide`/`counterPerspective` генерится целиком из документа ОТПРАВИТЕЛЯ на analyze-проходе **до** того, как получатель открыл ссылку (`analyze.ts:13-14`: «AI simulates the other party; real two-sided input lands in Sprint 17+»). У получателя ноль input-полей. Он пассивно реагирует на догадку о себе.
- **Почему moat.** Единственная фича, делающая «live two-sided negotiation» буквально правдой — некопируемое ядро, которого у Kontur/Lawrocket нет структурно (у них нет переговорной вовсе). Moat moderate (3): textarea + rebalance-промпт сам по себе не глубоко defensible; moat — это комната+сеть, не один промпт.
- **Архитектурный эскиз.** `DealClause.receiverInput Json?` (nullable, db-push safe; `theirSide` уже Json). Bottom-border textarea для RECEIVER в `clause-card.tsx` («Что для вас важно в этом пункте?»). На submit — endpoint-клон receiver suggest-moves: та же session-claim верификация, тот же `clause.suggestedMoves` cache, тот же `logUsage(deal.ownerId)`, тот же `?force=1` cache-bypass. `REBALANCE_CLAUSE_PROMPT` (зеркало `NEGOTIATION_MOVES_PROMPT` с guard «не оборачивай в дополнительный объект», #47/#51), пересчитывающий **обе** стороны симметрично + per-clause conflict-level. **Один пункт за запрос** (Deal Room-роуты на default 60s Hobby — нет в `vercel.json` 300s-списке). `maxTokens 1500`.
- **Зависимости.** Hard-dep на **DR-6** (owner FREE-cap на receiver-пути — иначе второй receiver-triggered генератор расширяет unmetered-spend против владельца на тонкой марже). PR #9 ещё ждёт ответов на 5 open questions (TTL, hard-gate позиции, FREE rebalance quota). **Решить write-back недеструктивно** — не перезатирать analyze-derived `yourSide`/`theirSide` (теряется sender's opening offer).
- **Риски.** **Oversell:** без DR-3 (RESOLVE на новом тексте) и без realtime комната остаётся turn-based reload-to-see отчётом с богатой догадкой — необходимый ингредиент, не готовое блюдо. Anonymous-spend на тонкой марже. Gemini-фоллбэк: `toGeminiSchema` throws на экзотике (#42) — держать schema плоской.

### AI-1 — Market-norm benchmarking на pgvector-корпусе
- **Что это.** Каждый риск судится только против статической legal-reference карточки + 11 хардкод red-flags. Ноль понятия «эта неустойка/срок/cap необычны против сопоставимых договоров». `DocumentChunk` уже хранит Voyage 1024-dim pgvector-эмбеддинги каждого договора — используются только для приватного поиска юзера.
- **Почему moat (4).** Единственная фича с настоящим data-flywheel: Kontur/Garant — нормы без AI; ChatGPT — AI без RU-корпуса; у Яксо оба ингредиента. Компаундится с volume.
- **Архитектурный эскиз (честный — 90% greenfield).** Offline-job (паттерн durable atomic-claim/self-invoke): кластеризует клаузы по типу (неустойка %/день, notice-период, liability cap, payment deferral, юрисдикция), персистит распределения (p10/p50/p90, n) в новую `NormBaseline` таблицу. На analyze — после `verifyRiskQuotes` — опциональный `marketComparison?: {percentile, typicalRange, comment}` в `AnalysisRiskSchema` (`.optional()`, паттерн `consequence`/`balance`). Перцентиль **детерминированный** из хранимых терминов — **не новый AI-call**, zero Anthropic cost, в рамках 8192-ceiling. pgvector через raw SQL (Prisma не представляет vector; `voyageai` SDK сломан, #1).
- **Зависимости.** **Корпус сегодня грубый и пустой:** `chunkContract` делает docs ≤50k одним whole-doc блобом — **нет per-clause эмбеддингов нигде**, надо ре-эмбедить на clause-granularity с нуля. Нет числовой экстракции терминов (греп `неустойк`/`penalty` → только статические карточки). Корпус org-scoped (`WHERE d.orgId`) — нужен **cross-tenant pooling + 152-ФЗ consent-решение**. Бандлить `AI-2` (controlled `contractType` enum) как первый 1-дневный slice — typed routing это hard-prereq для scoping норм по типу.
- **Риски.** **Cold-start фатален пре-launch:** корпус ~пуст, перцентили на n<20 статистически бессмысленны, уверенные «рыночная норма» на тонких данных = trust-damage класса КАД-заглушки (#25). **Гейтить user-facing перцентиль за hard-минимум-N** и cross-tenant consent-решением до рендера. Ре-эмбеддинг множит Voyage-cost по всему корпусу. **Это сильная пост-PMF ставка** (вернуться на сотнях договоров, засеяв WB/OZON нишу где клаузы сходятся быстро) — НЕ shippable сейчас; downgrade с self-описанного «highest-leverage, ingredients already exist».

### DR-7 → PLT-1 — Lifecycle states + Inbox-дашборд
- **Что это.** `Deal.status` — plain String, пишутся только ACTIVE/AGREED (комментарий схемы `:948` сам признаёт «Sprint 15 adds DECLINED and EXPIRED» — их нет в коде). Получатель не может отклонить сделку, отправитель не может отозвать ссылку, нет TTL — утёкший 48-hex токен (он же access-control, #50) валиден вечно. UI-копия уже обещает «он перевыпустит приглашение» — overpromise несуществующей фичи.
- **Почему moat.** Сам по себе — low-impact инфраструктура (decline-кнопка + тихий expiry невидимы большинству, zero moat). Но это **enabling state-machine для PLT-1** — inbox «Ждут вас / Ждут их / Готово», где живёт настоящий retention-импакт. «Ждут вас (N)» — сильнейший reason-to-return, который может показать deal-flow продукт.
- **Архитектурный эскиз.** **DR-7:** «Отклонить предложение» → `Deal.status = DECLINED` (+ `declinedAt`/`declineReason`); nullable `Deal.expiresAt` (default now+30d) + daily expiry-cron (зеркало `restart-stuck-analyses`); sender invite-revoke (status EXPIRED + token rotation). **PLT-1:** реорг `dashboard/page.tsx` Active Deals в три бакета по terminal-states + turn-ownership; sidebar 6→3 (Deal Rooms / Drafts & Templates / Tools). Переиспользует AppShell/Sidebar/PageHeader.
- **Зависимости.** PLT-1 **100% гейтится DR-7**. Turn-ownership **не в текущем payload** `GET /api/deals` — нужен aggregate-запрос `ClauseAction→DealParticipant(role)` per deal, или денорм `lastSenderActionAt`/`lastReceiverActionAt` (additive nullable).
- **Риски.** **Status-sync foot-gun (грузонесущий, идея игнорит):** оба action-роута делают `updateMany WHERE status != desiredStatus → {ACTIVE, AGREED}` — DECLINED/EXPIRED сделка при любом последующем clause-action **молча ре-промоутится** в ACTIVE. Нужен terminal-set guard в **обоих** роутах + claim-логике GET, иначе state-machine сломана. Bucketing должен учитывать quirks `reconcileClauseStatus` (игнор COMMENT/PROPOSE_EDIT, недостижимый RESOLVED) — иначе мислейблит «Ждут вас». Decline-reversibility — open question PR #9. Sidebar-реорг **выделить отдельным low-risk изменением**, не коуплить с inbox. Zero revenue, не трогает блокеры — строить как natural consumer **после** DR-7.

---

## Топ киллер-фич (детально)

### 1. DR-1 — Receiver→sender CTA (замыкание петли)
**Продукт.** Это не «фича», это устранение #1 утечки бизнеса. Сеть-first pivot обещает, что каждая отправленная сделка приводит тёплого контрагента в орбиту Яксо. В коде этого нет вообще: получатель проходит весь путь — разбор, голосование, AGREED — и уходит без единого приглашения разобрать собственный договор. CTA монтируется RECEIVER-only на пиках интента (после первого голоса, на AGREED-колофоне), в editorial-голосе, ведёт на `/sample-report` (value-first) или `/register`.
**Техника.** Чистая additive-навигация, без AI/schema/endpoint — обходит #60, не трогает 27% маржу, сохраняет robots noindex. Несколько часов работы на уже отгруженной, battle-tested инфраструктуре (`/r/[token]`-паттерн). Единственное ограничение — ценность гейтится подключением домена, и шиппить надо с DR-2, чтобы конверсия была измерима с дня один. Из всех 30+ идей это лучшее соотношение leverage/effort.

### 2. DR-3 — Counter-propose → accept loop
**Продукт.** Самое AI-native действие продукта — ход «Компромисс» с готовой формулировкой — сегодня подключено в никуда: `PROPOSE_EDIT` игнорируется реконсиляцией, `RESOLVED` недостижим, спор можно урегулировать **только** согласием на исходный текст. Это превращает «AI-медиатор» из косметики в реальный механизм урегулирования: контрагент видит redline-карточку с предложенной формулировкой и кнопкой «Принять».
**Техника.** Генеративная половина (`MovesSchema.proposedText`) уже отгружена. Закрытие — это новый String-kind `ACCEPT_PROPOSAL` (без enum-миграции), одна nullable `agreedText` (db-push safe), расширение `reconcileClauseStatus` до `RESOLVED`, и синхронный апдейт promote/demote в обоих action-роутах. M-эффорт на мёртвом проводе с высочайшим leverage. Прекондишн DR-5 — без захвата принятого текста нечего экспортировать.

### 3. DR-4 — True two-sided Counter-AI
**Продукт.** Закрывает core-обещание пивота, которое сегодня — фикция. Вместо односторонней галлюцинации о позиции получателя (сгенерированной из документа отправителя до открытия ссылки) получатель **сам** формулирует, что ему важно, а AI пересчитывает обе стороны симметрично с per-clause conflict-level. Разница между «AI прочитал твой договор» и «AI медиирует живые переговоры».
**Техника.** Инфра на 80% есть: `theirSide` уже Json (добавить `receiverInput Json?`), endpoint — клон receiver suggest-moves с теми же session-claim/cache/logUsage/force-паттернами, `REBALANCE_CLAUSE_PROMPT` — зеркало существующего с anti-wrapper guard. L-эффорт. Hard-dep на DR-6 (cap-дыра), на недеструктивный write-back, и на ответы PR #9. Moat moderate — defensible не промпт, а комната+сеть вокруг него. Sequence после launch-блокеров.

### 4. DR-5 — AGREED → итоговый документ + история согласования
**Продукт.** При флипе в AGREED сегодня **не производится ничего** — а лендинг (`page.tsx:280`) обещает «выгружаете финальный DOCX». Живой false-advertising класса КАД-заглушки. Решение: при AGREED (и RESOLVED-complete из DR-3) генерить итоговый DOCX (принятый/redlined текст из `agreedText`) + историю согласования (timeline `ClauseAction`: кто/когда/что) + completion-письмо. Материальный артефакт, оправдывающий оплату, и retention-пик.
**Техника.** Рендер-инфра **уже есть**: `src/app/api/export/pdf/route.ts` — рабочий server-side pdfkit с Cyrillic-шрифтами (идея ошибается, что нужен тяжёлый `@react-pdf/renderer` + durable-job — синхронный pdfkit укладывается в 60s, zero AI cost). **Корректировки:** `ClauseAction` **не хранит IP** (нужна additive колонка, ретро-сделки без IP); без DR-3 «финальный DOCX» = исходный договор; AGREED reversible → нужен idempotency-guard от ре-email на каждый toggle. **Тон маркетинга снизить** с «доказательный пакет/SHA-256» до «итоговый документ + история согласования» — анонимная cookie-сессия не подписант. Строить in-app «Итог»-страницу первой (работает независимо от email/домен-блокеров), после DR-3.

---

## Улучшение нынешних фич (по подсистемам)

**Deal Room**
- `DR-6` — receiver suggest-moves: добавить owner FREE-cap + правильный tier → `by-token/.../suggest-moves/route.ts` + новый shared `free-cap.ts`.
- `DR-8` — presence + auto-refresh: `lastSeenAt` в payload + visibility-gated polling → `deal-room.tsx`, `by-token/[token]/route.ts`.
- Клаузы только для рисков: `createDealFromDocument` материализует один `DealClause` на риск (`deals.ts:97`) — нерисковые пункты невидимы переговорам. Сделать весь документ навигабельным (medium-gap, отдельный slice).
- Deal-создание hard-fails если анализ не COMPLETE (`deals.ts:57` → 422): с durable async — нужен путь «создать сделку, прикрепить анализ когда готов».

**AI-анализ**
- `AI-7` (телеметрия) — applyfix-unavailable event → `quote-verify.ts`.
- `AI-6` — fusion + **обязательный `logUsage`-fix в `extractDeadlines`** (сейчас unmetered) → `run.ts`, `deadlines.ts`.
- `AI-3` (только confidence-половина) — `confidence?`/`evidence?` per risk из уже вычисленного `verifyRiskQuotes`-спана, zero AI cost → `schemas/analyze.ts`, `analysis-card.tsx`. **Score-reweight половину отбросить** — она таргетит `calibrate()` (только fallback), живой score идёт из промпт-таблицы.
- **Унифицировать два analyze entry-point'а:** старый синхронный `/api/analyze/route.ts` (449 строк) живёт параллельно durable `/start+run` — drift-риск (старый роут не имеет in-flight quota-гейта #58, уязвим к parallel-start race). Схлопнуть в durable-путь.
- `AI-2` (taxonomy) — только как первый slice внутри AI-1; standalone near-drop (enum, который юзер не видит).

**Рост**
- `GR-1` — copy-link/Telegram → `deals/route.ts`, `send-as-deal.tsx`.
- `DR-2` — PostHog воронка → `analytics/server.ts` + deal-роуты.
- `GR-3` — программный SEO WB/OZON (после домена; премиса частично устарела — `marketplace-agent.tsx` уже есть; templates не несут метаданных для fan-out → это «написать 20 статей с общим chrome», не «программно») → `blog/[slug]`-паттерн.
- `GR-2` part a (referral trigger на first-deal-sent, **с rewarded-flag против fraud** — trial-гейтинг был осознанной защитой) — только после трафика; part b заблокирован MON-2.

**Монетизация / retention**
- `MON-3` cancel-половина (сейчас) → `billing/cancel/route.ts`, `billing/page.tsx`.
- `MON-2` — in-flow trial на 402 (после YooKassa) → `analyze/page.tsx` (`report` НЕ имеет 402-surface — поправка к идее; FREE = 10 анализов, не 3).
- `MON-1` — pay-per-Deal metering (после DR-7+домен): новый `deals`-quota dimension, гейт `POST /api/deals` → `plans.ts`, `quota.ts` (нужен fork от AiUsage-month к active-count — не «не новая инфра»).
- `RET-1` — onboarding 3-я карта на Deal Room + post-analysis nudge (после домена; nudge на `report/[id]`, не `/analyze`; deal-sent event **server-side**, не client) → `onboarding-modal.tsx`, `report/[id]/page.tsx`.
- `MON-5` — годовые тарифы (после MON-3): **не margin-стратегия** (−16% сжимает маржу с 27% до ~14%); pull-forward cash, не churn-fix.

**Платформа**
- `DR-7` state-machine + `PLT-1` inbox (после DR-7) → `schema.prisma`, action-роуты, `dashboard/page.tsx`, `sidebar.tsx`.
- Generalize durable-job primitive (atomic-claim + self-invoke + stuck-cron) в reusable `Job`-таблицу — разблокирует DR-5 async, expiry-cron, webhook-delivery, embeddings-backfill. Medium, делать когда ≥2 потребителя.
- Rate-limit boot-time assertion: тихая деградация в per-instance memory Map без Upstash → no alarm; abuse-sensitive endpoints (`deals.create`, `negotiation.suggest`, `billing.checkout`) зависят от наличия Upstash.
- Route/integration test harness: `vitest.config.ts` исключает `src/app` целиком — ноль тестов на atomic-claim race, quota-гейт, anonymous logUsage-attribution. Тонкий integration-слой на highest-risk путях.

---

## Рекомендуемая последовательность

**Фаза 0 — Launch-блокеры (фаундер, до всего; 30% код / 70% операции).**
Ничего из growth/монетизации не имеет ценности, пока это открыто. **Никакая монетизация-фича не «считается», пока checkout не работает и ссылки не резолвятся.**
1. Подключить `yakso.ru` к Vercel (A-запись) — снимает 404 на всех deal/r/OG/email-ссылках.
2. Verify домена в Resend — включает доставку invite/welcome/reset.
3. YooKassa `shop_id`/`secret` + активация «Автоплатежей» — снимает checkout 503 (прекондишн MON-2/MON-3-renew/MON-1).
4. `GEMINI_API_KEY` в Vercel (бесплатно) — чинит fragile fallback (Anthropic-OR-Groq, Groq падает на длинных по TPM).

**Фаза 1 — Замкнуть петлю + гигиена (параллельно с Фазой 0, мержить в текущий PR-поток).**
- Смержить **PR #10** (durable analyze + negotiation moves + ICS), затем **PR #8** (5 followup-fixes — preemptive cancel, ICS folding; ребейз на main).
- **DR-1 + DR-2** (вместе) — receiver→sender CTA + инструментирование. Отгружаются «тёмными», активируются в день подключения домена.
- **GR-1** — copy-link/Telegram (S).
- **DR-6** — cap-дыра (S, ride с Deal Room PR).
- **AI-7** телеметрия-половина (S).

**Фаза 2 — Сделать переговорную настоящей (после домена).**
- **DR-3** (counter-propose→accept) — разблокирует DR-5.
- **DR-8** (presence + auto-refresh).
- **MON-3 cancel-половина** (закрывает offer-compliance долг).
- Разрешить 5 open questions **PR #9**, затем раскрыть в B1/B2/B3 планы.

**Фаза 3 — Монетизация спина + lifecycle (после работающего checkout).**
- **DR-7** (DECLINED/EXPIRED) → **PLT-1** (inbox) → **MON-1** (pay-per-Deal).
- **MON-2** (in-flow trial), **MON-3 auto-renew** (когда YooKassa живой), **RET-1**, **DR-5** (после DR-3).
- **AI-6** (с logUsage-fix), унификация analyze entry-points.

**Фаза 4 — Moat (пост-PMF, на сотнях договоров).**
- **DR-4** (two-sided rebalance, после DR-6).
- **AI-1** (market-norm, за hard-N-гейтом + cross-tenant consent) + **AI-2** как первый slice.
- **GR-3** (SEO), generalize job-primitive, **AI-4** (cross-clause Opus — после первого BUSINESS-клиента + eval-харнесс).

---

## Метрики и риски

**Метрики по горизонтам**
- **Горизонт 0:** receiver→register конверсия (DR-1, измеримо только с DR-2); виральный коэффициент K = (register'ов из deal-ссылок) / (отправленных сделок); доля сделок без email; receiver suggest-moves 402-rate (нет spend-spike).
- **Горизонт 1:** same-session resolution rate (DR-3+DR-8); доля DISPUTED→RESOLVED на новом тексте; cancel-rate self-serve (MON-3); applyfix-unavailability тренд (AI-7).
- **Горизонт 2:** активные сделки на отправителя; «Ждут вас (N)» → return-rate (PLT-1); recurring MRR (не снимок) после auto-renew; norm-coverage (доля рисков с `marketComparison` за N-гейтом).

**Топ-риски и анти-паттерны (foot-guns, которых избегать)**
- **Отгрузка «вхолостую».** Каждый growth/монетизация-артефакт хардкодит `BRAND.publicUrl`; **не кредитовать revenue до подключения домена.** Самая частая ошибка фаундера-разработчика — путать «продукт работает» с «бизнес работает».
- **Unmetered Anthropic spend (#60).** Любой anonymous/receiver AI-endpoint обязан `logUsage(deal.ownerId)` + проверять FREE-cap владельца; `logUsage(null)` — no-op, spend утекает молча. `?force=1` — cache-bypass ONLY, никогда quota-bypass (#59). На 27% марже с пустым Gemini это живые деньги.
- **27% маржа.** Не наращивать AI-фичи на FREE без cost-контроля; chunk-map намеренно pinned к Sonnet (не Opus); годовая скидка (MON-5) **сжимает**, а не лечит маржу. Любой новый metered AI-шаг → `logUsage` + отражение в quota-гейте (in-flight PENDING+RUNNING, #58).
- **Status-sync desync (DR-3/DR-7).** Promote/demote-запрос в **двух** action-роутах; новые terminal-статусы (RESOLVED/DECLINED/EXPIRED) должны попасть в обе ветки + claim-логику GET, иначе state-machine ломается тихо.
- **Oversell / trust-damage.** Market-norm перцентили на n<20, «доказательный пакет/SHA-256» на cookie-сессии-неподписанте, «финальный DOCX» без DR-3 — всё класса КАД-заглушки. Гейтить за hard-N и честным маркетингом.
- **Opus tool-wrapping (#47/#51).** Новые schema-поля плоские top-level, не переименовывать `record_response`, JSON-примеры inline в bullets, anti-wrapper guard в любом новом structured-промпте. `toGeminiSchema` throws на экзотике (#42) — без discriminated unions. `max_tokens` 8192-ceiling (#30) — рост схемы рискует mid-JSON truncation.
- **Преждевременная монетизация.** MON-1/MON-2/MON-5 отгружать только после работающего checkout; гейтить виральное share-действие (MON-1 FREE-cap) пре-launch без аудитории — risk-асимметрично, сначала инструментировать (DR-2) и наблюдать поведение.
- **Apply-fix fuzzy-fallback (#13).** Глобальный replace-all → ложный/неуникальный якорь портит DOCX. Только за uniqueness-гейтом или не делать.

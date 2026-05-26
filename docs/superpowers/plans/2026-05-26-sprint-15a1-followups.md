# Sprint 15A.1 — Final-Review Deferred Fixes

**Дата**: 2026-05-26
**Статус**: ready for implementation
**Ветка**: `claude/sprint-15a-1-followups` (от `claude/sprint-8-ui-polish` HEAD `caa98c7`)
**База PR**: target `claude/complete-previous-tasks-rzcSp` после merge'а PR #7. До merge'а — base = `claude/sprint-8-ui-polish` чтобы diff показывал только 15A.1.

## Контекст

Sprint 15A final-review (whole-implementation, opus) нашёл 3 critical
+ 5 important findings. 3 critical + 1 important были закрыты в коммите
`154402a` (parallel-quota race, ?force=1 bypass, anonymous unmetered AI,
DISPUTED gate на suggest-moves).

5 оставшихся important deferred в Sprint 15A.1 — этот plan.

## Tasks

### T1 — ICS line folding (RFC 5545 §3.1)

**Foot-gun**: #63
**File**: `src/lib/ics.ts`
**Test file**: `src/lib/__tests__/ics.test.ts` (создать если нет, или
расширить существующий)
**Risk**: low — pure function, изолированно тестируется

RFC 5545 §3.1 требует что строки длиннее 75 octets разбиваются на
несколько с continuation-маркером (одна или больше WSP в начале
следующей строки):

> Lines of text SHOULD NOT be longer than 75 octets, excluding the line
> break. Long content lines SHOULD be split into a multiple line
> representations using a line "folding" technique. That is, a long
> line can be split between any two characters by inserting a CRLF
> immediately followed by a single linear white-space character (i.e.,
> SPACE or HTAB).

«Octets», не characters — UTF-8 кириллица занимает 2 байта/символ, так
что 75-character SUMMARY с кириллицей легко выйдет за лимит.

**Implementation**:

1. Добавить helper `foldLine(line: string, maxOctets = 75): string`:
   - Кодирует строку в UTF-8 bytes
   - Если ≤75 байт — return as-is
   - Иначе режет на куски по ≤75 байт, склеивает через `\r\n ` (CRLF
     + space)
   - **Важно**: режет ПО BYTE-границам с откатом до valid UTF-8
     boundary (не разрывать multi-byte sequence). Helper типа
     `splitUtf8At(bytes, maxLen)` который ищет последний valid char
     boundary в пределах `maxLen`.
2. В `buildIcsCalendar` — пропустить каждую строку (после join'а)
   через `foldLine` ПЕРЕД финальным `.join("\r\n")`. Альтернатива —
   делать fold на этапе формирования каждой строки внутри loop'а.
3. UID, DTSTAMP, DTSTART, VERSION, PRODID, CALSCALE, BEGIN/END markers
   — все короткие, fold не сработает; SUMMARY/DESCRIPTION в кириллице
   часто длинные → fold сработает.

**Test cases**:
- `foldLine("short", 75)` → no fold
- `foldLine("a".repeat(80), 75)` → `"a"*75 + "\r\n " + "a"*5`
- `foldLine` на кириллической строке 50 символов (100 байт) → один
  fold между символами на правильной byte-boundary
- `foldLine` на смешанной строке (ASCII + multi-byte) — никогда не
  должен резать середину UTF-8 sequence
- Snapshot test на `buildIcsCalendar` с одним event'ом у которого
  SUMMARY длиной 200+ байт — проверяет что output содержит CRLF+space
  continuation и проходит парсинг через стандартный ICS parser (если
  есть лёгкий — `ical.js` или просто regex check на line lengths
  всех строк ≤75 байт).

**Verification**: после fix'а, существующий integration test
(`buildIcsCalendar` smoke) должен продолжать работать. Google
Calendar / Apple Calendar / Outlook ranged-tolerant к unfolded
строкам, но строгие парсеры (RFC 5545 conformance) — нет.

---

### T2 — `INTERNAL_BASE_URL` env var для dev/preview isolation

**Foot-gun**: #64
**File**: `src/lib/analyze/kick-off.ts`
**Risk**: low — single file, single env var

**Проблема**: `kickOffBackgroundAnalyze` использует `BRAND.publicUrl`
(hardcoded `https://yakso.ru`) для self-invoke target. На dev/preview
environments — это попадёт в prod URL с local-only `analysisId`,
который в prod не существует → wasted request → analysis висит PENDING
до cron'а.

**Implementation**:

1. В `src/lib/analyze/kick-off.ts`:
   ```ts
   const url = `${process.env.INTERNAL_BASE_URL ?? BRAND.publicUrl}/api/analyze/run`;
   ```
2. Документировать в CLAUDE.md env vars table:
   ```
   | `INTERNAL_BASE_URL` | (опц.) Override base URL for self-invoke в
   `kickOffBackgroundAnalyze`. На preview deploys Vercel выставляет
   `VERCEL_URL` (без https://) — можно использовать
   `INTERNAL_BASE_URL=https://$VERCEL_URL` или hardcoded preview URL.
   На prod — оставить пустым, фоллбэк на `BRAND.publicUrl`
   (https://yakso.ru). | Self-invoke в dev/preview уходит на prod URL
   → wasted requests, PENDING analyses до cron'а. |
   ```
3. Comment в kick-off.ts:
   ```ts
   // INTERNAL_BASE_URL override exists so dev/preview deploys don't
   // accidentally self-invoke against production. If unset (typical
   // prod), falls back to BRAND.publicUrl.
   ```

**Test**: smoke только — переменная env'ная, runtime side-effect.

**Verification**: после deploy на preview — kick-off попадает на тот
же preview URL, не на yakso.ru.

---

### T3 — Rate limit на `/api/analyze/active`

**File**: `src/app/api/analyze/active/route.ts`
**Risk**: trivial — siblings уже rate-limited (`analyze.poll` 300/min)

**Проблема**: `/active` endpoint не имеет rate-limit, в отличие от
sibling `/status` и `/result`. Polling на mount + window-event на
`yakso:analyze-started` могут спамить.

**Implementation**:

1. В `src/app/api/analyze/active/route.ts`:
   ```ts
   import { checkRateLimit } from "@/lib/rate-limit";

   export async function GET(request: Request) {
     const session = await auth();
     if (!session?.user?.id) {
       return NextResponse.json({ jobs: [] });
     }

     const rl = await checkRateLimit("analyze.poll", session.user.id);
     if (!rl.ok) {
       return NextResponse.json(
         { jobs: [], error: "rate_limited" },
         { status: 429, headers: { "retry-after": String(rl.retryAfter ?? 1) } }
       );
     }

     // ... rest unchanged
   }
   ```

**Test**: можно добавить smoke unit-тест но не обязательно — pattern
тривиальный, уже хорошо покрыт в siblings.

---

### T4 — Sentinel `__CANCELLED__` → typed exception

**Foot-gun**: #62
**File**: `src/lib/analyze/run.ts`
**Risk**: low — refactor без change в behavior

**Проблема**: `runAnalyzeJob` использует magic-string
`throw new Error("__CANCELLED__")` для short-circuit при cancel
detection, и `if (err.message === "__CANCELLED__")` в catch. Realistic
risk низкий (ни один provider не возвращает эту строку), но safer —
typed exception.

**Implementation**:

1. В `src/lib/analyze/run.ts`, ПЕРЕД `runAnalyzeJob`:
   ```ts
   class CancelledByUser extends Error {
     constructor() {
       super("Analysis cancelled by user");
       this.name = "CancelledByUser";
     }
   }
   ```
2. Заменить `throw new Error("__CANCELLED__");` на
   `throw new CancelledByUser();`.
3. Заменить `if (msg === "__CANCELLED__")` на
   `if (err instanceof CancelledByUser)`.
4. Из-за того что catch block теперь использует `err` (не только
   `msg`), `msg` извлекается ниже (для `markFailed(msg)`).

**Verification**: существующие unit-тесты `analyze-job-lifecycle.test.ts`
должны продолжать работать. Если в них есть assertion на
`err.message === "__CANCELLED__"` — обновить на `err instanceof
CancelledByUser`.

---

### T5 — Cancel cooperative → preemptive (AbortController)

**Foot-gun**: #61
**Files**:
- `src/lib/ai/types.ts` (add `signal?` to `GenerateOptions`)
- `src/lib/ai/client.ts` (thread signal через `generate` + `generateText`)
- `src/lib/ai/providers/anthropic.ts` (pass to SDK call)
- `src/lib/ai/providers/gemini.ts` (already has signal in streamChat, mirror в generate)
- `src/lib/ai/providers/groq.ts` (already has signal in streamChat, mirror)
- `src/lib/ai/analyze.ts` (accept signal, propagate to generate calls)
- `src/lib/analyze/run.ts` (create AbortController, pass signal, abort on CANCELLED)

**Risk**: **MEDIUM** — самый рискованный fix этого набора. Затрагивает 7
файлов, провайдеры с разными SDK signatures, может ломать существующие
non-cancellable code paths. Spec compliance review обязательно.

**Проблема**: `runAnalyzeJob` проверяет CANCELLED только на progress
checkpoint'ах (5/30/50/90). Между checkpoint 50 и 90 сидит весь
`analyzeContract` (20-150с) — `AbortController` в provider не проброшен.
User видит «отменил», но Anthropic-токены всё равно списываются.

**Implementation**:

1. **types.ts**: добавить `signal?: AbortSignal` в `GenerateOptions`:
   ```ts
   export interface GenerateOptions<T extends z.ZodTypeAny = z.ZodTypeAny> {
     schema?: T;
     prompt: string;
     system: SystemPromptInput;
     model?: ModelTier;
     temperature?: number;
     maxTokens?: number;
     /** Optional abort signal — when fired, upstream AI request is cancelled. */
     signal?: AbortSignal;
   }
   ```
2. **client.ts**: `generate()` и `generateText()` не трогают `opts`
   shape, просто передают далее в провайдер — signal автоматически
   forward'ится.
3. **providers/anthropic.ts**: при SDK вызове `client.messages.create`
   передать `{ signal: opts.signal }` как второй аргумент (как уже
   сделано в streamChat — см. line 297). Сделать для всех 4 anthropic
   путей (generate, generateText, streamChat уже есть, batch). Найти
   через grep `client.messages` или `await anthropic`.
4. **providers/gemini.ts**: SDK Gemini не honors signal natively — нужен
   manual check ПОСЛЕ generate call с throw if `signal.aborted`. Также
   между chunks в streaming паттерн уже есть на line 178.
5. **providers/groq.ts**: SDK Groq honors `signal: opts.signal` natively
   — line 195 уже передаёт это в streamChat. Зеркалить в generate.
6. **lib/ai/analyze.ts**: `analyzeContract(rawText, userId, orgId, plan,
   signal?: AbortSignal)` — добавить опциональный 5й параметр, прокинуть
   в все `generate()` / `generateText()` вызовы внутри функции.
7. **analyze/run.ts**: в `runAnalyzeJob`:
   ```ts
   const controller = new AbortController();

   // Periodic CANCELLED poll, runs separately from checkpoints
   const cancelPoll = setInterval(async () => {
     const current = await prisma.analysis.findUnique({
       where: { id: analysisId },
       select: { status: true },
     });
     if (current?.status === "CANCELLED") {
       controller.abort();
       clearInterval(cancelPoll);
     }
   }, 2000); // every 2s

   try {
     // ... existing flow, pass controller.signal to analyzeContract
     const result = await analyzeContract(
       document.rawText, document.userId, orgId, effectivePlan,
       controller.signal,
     );
     // ...
   } catch (err) {
     if (controller.signal.aborted || err instanceof CancelledByUser) {
       // Cancelled — status already CANCELLED from poll
       return { claimed: true };
     }
     // ... existing failure handling
   } finally {
     clearInterval(cancelPoll);
   }
   ```
8. **Проверки**:
   - **Memory leak**: `clearInterval` в finally обязателен.
   - **Race**: если cancel пришёл ПОСЛЕ successful complete но ДО
     возврата — это OK, статус уже COMPLETED, abort на пустом
     контроллере no-op.
   - **Polling stampede**: 2s interval мягкий, в худшем случае 75
     queries за 2.5 минуты на job. Можно оптимизировать через
     debounce на client-cancel событие, но не в scope T5.

**Verification**:
- Существующие unit-тесты `analyze-job-lifecycle.test.ts` НЕ должны
  ломаться (signal — опциональный параметр)
- Добавить новый тест: «cancel mid-flight aborts AbortController and
  status stays CANCELLED»
- Live smoke на preview: запустить большой анализ, cancel через 5с —
  Anthropic call должен прерваться (видно в `AiUsage` row которая
  должна быть НЕ создана для cancel'нутых)

**Spill rule**: если AbortController plumbing окажется > 2ч работы
или провайдеры окажутся в очень разных state'ах — отложить в Sprint
15A.2, мержить остальные 4 fixes в PR #8 без T5.

---

## Sequencing

**Parallel safe (no file overlap)**:
- T1 (ics.ts)
- T2 (kick-off.ts)
- T3 (api/analyze/active/route.ts)

**Sequential (после T1-T3 done, разные файлы но связанные с analyze/run)**:
- T4 (analyze/run.ts — typed exception)
- T5 (analyze/run.ts + types.ts + providers + analyze.ts — AbortController)

T4 ПЕРЕД T5: T5 catch block уже учитывает CancelledByUser, удобнее
сначала вернуть typed exception.

## Verification

После всех 5 tasks:
1. `npx tsc --noEmit` — clean
2. `npm test` — все 437 + новые (целевое 445-450)
3. `npx next build` — clean
4. `superpowers:requesting-code-review` medium effort

## Spill plan

Если T5 разрастается:
- T1+T2+T3+T4 → PR #8 (Sprint 15A.1, minor)
- T5 → отдельный PR #9 (Sprint 15A.2, AbortController)

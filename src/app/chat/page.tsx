"use client";

import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import {
  Send,
  Scale,
  Loader2,
  MessageCircle,
  Sparkles,
  Building,
  Users,
  FileText,
  ShieldCheck,
  Banknote,
  Briefcase,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseSseStream } from "@/lib/sse-client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** True while this assistant message is still being streamed in. */
  streaming?: boolean;
}

const suggestedQuestions = [
  {
    icon: Building,
    category: "Бизнес",
    questions: [
      "Могу ли я работать как ИП и одновременно быть учредителем ООО?",
      "Какие налоговые режимы доступны для ИП в 2025 году?",
      "Чем отличается ООО от ИП? Что лучше для старта?",
    ],
  },
  {
    icon: FileText,
    category: "Договоры",
    questions: [
      "Обязательно ли заверять договор у нотариуса?",
      "Может ли заказчик расторгнуть договор в одностороннем порядке?",
      "Какой срок исковой давности по договорам?",
    ],
  },
  {
    icon: Users,
    category: "Сотрудники",
    questions: [
      "Могу ли я уволить сотрудника на испытательном сроке без объяснений?",
      "Обязан ли ИП платить отпускные подрядчику?",
      "Можно ли штрафовать сотрудников за опоздания?",
    ],
  },
  {
    icon: Banknote,
    category: "Налоги",
    questions: [
      "Какие штрафы за несдачу отчётности вовремя?",
      "Можно ли совмещать УСН и патент?",
      "Как правильно оформить возврат товара с точки зрения налогов?",
    ],
  },
  {
    icon: ShieldCheck,
    category: "Защита",
    questions: [
      "Как защитить интеллектуальную собственность моего стартапа?",
      "Что делать, если контрагент не платит по договору?",
      "Как правильно составить претензию?",
    ],
  },
  {
    icon: Briefcase,
    category: "Лицензии",
    questions: [
      "Какие виды деятельности требуют лицензии?",
      "Нужна ли лицензия для онлайн-школы?",
      "Какие разрешения нужны для открытия кафе?",
    ],
  },
];

// Demo responses for common questions (used when API key is not set)
const demoResponses: Record<string, string> = {
  default: `Это отличный вопрос! Давайте разберёмся.

Согласно действующему законодательству РФ, данный вопрос регулируется несколькими нормативными актами. Вот ключевые моменты:

**Основные положения:**
• Вопрос регулируется Гражданским кодексом РФ
• Необходимо учитывать специфику вашей ситуации
• Сроки и порядок действий зависят от конкретных обстоятельств

**Рекомендация:** Для более точного ответа, пожалуйста, уточните детали вашей ситуации — тип бизнеса, регион, сумму сделки.

⚠️ *Данный ответ носит информационный характер. Для принятия юридически значимых решений рекомендуется консультация с квалифицированным юристом.*`,
};

function getDemoResponse(question: string): string {
  const q = question.toLowerCase();

  if (q.includes("ип") && q.includes("ооо")) {
    return `**Да, можно.** Законодательство РФ не запрещает физическому лицу одновременно быть индивидуальным предпринимателем и учредителем (участником) ООО.

**Ключевые моменты:**

1. **Нет ограничений** — ст. 23 ГК РФ и ФЗ «Об ООО» не содержат запрета на совмещение
2. **Налоги отдельно** — как ИП и как учредитель ООО вы платите налоги раздельно
3. **Ответственность** — как ИП вы отвечаете всем имуществом, как участник ООО — только в пределах доли

**Ограничения:**
• Нельзя применять НПД (самозанятость) по отношению к ООО, где вы участник
• Сделки между вашим ИП и вашим ООО будут считаться сделками взаимозависимых лиц — ФНС может проверить цены на рыночность (ст. 105.1 НК РФ)

**Рекомендация:** Это законная и распространённая практика, но следите за тем, чтобы сделки между ИП и ООО были по рыночным ценам.

⚠️ *Информационный характер. Не является юридической консультацией.*`;
  }

  if (q.includes("налого") && q.includes("режим")) {
    return `**Налоговые режимы для ИП в 2025 году:**

1. **ОСНО** (общая система)
   • НДФЛ 13-15% + НДС 20%
   • Для крупного бизнеса или работы с НДС

2. **УСН «Доходы»** (6%)
   • Налог 6% от выручки
   • Идеально для услуг с низкими расходами
   • Лимит: 450 млн ₽/год, до 130 сотрудников

3. **УСН «Доходы минус расходы»** (15%)
   • Налог 15% от прибыли
   • Выгодно при расходах > 60% от выручки

4. **Патент (ПСН)**
   • Фиксированная стоимость, зависит от региона и вида деятельности
   • Лимит: 60 млн ₽/год, до 15 сотрудников

5. **НПД (самозанятость)**
   • 4% (физлица) / 6% (юрлица)
   • Лимит: 2,4 млн ₽/год, без сотрудников

6. **АУСН** (автоматизированная УСН)
   • Доступна в отдельных регионах
   • 8% (доходы) или 20% (доходы-расходы)

**Рекомендация:** Для старта чаще всего оптимально **УСН 6%** или **патент**. Если оборот до 2,4 млн — рассмотрите **самозанятость**.

⚠️ *Информационный характер. Не является юридической консультацией.*`;
  }

  if (q.includes("уволить") && q.includes("испытат")) {
    return `**Да, но с оговорками.** Увольнение на испытательном сроке проще, но не «без объяснений».

**По закону (ст. 71 ТК РФ):**

1. **Можно уволить** при неудовлетворительном результате испытания
2. **Нужно предупредить** работника за 3 дня в письменной форме
3. **Обязательно указать причины** — конкретные, подтверждённые документально

**Что считается причиной:**
• Невыполнение плана / KPI (если были зафиксированы)
• Нарушение дисциплины (опоздания, прогулы)
• Несоответствие квалификации
• Жалобы клиентов (задокументированные)

**Чего нельзя делать:**
• Увольнять беременных женщин — даже на испытательном сроке (ст. 261 ТК РФ)
• Увольнять без доказательств — суд восстановит работника
• Устанавливать испытание молодым специалистам до 18 лет

**Рекомендация:** Фиксируйте все нарушения актами, служебными записками. При увольнении составьте уведомление с перечнем причин.

⚠️ *Информационный характер. Не является юридической консультацией.*`;
  }

  if (q.includes("нотариус") || q.includes("заверя")) {
    return `**В большинстве случаев — нет.** Договор действителен без нотариального заверения, если закон не требует иного.

**Когда нотариус ОБЯЗАТЕЛЕН:**
• Сделки с долями в ООО (купля-продажа, дарение)
• Договор ренты
• Брачный договор
• Соглашение об алиментах
• Договоры с участием несовершеннолетних
• Сделки с недвижимостью при долевой собственности

**Когда НЕ обязателен, но рекомендуется:**
• Крупные сделки (для дополнительной защиты)
• Договоры займа на большие суммы
• Когда одна из сторон вызывает сомнения

**Стоимость:** Нотариальное заверение — от 500₽ до 0.5% от суммы сделки.

**Альтернатива:** Простая письменная форма + подписи сторон достаточна для большинства договоров (ст. 161 ГК РФ).

⚠️ *Информационный характер. Не является юридической консультацией.*`;
  }

  if (q.includes("штраф") && q.includes("сотрудник")) {
    return `**Нет, штрафовать сотрудников нельзя.** Это прямое нарушение ТК РФ.

**Что говорит закон:**

Ст. 192 ТК РФ устанавливает исчерпывающий перечень дисциплинарных взысканий:
1. **Замечание**
2. **Выговор**
3. **Увольнение** (по соответствующим основаниям)

Денежных штрафов в этом списке **нет**.

**Штраф для работодателя:**
• За незаконные штрафы сотрудникам — до 50 000₽ для юрлица (ст. 5.27 КоАП РФ)
• При повторном нарушении — до 70 000₽

**Законные альтернативы:**
• **Депремирование** — можно не выплатить бонусную часть (если это прописано в положении о премировании)
• **Дисциплинарное взыскание** — замечание или выговор
• **Возмещение ущерба** — если сотрудник причинил материальный ущерб (ст. 238 ТК РФ)

**Рекомендация:** Пропишите систему KPI и премирования. Тогда можно законно снижать переменную часть зарплаты за нарушения.

⚠️ *Информационный характер. Не является юридической консультацией.*`;
  }

  if (q.includes("интеллектуальн") || q.includes("собственност") && q.includes("защит")) {
    return `**Как защитить IP стартапа — пошаговый план:**

**1. Товарный знак (бренд)**
• Зарегистрируйте в Роспатенте (ФИПС)
• Срок: 12-18 месяцев, стоимость: от 30 000₽
• Защита на 10 лет с возможностью продления

**2. Код и ПО (авторское право)**
• Возникает автоматически в момент создания
• Ключевое: **трудовой договор** должен содержать пункт о служебных произведениях (ст. 1295 ГК РФ)
• Дополнительно: депонирование кода (КОПИРУС, n'RIS)

**3. NDA со всеми**
• С сотрудниками — в трудовом договоре
• С подрядчиками — отдельное NDA
• С партнёрами — до раскрытия информации

**4. Патент (если есть изобретение)**
• Для уникальных технических решений
• Срок: 18-24 месяца, стоимость: от 50 000₽

**5. Режим коммерческой тайны**
• Утвердите положение о коммерческой тайне
• Составьте перечень конфиденциальной информации
• Ознакомьте сотрудников под подпись

**Частые ошибки:**
• Не оформлять права на код, написанный подрядчиками
• Не регистрировать товарный знак до запуска
• Обсуждать идею без NDA

⚠️ *Информационный характер. Не является юридической консультацией.*`;
  }

  return demoResponses.default;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Holds the AbortController for the current streaming request so the user
  // can hit Stop and we can cancel the upstream AI call.
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Stream the AI response into the placeholder assistant message identified
  // by `assistantId`. Updates the message content as deltas arrive.
  const streamAIResponse = async (
    allMessages: Message[],
    assistantId: string
  ): Promise<void> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const setAssistant = (
      mutator: (msg: Message) => Message
    ) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? mutator(m) : m))
      );

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      // Demo-mode and error responses come back as JSON, not SSE.
      const contentType = response.headers.get("Content-Type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.demo) {
          setAssistant((m) => ({
            ...m,
            content: getDemoResponse(
              allMessages[allMessages.length - 1].content
            ),
            streaming: false,
          }));
          return;
        }
        if (!response.ok) {
          throw new Error(data.error || `API error ${response.status}`);
        }
        // Unexpected JSON 200 — show whatever message field we got.
        setAssistant((m) => ({
          ...m,
          content: data.message ?? "",
          streaming: false,
        }));
        return;
      }

      if (!response.body) throw new Error("No response body");

      let receivedAnyDelta = false;
      for await (const event of parseSseStream(response.body)) {
        if (event.kind === "delta") {
          receivedAnyDelta = true;
          setAssistant((m) => ({ ...m, content: m.content + event.text }));
        } else if (event.kind === "error") {
          // If we already started streaming, append the error inline so the
          // user sees both the partial answer and what went wrong.
          setAssistant((m) => ({
            ...m,
            content:
              m.content +
              (receivedAnyDelta ? "\n\n" : "") +
              `⚠️ ${event.message}`,
            streaming: false,
          }));
          return;
        } else if (event.kind === "done") {
          break;
        }
        // 'usage' events carry token counts; we don't surface them in the UI yet.
      }

      setAssistant((m) => ({ ...m, streaming: false }));
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // User pressed Stop — keep whatever was streamed so far.
        setAssistant((m) => ({ ...m, streaming: false }));
        return;
      }
      // Total failure — fall back to a demo response so the chat doesn't
      // dead-end on a bare error.
      setAssistant((m) => ({
        ...m,
        content: getDemoResponse(allMessages[allMessages.length - 1].content),
        streaming: false,
      }));
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    const assistantId = (Date.now() + 1).toString();
    const assistantPlaceholder: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      streaming: true,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages([...updatedMessages, assistantPlaceholder]);
    setIsLoading(true);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    await streamAIResponse(updatedMessages, assistantId);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage(text);
  };

  const handleQuestionClick = async (question: string) => {
    setInput("");
    await sendMessage(question);
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main id="main-content" className="flex flex-1 flex-col bg-surface/30">
        {isEmpty ? (
          /* Empty state — welcome + suggested questions */
          <div className="flex flex-1 flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
                {/* Welcome */}
                <div className="mb-10 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-700 shadow-lg shadow-primary/20">
                    <MessageCircle className="h-8 w-8 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                    Юридический AI-консультант
                  </h1>
                  <p className="mt-2 text-muted max-w-lg mx-auto">
                    Задайте вопрос о законодательстве РФ — получите понятный ответ
                    с ссылками на статьи законов за секунды
                  </p>
                </div>

                {/* Suggested questions grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {suggestedQuestions.map((category, i) => (
                    <div
                      key={category.category}
                      className="animate-slide-up rounded-2xl border border-border bg-card p-5"
                      style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light">
                          <category.icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-bold text-foreground">
                          {category.category}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {category.questions.map((q) => (
                          <button
                            key={q}
                            onClick={() => handleQuestionClick(q)}
                            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm text-foreground transition-all hover:border-primary/30 hover:bg-primary-light/30 hover:shadow-sm"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Input bar (empty state) */}
            <div className="border-t border-border bg-card p-4">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-end gap-3 rounded-2xl border border-border bg-surface/50 p-2 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Задайте юридический вопрос..."
                    rows={1}
                    className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-center text-xs text-muted">
                  AI-консультант может допускать ошибки. Проверяйте важную информацию.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div className="flex flex-1 flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
                <div className="space-y-6">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3 animate-fade-in",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.role === "assistant" && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-700 mt-1">
                          <Scale className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-5 py-3.5",
                          message.role === "user"
                            ? "bg-primary text-white"
                            : "border border-border bg-card text-foreground"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <div className="prose-sm">
                            {message.content.split("\n").map((line, i) => {
                              if (line.startsWith("**") && line.endsWith("**")) {
                                return (
                                  <p key={i} className="font-bold mt-3 first:mt-0 mb-1">
                                    {line.replace(/\*\*/g, "")}
                                  </p>
                                );
                              }
                              if (line.startsWith("**")) {
                                const parts = line.split("**");
                                return (
                                  <p key={i} className="mt-2 first:mt-0 text-sm leading-relaxed">
                                    {parts.map((part, j) =>
                                      j % 2 === 1 ? (
                                        <strong key={j}>{part}</strong>
                                      ) : (
                                        <span key={j}>{part}</span>
                                      )
                                    )}
                                  </p>
                                );
                              }
                              if (line.startsWith("•") || line.startsWith("- ")) {
                                return (
                                  <p key={i} className="ml-3 text-sm leading-relaxed">
                                    {line}
                                  </p>
                                );
                              }
                              if (line.match(/^\d+\./)) {
                                const parts = line.split("**");
                                return (
                                  <p key={i} className="ml-3 text-sm leading-relaxed mt-1">
                                    {parts.map((part, j) =>
                                      j % 2 === 1 ? (
                                        <strong key={j}>{part}</strong>
                                      ) : (
                                        <span key={j}>{part}</span>
                                      )
                                    )}
                                  </p>
                                );
                              }
                              if (line.startsWith("⚠️")) {
                                return (
                                  <p key={i} className="mt-3 text-xs text-muted italic">
                                    {line}
                                  </p>
                                );
                              }
                              if (line.trim() === "") return <br key={i} />;
                              return (
                                <p key={i} className="text-sm leading-relaxed">
                                  {line}
                                </p>
                              );
                            })}
                            {message.streaming && message.content.length > 0 && (
                              <span
                                className="inline-block h-3.5 w-1 ml-0.5 align-middle bg-primary/70 animate-pulse"
                                aria-hidden
                              />
                            )}
                            {message.streaming && message.content.length === 0 && (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="text-sm text-muted">
                                  Анализирую ваш вопрос...
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed">{message.content}</p>
                        )}
                      </div>
                      {message.role === "user" && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-1">
                          <span className="text-xs font-bold text-primary">Вы</span>
                        </div>
                      )}
                    </div>
                  ))}

                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            {/* Input bar (chat state) */}
            <div className="border-t border-border bg-card p-4">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-end gap-3 rounded-2xl border border-border bg-surface/50 p-2 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleTextareaInput}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isLoading
                        ? "AI отвечает..."
                        : "Задайте следующий вопрос..."
                    }
                    rows={1}
                    disabled={isLoading}
                    className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none disabled:opacity-60"
                  />
                  {isLoading ? (
                    <button
                      onClick={handleStop}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger text-white transition-colors hover:bg-danger/90"
                      title="Остановить генерацию"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-center text-xs text-muted">
                  AI-консультант может допускать ошибки. Проверяйте важную информацию.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {isEmpty && <Disclaimer />}
    </div>
  );
}

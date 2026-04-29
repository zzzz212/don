"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { getTemplate } from "@/lib/templates";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle,
  Download,
  Copy,
  FileText,
} from "lucide-react";

export default function TemplateFillPage() {
  const params = useParams();
  const template = getTemplate(params.id as string);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!template) {
    return (
      <div className="flex min-h-full flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">
              Шаблон не найден
            </h1>
            <Link
              href="/templates"
              className="mt-4 inline-flex text-sm text-primary hover:underline"
            >
              Вернуться к шаблонам
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const handleChange = (id: string, value: string) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const isValid = template.fields
    .filter((f) => f.required)
    .every((f) => formData[f.id]?.trim());

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, data: formData }),
      });

      if (response.ok) {
        const result = await response.json();
        if (!result.demo && result.document) {
          setGeneratedDoc(result.document);
          setIsGenerating(false);
          return;
        }
      }
    } catch {
      // Fall through to local generation
    }

    // Local generation (demo fallback)
    const doc = generateMockDocument(template.id, formData);
    setGeneratedDoc(doc);
    setIsGenerating(false);
  };

  const handleCopy = async () => {
    if (generatedDoc) {
      await navigator.clipboard.writeText(generatedDoc);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadDocx = async () => {
    if (!generatedDoc || !template) return;

    try {
      const response = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: template.name,
          content: generatedDoc,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${template.name || "document"}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      alert("Ошибка при скачивании документа");
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/templates"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Все шаблоны
          </Link>

          {!generatedDoc ? (
            <div className="animate-fade-in">
              {/* Template header */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">
                  {template.name}
                </h1>
                <p className="mt-2 text-muted">{template.description}</p>
              </div>

              {/* Form */}
              <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
                <div className="space-y-5">
                  {template.fields.map((field) => (
                    <div key={field.id}>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        {field.label}
                        {field.required && (
                          <span className="ml-1 text-danger">*</span>
                        )}
                      </label>

                      {field.type === "textarea" ? (
                        <textarea
                          value={formData[field.id] || ""}
                          onChange={(e) =>
                            handleChange(field.id, e.target.value)
                          }
                          placeholder={field.placeholder}
                          rows={3}
                          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                      ) : field.type === "select" ? (
                        <select
                          value={formData[field.id] || ""}
                          onChange={(e) =>
                            handleChange(field.id, e.target.value)
                          }
                          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">Выберите...</option>
                          {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          value={formData[field.id] || ""}
                          onChange={(e) =>
                            handleChange(field.id, e.target.value)
                          }
                          placeholder={field.placeholder}
                          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleGenerate}
                    disabled={!isValid || isGenerating}
                    className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        AI генерирует документ...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Сгенерировать документ
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Generated document */
            <div className="animate-fade-in">
              {/* Success header */}
              <div className="mb-6 flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-4">
                <CheckCircle className="h-5 w-5 text-success shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">
                    Документ успешно сгенерирован
                  </p>
                  <p className="text-sm text-green-700">
                    Проверьте содержание и скачайте готовый документ
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <FileText className="h-5 w-5 text-primary" />
                  {template.name}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-success" />
                        Скопировано
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Копировать
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadDocx}
                    className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                  >
                    <Download className="h-4 w-4" />
                    Скачать DOCX
                  </button>
                </div>
              </div>

              {/* Document preview */}
              <div className="rounded-2xl border border-border bg-white p-8 sm:p-10 shadow-sm">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-foreground">
                  {generatedDoc}
                </pre>
              </div>

              {/* Generate another */}
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={() => setGeneratedDoc(null)}
                  className="rounded-xl border border-border bg-white px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
                >
                  Редактировать данные
                </button>
                <Link
                  href="/templates"
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  Создать другой документ
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}

function generateMockDocument(
  templateId: string,
  data: Record<string, string>
): string {
  const today = new Date().toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  switch (templateId) {
    case "nda":
      return `СОГЛАШЕНИЕ О НЕРАЗГЛАШЕНИИ
КОНФИДЕНЦИАЛЬНОЙ ИНФОРМАЦИИ (NDA)

г. Москва                                                    ${today}

${data.disclosingParty || "_______________"}, ИНН ${data.disclosingInn || "_______________"}, именуемое в дальнейшем «Раскрывающая сторона», с одной стороны, и

${data.receivingParty || "_______________"}, ИНН ${data.receivingInn || "_______________"}, именуемое в дальнейшем «Получающая сторона», с другой стороны,

совместно именуемые «Стороны», заключили настоящее Соглашение о нижеследующем:

1. ПРЕДМЕТ СОГЛАШЕНИЯ

1.1. Получающая сторона обязуется не разглашать конфиденциальную информацию, полученную от Раскрывающей стороны, и использовать её исключительно в целях совместного сотрудничества.

1.2. К конфиденциальной информации относится:
${data.subject || "Информация, составляющая коммерческую тайну."}

2. ОБЯЗАТЕЛЬСТВА СТОРОН

2.1. Получающая сторона обязуется:
   а) не раскрывать конфиденциальную информацию третьим лицам без письменного согласия Раскрывающей стороны;
   б) использовать конфиденциальную информацию исключительно в целях, определённых настоящим Соглашением;
   в) обеспечить защиту конфиденциальной информации от несанкционированного доступа;
   г) немедленно уведомить Раскрывающую сторону о любом факте несанкционированного доступа к конфиденциальной информации.

2.2. Не является нарушением раскрытие информации по требованию государственных органов в порядке, установленном законодательством РФ.

3. СРОК ДЕЙСТВИЯ

3.1. Настоящее Соглашение вступает в силу с момента подписания и действует ${data.duration === "indefinite" ? "бессрочно" : `в течение ${data.duration} ${Number(data.duration) === 1 ? "года" : "лет"}`}.

3.2. Обязательства по сохранению конфиденциальности сохраняются в течение 3 (трёх) лет после прекращения действия настоящего Соглашения.

4. ОТВЕТСТВЕННОСТЬ

4.1. В случае нарушения условий настоящего Соглашения Получающая сторона обязуется выплатить Раскрывающей стороне штраф в размере ${Number(data.penalty || 0).toLocaleString("ru-RU")} (${numberToWords(Number(data.penalty || 0))}) рублей.

4.2. Выплата штрафа не освобождает от обязанности возместить убытки, причинённые разглашением конфиденциальной информации, в полном объёме.

5. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ

5.1. Настоящее Соглашение составлено в двух экземплярах, имеющих одинаковую юридическую силу, по одному для каждой из Сторон.

5.2. Все споры разрешаются путём переговоров, а при недостижении согласия — в арбитражном суде по месту нахождения истца.

ПОДПИСИ СТОРОН:

Раскрывающая сторона:                    Получающая сторона:
${data.disclosingParty || "_______________"}                    ${data.receivingParty || "_______________"}

_________________/___________/           _________________/___________/
           М.П.                                     М.П.`;

    case "lease":
      return `ДОГОВОР АРЕНДЫ НЕЖИЛОГО ПОМЕЩЕНИЯ

г. Москва                                                    ${today}

${data.landlord || "_______________"}, ИНН ${data.landlordInn || "_______________"}, именуемое в дальнейшем «Арендодатель», с одной стороны, и

${data.tenant || "_______________"}, ИНН ${data.tenantInn || "_______________"}, именуемое в дальнейшем «Арендатор», с другой стороны,

заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА

1.1. Арендодатель передаёт, а Арендатор принимает во временное владение и пользование нежилое помещение, расположенное по адресу: ${data.address || "_______________"}, общей площадью ${data.area || "___"} кв.м.

1.2. Помещение предоставляется для использования в целях осуществления предпринимательской деятельности Арендатора.

2. СРОК АРЕНДЫ

2.1. Срок аренды составляет ${data.duration || "___"} месяцев с даты подписания акта приёма-передачи помещения.

2.2. Дата начала аренды: ${data.startDate || "_______________"}.

2.3. Арендатор имеет преимущественное право на заключение договора на новый срок при надлежащем исполнении обязательств.

3. АРЕНДНАЯ ПЛАТА

3.1. Арендная плата составляет ${Number(data.rent || 0).toLocaleString("ru-RU")} (${numberToWords(Number(data.rent || 0))}) рублей в месяц, включая НДС.

3.2. Арендная плата вносится не позднее 5-го числа текущего месяца.

${data.deposit ? `3.3. Арендатор вносит обеспечительный платёж в размере ${Number(data.deposit).toLocaleString("ru-RU")} (${numberToWords(Number(data.deposit))}) рублей, который возвращается при расторжении договора за вычетом задолженности.` : ""}

3.4. Арендная плата может быть изменена не чаще одного раза в год и не более чем на величину индекса потребительских цен.

4. ПРАВА И ОБЯЗАННОСТИ СТОРОН

4.1. Арендодатель обязуется:
   а) передать помещение в надлежащем состоянии;
   б) не препятствовать использованию помещения;
   в) производить капитальный ремонт за свой счёт.

4.2. Арендатор обязуется:
   а) использовать помещение по назначению;
   б) своевременно вносить арендную плату;
   в) содержать помещение в надлежащем состоянии.

5. РАСТОРЖЕНИЕ ДОГОВОРА

5.1. Каждая сторона вправе расторгнуть договор, уведомив другую сторону не менее чем за 60 (шестьдесят) дней.

5.2. Договор составлен в двух экземплярах, по одному для каждой Стороны.

ПОДПИСИ СТОРОН:

Арендодатель:                              Арендатор:
${data.landlord || "_______________"}                              ${data.tenant || "_______________"}

_________________/___________/           _________________/___________/
           М.П.                                     М.П.`;

    case "sale":
      return `ДОГОВОР КУПЛИ-ПРОДАЖИ

г. Москва                                                    ${today}

${data.seller || "_______________"}, ИНН ${data.sellerInn || "_______________"}, именуемое в дальнейшем «Продавец», с одной стороны, и

${data.buyer || "_______________"}, ИНН ${data.buyerInn || "_______________"}, именуемое в дальнейшем «Покупатель», с другой стороны,

заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА

1.1. Продавец обязуется передать в собственность Покупателя, а Покупатель — принять и оплатить следующий товар:
${data.subject || "_______________"}

2. ЦЕНА И ПОРЯДОК РАСЧЁТОВ

2.1. Цена товара составляет ${Number(data.price || 0).toLocaleString("ru-RU")} (${numberToWords(Number(data.price || 0))}) рублей, включая НДС.

2.2. Условия оплаты: ${getPaymentLabel(data.paymentTerms)}.

3. СРОКИ И ПОРЯДОК ПЕРЕДАЧИ

3.1. Продавец обязуется передать товар Покупателю не позднее ${data.deliveryDate || "_______________"}.

3.2. Передача товара оформляется актом приёма-передачи, подписываемым обеими Сторонами.

3.3. Право собственности переходит к Покупателю в момент подписания акта приёма-передачи.

4. ГАРАНТИИ

4.1. Продавец гарантирует, что товар принадлежит ему на праве собственности и не обременён правами третьих лиц.

${data.warranty && data.warranty !== "0" ? `4.2. Гарантийный срок на товар составляет ${data.warranty} месяцев с момента передачи.` : "4.2. Товар продаётся без гарантии качества."}

5. ОТВЕТСТВЕННОСТЬ СТОРОН

5.1. За нарушение сроков оплаты Покупатель уплачивает неустойку в размере 0.1% от суммы задолженности за каждый день просрочки.

5.2. За нарушение сроков передачи товара Продавец уплачивает неустойку в размере 0.1% от стоимости товара за каждый день просрочки.

6. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ

6.1. Договор составлен в двух экземплярах, по одному для каждой Стороны.

ПОДПИСИ СТОРОН:

Продавец:                                  Покупатель:
${data.seller || "_______________"}                                  ${data.buyer || "_______________"}

_________________/___________/           _________________/___________/
           М.П.                                     М.П.`;

    case "service":
      return `ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ

г. Москва                                                    ${today}

${data.client || "_______________"}, ИНН ${data.clientInn || "_______________"}, именуемое в дальнейшем «Заказчик», с одной стороны, и

${data.contractor || "_______________"}, ИНН ${data.contractorInn || "_______________"}, именуемое в дальнейшем «Исполнитель», с другой стороны,

заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА

1.1. Исполнитель обязуется по заданию Заказчика оказать следующие услуги:
${data.services || "_______________"}

1.2. Заказчик обязуется оплатить оказанные услуги в порядке и сроки, предусмотренные настоящим Договором.

2. СТОИМОСТЬ УСЛУГ И ПОРЯДОК РАСЧЁТОВ

2.1. Стоимость услуг составляет ${Number(data.price || 0).toLocaleString("ru-RU")} (${numberToWords(Number(data.price || 0))}) рублей.

2.2. Условия оплаты: ${getPaymentLabel(data.paymentTerms)}.

3. СРОКИ ОКАЗАНИЯ УСЛУГ

3.1. Исполнитель обязуется оказать услуги в срок до ${data.deadline || "_______________"}.

3.2. Оказание услуг подтверждается подписанием акта оказанных услуг.

4. ПРАВА И ОБЯЗАННОСТИ СТОРОН

4.1. Исполнитель обязуется:
   а) оказать услуги качественно и в срок;
   б) по требованию Заказчика предоставлять отчёт о ходе оказания услуг.

4.2. Заказчик обязуется:
   а) предоставить Исполнителю необходимую информацию и материалы;
   б) своевременно оплатить оказанные услуги.

5. ОТВЕТСТВЕННОСТЬ

5.1. За нарушение сроков оказания услуг Исполнитель уплачивает неустойку в размере 0.1% от стоимости услуг за каждый день просрочки, но не более 10% от общей стоимости.

6. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ

6.1. Договор составлен в двух экземплярах.

ПОДПИСИ СТОРОН:

Заказчик:                                  Исполнитель:
${data.client || "_______________"}                                  ${data.contractor || "_______________"}

_________________/___________/           _________________/___________/
           М.П.                                     М.П.`;

    case "employment":
      return `ТРУДОВОЙ ДОГОВОР

г. Москва                                                    ${today}

${data.employer || "_______________"}, ИНН ${data.employerInn || "_______________"}, именуемое в дальнейшем «Работодатель», в лице генерального директора, действующего на основании Устава, с одной стороны, и

${data.employee || "_______________"}, именуемый(-ая) в дальнейшем «Работник», с другой стороны,

заключили настоящий трудовой договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА

1.1. Работник принимается на должность: ${data.position || "_______________"}.

1.2. Настоящий Договор является договором по основному месту работы.

1.3. Дата начала работы: ${data.startDate || "_______________"}.

${data.probation && data.probation !== "0" ? `1.4. Работнику устанавливается испытательный срок продолжительностью ${data.probation} месяц(а/ев).` : "1.4. Испытательный срок не устанавливается."}

2. ОПЛАТА ТРУДА

2.1. Должностной оклад Работника составляет ${Number(data.salary || 0).toLocaleString("ru-RU")} (${numberToWords(Number(data.salary || 0))}) рублей в месяц до вычета НДФЛ.

2.2. Заработная плата выплачивается два раза в месяц: 20-го числа (аванс) и 5-го числа следующего месяца (окончательный расчёт).

3. РЕЖИМ РАБОТЫ

3.1. Режим работы: ${getScheduleLabel(data.schedule)}.

3.2. Работнику предоставляется ежегодный оплачиваемый отпуск продолжительностью 28 календарных дней.

4. ПРАВА И ОБЯЗАННОСТИ СТОРОН

4.1. Работодатель обязуется:
   а) обеспечить условия труда, предусмотренные ТК РФ;
   б) выплачивать заработную плату в установленные сроки;
   в) обеспечить обязательное социальное страхование.

4.2. Работник обязуется:
   а) добросовестно исполнять трудовые обязанности;
   б) соблюдать правила внутреннего трудового распорядка;
   в) бережно относиться к имуществу Работодателя.

5. ПРЕКРАЩЕНИЕ ДОГОВОРА

5.1. Настоящий Договор может быть прекращён по основаниям, предусмотренным ТК РФ.

6. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ

6.1. Договор составлен в двух экземплярах.

ПОДПИСИ СТОРОН:

Работодатель:                              Работник:
${data.employer || "_______________"}                              ${data.employee || "_______________"}

_________________/___________/           _________________/___________/
           М.П.`;

    case "supply":
      return `ДОГОВОР ПОСТАВКИ

г. Москва                                                    ${today}

${data.supplier || "_______________"}, ИНН ${data.supplierInn || "_______________"}, именуемое в дальнейшем «Поставщик», с одной стороны, и

${data.buyer || "_______________"}, ИНН ${data.buyerInn || "_______________"}, именуемое в дальнейшем «Покупатель», с другой стороны,

заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА

1.1. Поставщик обязуется поставлять, а Покупатель обязуется принимать и оплачивать следующий товар:
${data.goods || "_______________"}

1.2. Общая сумма поставки составляет ${Number(data.totalAmount || 0).toLocaleString("ru-RU")} (${numberToWords(Number(data.totalAmount || 0))}) рублей.

2. УСЛОВИЯ И СРОКИ ПОСТАВКИ

2.1. Периодичность поставок: ${data.deliveryFrequency || "ежемесячно"}.

2.2. Товар поставляется в порядке, определённом Сторонами, с надлежащей упаковкой и маркировкой.

2.3. Риск случайной гибели товара переходит на Покупателя с момента передачи товара, оформленной актом приёма-передачи.

3. СРОКИ И ПОРЯДОК ПЛАТЕЖА

3.1. Оплата производится в течение 10 (десяти) банковских дней после получения счёта-фактуры.

3.2. Платежи осуществляются на счёт Поставщика по реквизитам, указанным в счёте-фактуре.

4. СРОКИ ДЕЙСТВИЯ

4.1. Договор действует в течение ${data.duration || "12"} месяцев с даты подписания.

4.2. После окончания срока действия Договор может быть продлён по согласию Сторон на аналогичных условиях.

5. ОТВЕТСТВЕННОСТЬ СТОРОН

5.1. За нарушение сроков поставки Поставщик уплачивает неустойку в размере 0.5% от стоимости просроченного товара за каждый день просрочки.

5.2. За нарушение сроков оплаты Покупатель уплачивает неустойку в размере 0.1% от суммы задолженности за каждый день просрочки.

6. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ

6.1. Договор составлен в двух экземплярах.

ПОДПИСИ СТОРОН:

Поставщик:                                 Покупатель:
${data.supplier || "_______________"}                                 ${data.buyer || "_______________"}

_________________/___________/           _________________/___________/
           М.П.`;

    case "loan":
      return `ДОГОВОР ЗАЙМА

г. Москва                                                    ${today}

${data.lender || "_______________"}, ИНН ${data.lenderInn || "_______________"}, именуемое в дальнейшем «Займодавец», с одной стороны, и

${data.borrower || "_______________"}, ИНН ${data.borrowerInn || "_______________"}, именуемое в дальнейшем «Заёмщик», с другой стороны,

заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА

1.1. Займодавец обязуется передать Заёмщику в собственность денежную сумму в размере ${Number(data.amount || 0).toLocaleString("ru-RU")} (${numberToWords(Number(data.amount || 0))}) рублей, а Заёмщик обязуется возвратить полученную сумму в установленный срок.

1.2. Передача денежных средств оформляется распиской Заёмщика о получении.

2. УСЛОВИЯ ВОЗВРАТА

2.1. Срок возврата займа: ${data.returnDate || "_______________"}.

2.2. Порядок возврата: ${getReturnMethodLabel(data.returnMethod)}.

2.3. Процентная ставка: ${getInterestLabel(data.interestRate)}.

3. ПРАВА И ОБЯЗАННОСТИ СТОРОН

3.1. Займодавец имеет право требовать возврата займа с процентами в установленные сроки.

3.2. Заёмщик обязуется:
   а) своевременно возвращать заём и проценты;
   б) уведомлять Займодавца об изменении реквизитов для платежа.

3.3. Заём может быть возвращен досрочно без штрафных санкций.

4. ОТВЕТСТВЕННОСТЬ

4.1. За нарушение сроков возврата Заёмщик уплачивает неустойку в размере 0.5% от суммы задолженности за каждый день просрочки.

4.2. Неустойка не освобождает Заёмщика от обязанности уплатить проценты.

5. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ

5.1. Договор составлен в двух экземплярах.

ПОДПИСИ СТОРОН:

Займодавец:                                Заёмщик:
${data.lender || "_______________"}                                ${data.borrower || "_______________"}

_________________/___________/           _________________/___________/
           М.П.`;

    case "agency":
      return `АГЕНТСКИЙ ДОГОВОР

г. Москва                                                    ${today}

${data.principal || "_______________"}, ИНН ${data.principalInn || "_______________"}, именуемое в дальнейшем «Принципал», с одной стороны, и

${data.agent || "_______________"}, ИНН ${data.agentInn || "_______________"}, именуемое в дальнейшем «Агент», с другой стороны,

заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА

1.1. Агент обязуется по поручению Принципала совершать следующие действия:
${data.subject || "_______________"}

1.2. Агент действует ${data.actingAs === "own_name" ? "от своего имени, но в интересах Принципала" : "от имени Принципала"}.

2. АГЕНТСКОЕ ВОЗНАГРАЖДЕНИЕ

2.1. За выполнение обязанностей по настоящему Договору Агент получает вознаграждение в размере ${data.commission || "10"}% от стоимости заключённых им сделок.

2.2. Вознаграждение выплачивается в течение 5 (пяти) банковских дней после получения Принципалом платежа.

2.3. Агент имеет право на возмещение расходов, произведённых при исполнении Договора, с предварительного согласия Принципала.

3. СРОК ДЕЙСТВИЯ

3.1. Договор действует в течение ${data.duration === "indefinite" ? "бессрочно" : `${data.duration} месяцев`} с даты подписания.

3.2. Каждая Сторона вправе расторгнуть Договор, уведомив другую Сторону за 30 (тридцать) дней.

4. ПРАВА И ОБЯЗАННОСТИ СТОРОН

4.1. Агент обязуется:
   а) добросовестно исполнять поручение Принципала;
   б) предоставлять отчёты о выполнении Договора;
   в) хранить конфиденциальность сведений Принципала.

4.2. Принципал обязуется:
   а) своевременно выплачивать агентское вознаграждение;
   б) возмещать документально подтвёрженные расходы Агента.

5. ОТВЕТСТВЕННОСТЬ

5.1. Агент несёт ответственность за надлежащее исполнение поручения Принципала.

5.2. За невыполнение Договора стороны уплачивают штраф в размере, определённом Договором.

6. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ

6.1. Договор составлен в двух экземплярах.

ПОДПИСИ СТОРОН:

Принципал:                                 Агент:
${data.principal || "_______________"}                                 ${data.agent || "_______________"}

_________________/___________/           _________________/___________/
           М.П.`;

    case "contractor":
      return `ДОГОВОР ПОДРЯДА

г. Москва                                                    ${today}

${data.customer || "_______________"}, ИНН ${data.customerInn || "_______________"}, именуемое в дальнейшем «Заказчик», с одной стороны, и

${data.contractor || "_______________"}, ИНН ${data.contractorInn || "_______________"}, именуемое в дальнейшем «Подрядчик», с другой стороны,

заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА

1.1. Подрядчик обязуется выполнить следующие работы:
${data.work || "_______________"}

1.2. Материалы предоставляет: ${data.materials === "customer" ? "Заказчик" : data.materials === "both" ? "каждая Сторона в установленной доле" : "Подрядчик"}.

1.3. Результат работ должен соответствовать описанию, качеству и техническим требованиям, согласованным Сторонами.

2. ЦЕНА И ПОРЯДОК РАСЧЁТОВ

2.1. Стоимость работ составляет ${Number(data.price || 0).toLocaleString("ru-RU")} (${numberToWords(Number(data.price || 0))}) рублей.

2.2. Оплата производится в течение 5 (пяти) банковских дней после подписания акта приёмки-сдачи работ.

3. СРОКИ ВЫПОЛНЕНИЯ РАБОТ

3.1. Дата начала работ: ${data.startDate || "_______________"}.

3.2. Дата окончания работ (крайний срок): ${data.endDate || "_______________"}.

3.3. За нарушение сроков выполнения Подрядчик уплачивает неустойку в размере 0.5% от стоимости работ за каждый день просрочки.

4. ГАРАНТИИ

4.1. Подрядчик гарантирует надлежащее качество выполненных работ.

4.2. Гарантийный срок на результат работ: ${data.warranty || "0"} месяцев с момента приёмки-сдачи.

4.3. Подрядчик обязуется устранять недостатки, выявленные в течение гарантийного срока, за свой счёт.

5. ПРАВА И ОБЯЗАННОСТИ СТОРОН

5.1. Подрядчик обязуется:
   а) выполнить работы надлежащего качества;
   б) содержать место выполнения работ в надлежащем санитарном состоянии;
   в) соблюдать требования безопасности при выполнении работ.

5.2. Заказчик обязуется:
   а) своевременно оплачивать выполненные работы;
   б) предоставить свободный доступ на место выполнения работ;
   в) своевременно предоставить материалы (если это его обязанность).

6. ПРИЁМКА И СДАЧА РАБОТ

6.1. Завершённые работы оформляются актом приёмки-сдачи, подписываемым обеими Сторонами.

6.2. Работы считаются выполненными с момента подписания акта приёмки-сдачи.

7. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ

7.1. Договор составлен в двух экземплярах.

ПОДПИСИ СТОРОН:

Заказчик:                                  Подрядчик:
${data.customer || "_______________"}                                  ${data.contractor || "_______________"}

_________________/___________/           _________________/___________/
           М.П.`;

    default:
      return "Документ не найден.";
  }
}

function getPaymentLabel(value: string): string {
  const map: Record<string, string> = {
    prepaid: "100% предоплата в течение 5 банковских дней с момента подписания Договора",
    postpaid: "оплата в течение 5 банковских дней после подписания акта приёма-передачи",
    partial: "50% предоплата, 50% — после подписания акта приёма-передачи",
    installments: "рассрочка в соответствии с графиком платежей (Приложение №1)",
    milestone: "поэтапная оплата по завершении каждого этапа работ",
  };
  return map[value] || "в порядке, определённом Сторонами";
}

function getScheduleLabel(value: string): string {
  const map: Record<string, string> = {
    full: "полный рабочий день, пятидневная рабочая неделя с 09:00 до 18:00, выходные — суббота и воскресенье",
    shift: "сменный график работы согласно утверждённому графику сменности",
    remote: "дистанционная (удалённая) работа",
    flexible: "гибкий рабочий график с обязательным присутствием с 11:00 до 16:00",
  };
  return map[value] || "определяется правилами внутреннего трудового распорядка";
}

function getInterestLabel(value: string): string {
  const map: Record<string, string> = {
    "0": "беспроцентный займ",
    "5": "5% годовых",
    "10": "10% годовых",
    "15": "15% годовых",
    key: "равна ключевой ставке Центрального банка Российской Федерации на дату передачи займа",
  };
  return map[value] || "определяется Сторонами";
}

function getReturnMethodLabel(value: string): string {
  const map: Record<string, string> = {
    lumpsum: "единовременно в конце срока действия Договора",
    monthly: "ежемесячными платежами равными долями",
    quarterly: "ежеквартальными платежами равными долями",
  };
  return map[value] || "определяется Сторонами";
}

function numberToWords(n: number): string {
  if (n === 0) return "ноль";
  // Simplified number-to-words for demo
  const formatted = n.toLocaleString("ru-RU");
  return `${formatted}`;
}

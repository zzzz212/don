import { generateAI, getActiveProvider } from "./client";
import { ANALYZE_CONTRACT_SYSTEM_PROMPT } from "./prompts";

export interface AnalysisRisk {
  clauseNumber: string;
  clauseTitle: string;
  level: "critical" | "medium" | "low";
  description: string;
  legalReference: string;
  originalText: string;
  recommendedText: string;
  recommendation: string;
}

export interface NotarizationInfo {
  required: boolean;
  reason: string;
}

export interface RegistrationInfo {
  required: boolean;
  reason: string;
}

export interface AnalysisResult {
  score: number;
  summary: string;
  contractType: string;
  parties: string;
  risks: AnalysisRisk[];
  notarization: NotarizationInfo;
  registration: RegistrationInfo;
  missingClauses: string[];
  preSigningChecklist: string[];
  isDemo?: boolean;
}

export async function analyzeContract(
  contractText: string
): Promise<AnalysisResult> {
  if (getActiveProvider() === "demo") {
    return generateDemoAnalysis(contractText);
  }

  const response = await generateAI(
    ANALYZE_CONTRACT_SYSTEM_PROMPT,
    `Проанализируй следующий договор и найди все юридические риски:\n\n${contractText}`,
    4096
  );

  let jsonText = response.text.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
  }

  const result: AnalysisResult = JSON.parse(jsonText);
  return result;
}

function generateDemoAnalysis(contractText: string): AnalysisResult {
  const textLength = contractText.length;

  const isLease = /аренд|арендатор|арендодатель|помещени/i.test(contractText);
  const isSale = /купл|продаж|покупатель|продавец|товар/i.test(contractText);
  const isEmployment = /трудов|работник|работодатель|зарплат/i.test(contractText);
  const isService = /услуг|исполнитель|заказчик/i.test(contractText);
  const isNda = /конфиденциальн|разглашен|секрет|nda/i.test(contractText);

  const risks: AnalysisRisk[] = [];

  if (/одностороnn|в одностороннем порядке/i.test(contractText)) {
    risks.push({
      clauseNumber: "Условие об одностороннем расторжении",
      clauseTitle: "Односторонний отказ",
      level: "critical",
      description:
        "Условие об одностороннем отказе от договора без симметричного права у второй стороны создаёт дисбаланс.",
      legalReference: "ст. 450.1 ГК РФ",
      originalText: "В тексте договора найдено упоминание одностороннего отказа",
      recommendedText:
        "Каждая Сторона вправе в одностороннем внесудебном порядке отказаться от исполнения настоящего Договора, направив другой Стороне письменное уведомление не менее чем за 30 (тридцать) календарных дней до предполагаемой даты расторжения.",
      recommendation:
        "Сделать право на расторжение симметричным с уведомлением за 30 дней.",
    });
  }

  if (/штраф|неустойк|пен[яи]/i.test(contractText)) {
    risks.push({
      clauseNumber: "Раздел об ответственности",
      clauseTitle: "Размер неустойки",
      level: "medium",
      description:
        "Договор содержит условия о штрафных санкциях. Размер неустойки может быть признан несоразмерным.",
      legalReference: "ст. 333 ГК РФ",
      originalText: "В договоре указан размер неустойки",
      recommendedText:
        "За нарушение сроков исполнения обязательств виновная Сторона уплачивает другой Стороне неустойку в размере 0,1% (одной десятой процента) от суммы неисполненного обязательства за каждый день просрочки, но не более 10% от суммы договора.",
      recommendation:
        "Установить неустойку 0,1% в день с потолком 10% от суммы договора.",
    });
  }

  if (isLease && risks.length < 4) {
    risks.push({
      clauseNumber: "Раздел об арендной плате",
      clauseTitle: "Индексация арендной платы",
      level: "medium",
      description:
        "Не определён предельный размер индексации, что позволяет арендодателю произвольно повышать плату.",
      legalReference: "ст. 614 ГК РФ",
      originalText: "Условие об индексации в договоре",
      recommendedText:
        "Размер арендной платы может быть изменён Арендодателем не чаще одного раза в год путём индексации на размер официального ИПЦ Росстата за предыдущий календарный год, но не более чем на 7% (семь процентов).",
      recommendation: "Зафиксировать максимум индексации — ИПЦ или 7% в год.",
    });
  }

  if (isSale && risks.length < 4) {
    risks.push({
      clauseNumber: "Раздел о гарантии",
      clauseTitle: "Гарантийный срок",
      level: "medium",
      description:
        "Не установлен или не чётко определён гарантийный срок на товар.",
      legalReference: "ст. 470-477 ГК РФ",
      originalText: "Условия гарантии в договоре",
      recommendedText:
        "Продавец гарантирует качество Товара в течение 12 (двенадцати) месяцев со дня передачи Покупателю. В течение гарантийного срока Продавец обязан безвозмездно устранить недостатки или заменить Товар в течение 14 (четырнадцати) рабочих дней с момента получения письменной претензии.",
      recommendation: "Установить гарантию 12 месяцев и срок реакции 14 дней.",
    });
  }

  if (risks.length < 3) {
    risks.push({
      clauseNumber: "Отсутствует",
      clauseTitle: "Порядок претензионного урегулирования",
      level: "low",
      description:
        "В договоре не определён обязательный претензионный порядок, что может затянуть разрешение споров.",
      legalReference: "ст. 4 АПК РФ",
      originalText: "Пункт в договоре отсутствует",
      recommendedText:
        "До обращения в суд Стороны обязуются урегулировать возникшие разногласия путём направления письменной претензии. Срок ответа на претензию — 30 (тридцать) календарных дней с момента её получения. Претензия направляется заказным письмом с уведомлением или нарочно с отметкой о получении.",
      recommendation:
        "Добавить претензионный порядок со сроком ответа 30 дней.",
    });
  }

  if (risks.length === 0) {
    risks.push({
      clauseNumber: "Общая оценка",
      clauseTitle: "Демо-режим",
      level: "low",
      description:
        "Автоматический анализ не обнаружил явных рисков. Для полноценного анализа подключите AI-модель.",
      legalReference: "—",
      originalText: "—",
      recommendedText: "—",
      recommendation: "Добавьте GROQ_API_KEY или GEMINI_API_KEY в .env.",
    });
  }

  const criticalCount = risks.filter((r) => r.level === "critical").length;
  const mediumCount = risks.filter((r) => r.level === "medium").length;
  const lowCount = risks.filter((r) => r.level === "low").length;
  const score = Math.max(
    1,
    Math.min(10, Math.round(10 - criticalCount * 2 - mediumCount * 1 - lowCount * 0.5))
  );

  const contractType = isLease
    ? "Договор аренды"
    : isSale
      ? "Договор купли-продажи"
      : isEmployment
        ? "Трудовой договор"
        : isService
          ? "Договор оказания услуг"
          : isNda
            ? "Соглашение о конфиденциальности (NDA)"
            : "Договор";

  const summary =
    criticalCount > 0
      ? `${contractType} содержит ${criticalCount} критичных и ${mediumCount} средних рисков. Подписывать в текущей редакции не рекомендуется.`
      : mediumCount > 0
        ? `${contractType} в целом приемлем, но содержит ${mediumCount} замечаний, которые рекомендуется устранить.`
        : `${contractType} не содержит явных рисков по автоматической проверке.`;

  return {
    score,
    summary,
    contractType,
    parties: "Стороны не определены автоматически (демо-режим)",
    risks,
    notarization: {
      required: isLease || isEmployment ? false : false,
      reason:
        "Не требуется по ст. 161 ГК РФ — простой письменной формы достаточно. Нотариальное заверение по желанию Сторон может усилить доказательственную силу.",
    },
    registration: {
      required: isLease,
      reason: isLease
        ? "Если срок аренды недвижимости 1 год и более — обязательна государственная регистрация в Росреестре по ст. 651 ГК РФ."
        : "Не требуется для данного типа договора.",
    },
    missingClauses: [
      "Чёткое определение порядка досрочного расторжения",
      "Конкретные сроки исполнения обязательств",
      "Порядок претензионного урегулирования споров",
    ],
    preSigningChecklist: [
      "Запросить выписку из ЕГРЮЛ/ЕГРИП контрагента не старше 30 дней",
      "Проверить полномочия подписанта (доверенность, устав, приказ о назначении)",
      "Уточнить актуальность банковских реквизитов в банке",
      "Сверить ИНН/ОГРН на сайте ФНС (egrul.nalog.ru)",
      `Документ объёмом ${textLength} символов — внимательно перечитать перед подписанием`,
    ],
    isDemo: true,
  };
}

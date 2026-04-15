import { generateAI, getActiveProvider } from "./client";
import { ANALYZE_CONTRACT_SYSTEM_PROMPT } from "./prompts";

export interface AnalysisRisk {
  clause: string;
  level: "critical" | "medium" | "low";
  description: string;
  recommendation: string;
}

export interface AnalysisResult {
  score: number;
  summary: string;
  risks: AnalysisRisk[];
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

  const result: AnalysisResult = JSON.parse(response.text);

  return result;
}

/**
 * Generate a realistic demo analysis based on the actual document text.
 * Used when ANTHROPIC_API_KEY is not configured.
 */
function generateDemoAnalysis(contractText: string): AnalysisResult {
  const textLower = contractText.toLowerCase();
  const textLength = contractText.length;

  // Detect contract type from text
  const isLease = /аренд|арендатор|арендодатель|помещени/i.test(contractText);
  const isSale = /купл|продаж|покупатель|продавец|товар/i.test(contractText);
  const isEmployment = /трудов|работник|работодатель|зарплат/i.test(contractText);
  const isService = /услуг|исполнитель|заказчик/i.test(contractText);
  const isNda = /конфиденциальн|разглашен|секрет|nda/i.test(contractText);

  const risks: AnalysisRisk[] = [];

  // Check for common risky patterns in the actual text
  if (/одностороnn|в одностороннем порядке/i.test(contractText)) {
    risks.push({
      clause: "Односторонний отказ от договора",
      level: "critical",
      description:
        "Обнаружено условие об одностороннем отказе от договора. Это может создавать дисбаланс прав сторон, если право предоставлено только одной стороне.",
      recommendation:
        "Убедитесь, что право одностороннего отказа симметрично для обеих сторон. Установите разумный срок уведомления (не менее 30 дней).",
    });
  }

  if (/штраф|неустойк|пен[яи]/i.test(contractText)) {
    risks.push({
      clause: "Штрафные санкции",
      level: "medium",
      description:
        "Договор содержит условия о штрафных санкциях. Необходимо проверить их соразмерность возможным нарушениям (ст. 333 ГК РФ).",
      recommendation:
        "Проверьте, чтобы размер неустойки не превышал разумных пределов. Рекомендуемый максимум — 0.1-0.5% в день.",
    });
  }

  if (/форс-мажор|непреодолим|обстоятельств/i.test(contractText)) {
    risks.push({
      clause: "Форс-мажорные обстоятельства",
      level: "low",
      description:
        "Договор содержит положения о форс-мажоре. Убедитесь, что перечень обстоятельств достаточно полный и процедура уведомления чётко прописана.",
      recommendation:
        "Рекомендуется указать конкретный срок уведомления о форс-мажоре и перечень подтверждающих документов.",
    });
  }

  if (/подсудност|арбитраж|суд/i.test(contractText)) {
    risks.push({
      clause: "Подсудность споров",
      level: "low",
      description:
        "Установлена договорная подсудность. Проверьте, удобно ли вам рассмотрение споров в указанном суде.",
      recommendation:
        "Если контрагент в другом регионе, рассмотрите вариант подсудности по месту исполнения договора.",
    });
  }

  // Type-specific risks
  if (isLease) {
    if (risks.length < 2) {
      risks.push({
        clause: "Условия аренды",
        level: "medium",
        description:
          "В договоре аренды рекомендуется чётко прописать порядок индексации арендной платы, ответственность за текущий и капитальный ремонт, а также условия возврата обеспечительного платежа.",
        recommendation:
          "Установите фиксированный максимум индексации (например, не более ИПЦ + 2%). Разграничьте ответственность за ремонт согласно ст. 616 ГК РФ.",
      });
    }
  }

  if (isSale) {
    if (risks.length < 2) {
      risks.push({
        clause: "Гарантийные обязательства",
        level: "medium",
        description:
          "Проверьте наличие и условия гарантийного срока на товар (ст. 470-477 ГК РФ). Отсутствие гарантии может ограничить ваши права при обнаружении недостатков.",
        recommendation:
          "Установите гарантийный срок не менее 12 месяцев. Пропишите порядок рекламации и сроки замены/ремонта.",
      });
    }
  }

  if (isEmployment) {
    if (risks.length < 2) {
      risks.push({
        clause: "Условия трудового договора",
        level: "medium",
        description:
          "Убедитесь, что трудовой договор содержит все обязательные условия по ст. 57 ТК РФ: место работы, трудовая функция, дата начала, условия оплаты, режим рабочего времени.",
        recommendation:
          "Проверьте соответствие всем обязательным требованиям ст. 57 ТК РФ. Убедитесь, что условия оплаты не ниже МРОТ.",
      });
    }
  }

  if (isService) {
    if (risks.length < 2) {
      risks.push({
        clause: "Приёмка работ/услуг",
        level: "medium",
        description:
          "Проверьте порядок и сроки приёмки оказанных услуг. Отсутствие чётких критериев приёмки может привести к спорам.",
        recommendation:
          "Пропишите конкретные критерии приёмки, срок рассмотрения акта (5-10 рабочих дней) и порядок мотивированного отказа.",
      });
    }
  }

  if (isNda) {
    if (risks.length < 2) {
      risks.push({
        clause: "Срок конфиденциальности",
        level: "medium",
        description:
          "Убедитесь, что установлен разумный срок действия обязательств конфиденциальности и чётко определён перечень конфиденциальной информации.",
        recommendation:
          "Рекомендуемый срок — 3-5 лет после прекращения договора. Укажите исчерпывающий перечень исключений из конфиденциальности.",
      });
    }
  }

  // Always add at least one risk if none found
  if (risks.length === 0) {
    risks.push({
      clause: "Общая оценка",
      level: "low",
      description:
        "Автоматический анализ не обнаружил явных рисковых паттернов в тексте. Для полноценного юридического анализа рекомендуется подключить AI-модель.",
      recommendation:
        "Добавьте API-ключ Anthropic в файл .env.local для получения детального AI-анализа каждого пункта договора.",
    });
  }

  // Calculate score based on risks
  const criticalCount = risks.filter((r) => r.level === "critical").length;
  const mediumCount = risks.filter((r) => r.level === "medium").length;
  const score = Math.max(1, Math.min(10, 10 - criticalCount * 3 - mediumCount * 1));

  // Generate summary
  const contractType = isLease
    ? "аренды"
    : isSale
      ? "купли-продажи"
      : isEmployment
        ? "трудовой"
        : isService
          ? "оказания услуг"
          : isNda
            ? "о конфиденциальности"
            : "";

  const typeText = contractType ? ` ${contractType}` : "";

  const summary =
    criticalCount > 0
      ? `Договор${typeText} содержит ${criticalCount} критичных и ${mediumCount} средних рисков. Рекомендуется внести правки до подписания. Документ объёмом ${textLength} символов проанализирован автоматически.`
      : mediumCount > 0
        ? `Договор${typeText} в целом приемлем, но содержит ${mediumCount} замечаний, которые рекомендуется устранить. Документ объёмом ${textLength} символов проанализирован автоматически.`
        : `Договор${typeText} не содержит явных рисков по результатам автоматической проверки. Для глубокого AI-анализа подключите API-ключ.`;

  // suppress unused variable warning
  void textLower;

  return {
    score,
    summary,
    risks,
    isDemo: true,
  };
}

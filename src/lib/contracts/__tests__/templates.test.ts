import { describe, it, expect } from "vitest";
import { generateContract } from "../templates";

// Intl.NumberFormat("ru-RU") emits a non-breaking space ( ) as the
// thousands separator, so a plain "3 000 000" written by humans into
// the test won't match. We normalize both the actual output and the
// expected fragment to plain ASCII spaces before comparison.
function expectInOutput(actual: string, expected: string): void {
  const norm = (s: string) => s.replace(/ /g, " ");
  expect(norm(actual)).toContain(norm(expected));
}

// Smoke tests for every template. We don't pin exact wording (boilerplate
// changes break tests for no good reason), but we DO pin invariants every
// generated document must satisfy:
//   1. Returns a non-empty string.
//   2. The user-supplied parties / amounts / descriptions appear verbatim
//      somewhere in the output. If they don't, the generator is missing a
//      data interpolation and the user's input is being silently dropped.
//   3. Standard sections present where they should be.
//
// Tests use fully-populated input so we exercise every branch of the
// optional-clause logic.

const minimalParties = {
  party1: "ООО «Альфа»",
  party1Inn: "7712345678",
  party2: "ИП Иванов И.И.",
  party2Inn: "771234567890",
};

describe("generateContract — every templateId returns content", () => {
  // The full 20-template list — adding a new one without registering it
  // in this list should be a deliberate decision.
  const ALL_IDS = [
    "nda",
    "lease",
    "sale",
    "service",
    "employment",
    "supply",
    "loan",
    "agency",
    "contractor",
    "amendment",
    "act-work",
    "act-service",
    "receipt",
    "termination-agreement",
    "gift",
    "barter",
    "assignment",
    "franchise",
    "transport",
    "storage",
  ];

  it.each(ALL_IDS)("'%s' returns a non-empty document", (id) => {
    const out = generateContract(id, {});
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(200);
  });

  it("returns 'не найден' for unknown templateId", () => {
    const out = generateContract("nonexistent-template-id", {});
    expectInOutput(out,"не найден");
  });
});

describe("Batch 1 — short documents", () => {
  it("amendment includes the original contract reference + changes verbatim", () => {
    const out = generateContract("amendment", {
      ...minimalParties,
      party1Role: "Заказчик",
      party2Role: "Исполнитель",
      originalContractType: "Договор оказания услуг",
      originalContractNumber: "12-А/2026",
      originalContractDate: "2026-03-15",
      changes:
        "1. Изложить п. 2.1 в редакции: «Стоимость 200 000 рублей в месяц».",
      effectiveDate: "2026-06-01",
    });
    expectInOutput(out,"12-А/2026");
    expectInOutput(out,"Договор оказания услуг");
    expectInOutput(out,"200 000");
    expectInOutput(out,"Заказчик");
    expectInOutput(out,"Исполнитель");
    expectInOutput(out,"ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ");
  });

  it("act-work shows the work description and computed VAT line", () => {
    const out = generateContract("act-work", {
      contractNumber: "5-П/2026",
      contractDate: "2026-04-01",
      customer: "ООО «Заказчик»",
      customerInn: "1111111111",
      contractor: "ООО «Подрядчик»",
      contractorInn: "2222222222",
      workDescription: "Монтаж системы видеонаблюдения, 8 камер.",
      totalAmount: "150000",
      withVat: "20",
      qualityNote: "none",
    });
    expectInOutput(out,"АКТ ПРИЁМКИ ВЫПОЛНЕННЫХ РАБОТ");
    expectInOutput(out,"видеонаблюдения");
    expectInOutput(out,"ИНН 1111111111");
    expectInOutput(out,"в том числе НДС 20%");
  });

  it("act-service shows the service period in 'с ... по ...' form", () => {
    const out = generateContract("act-service", {
      contractNumber: "8-У",
      contractDate: "2026-01-10",
      customer: "ООО «Заказчик»",
      customerInn: "1111111111",
      executor: "ИП Петров",
      executorInn: "555555555555",
      serviceDescription: "Юридическая консультация.",
      periodFrom: "2026-01-15",
      periodTo: "2026-01-30",
      totalAmount: "100000",
      withVat: "no",
    });
    expectInOutput(out,"Юридическая консультация");
    expectInOutput(out,"Период оказания Услуг");
    expectInOutput(out,"УСН");
  });

  it("receipt is in first person and includes the giver's passport", () => {
    const out = generateContract("receipt", {
      receiverFio: "Иванов Иван Иванович",
      receiverPassport: "4500 123456",
      receiverPassportInfo: "ОВД, 12.05.2010",
      receiverAddress: "г. Москва, ул. Пушкина, д. 1",
      giverFio: "Петров Пётр Петрович",
      giverPassport: "4500 654321",
      amount: "50000",
      purpose: "В качестве займа на 6 месяцев",
      city: "Москва",
    });
    expectInOutput(out,"Я,");
    expectInOutput(out,"Иванов Иван Иванович");
    expectInOutput(out,"Петров Пётр Петрович");
    expectInOutput(out,"4500 654321");
    expectInOutput(out,"РАСПИСКА");
  });

  it("termination-agreement with refund branch has both the amount and deadline", () => {
    const out = generateContract("termination-agreement", {
      ...minimalParties,
      party1Role: "Арендодатель",
      party2Role: "Арендатор",
      originalContractType: "Договор аренды",
      originalContractNumber: "3-А",
      originalContractDate: "2025-09-01",
      terminationDate: "2026-05-15",
      settlement: "refund",
      refundAmount: "75000",
      refundDeadline: "10",
    });
    expectInOutput(out,"СОГЛАШЕНИЕ");
    expectInOutput(out,"75 000");
    expectInOutput(out,"10 (десяти) рабочих дней");
    expectInOutput(out,"Арендатор");
  });

  it("termination-agreement settled branch states no claims", () => {
    const out = generateContract("termination-agreement", {
      ...minimalParties,
      party1Role: "А",
      party2Role: "Б",
      originalContractType: "Договор",
      originalContractNumber: "1",
      originalContractDate: "2025-01-01",
      terminationDate: "2026-01-01",
      settlement: "settled",
    });
    expectInOutput(out,"претензий");
  });
});

describe("Batch 2 — full contracts", () => {
  it("gift contract names both donor and donee + value", () => {
    const out = generateContract("gift", {
      donor: "Иванов Иван Иванович",
      donorInn: "771234567890",
      donee: "Петров Пётр Петрович",
      doneeInn: "771234567891",
      giftKind: "movable",
      giftDescription: "Автомобиль Toyota Camry, 2020 г.в.",
      giftValue: "1000000",
      transferDate: "2026-06-01",
    });
    expectInOutput(out,"Иванов Иван Иванович");
    expectInOutput(out,"Петров Пётр Петрович");
    expectInOutput(out,"Toyota Camry");
    expectInOutput(out,"1 000 000");
    expectInOutput(out,"Гражданского кодекса Российской Федерации");
  });

  it("barter equal-value branch states no top-up", () => {
    const out = generateContract("barter", {
      ...minimalParties,
      goods1: "Партия мебели",
      value1: "200000",
      goods2: "Партия техники",
      value2: "200000",
      exchangeDate: "2026-04-10",
      differencePayment: "none",
    });
    expectInOutput(out,"равноценными");
    expect(out.replace(/\s+/g, " ")).not.toContain("уплачивает Стороне");
  });

  it("barter unequal-value branch routes top-up to the right party", () => {
    const out = generateContract("barter", {
      ...minimalParties,
      goods1: "Товар А",
      value1: "100000",
      goods2: "Товар Б",
      value2: "150000",
      exchangeDate: "2026-04-10",
      differencePayment: "p1pays",
    });
    expectInOutput(out,"Сторона 1 уплачивает Стороне 2");
    expectInOutput(out,"50 000");
  });

  it("assignment cession includes debtor + cession price + ст. 384/390 ГК РФ", () => {
    const out = generateContract("assignment", {
      cedent: "ООО «Цедент»",
      cedentInn: "111",
      cessionary: "ООО «Цессионарий»",
      cessionaryInn: "222",
      debtor: "ООО «Должник»",
      debtorInn: "333",
      originalContract: "Договор поставки № 5 от 12 марта 2025 г.",
      debtAmount: "1000000",
      cessionPrice: "850000",
      noticeDeadline: "5",
    });
    expectInOutput(out,"Цедент");
    expectInOutput(out,"Цессионарий");
    expectInOutput(out,"Должник");
    expectInOutput(out,"1 000 000");
    expectInOutput(out,"850 000");
    expectInOutput(out,"статьёй 384");
    expectInOutput(out,"статья 390");
    expectInOutput(out,"5 (пяти) рабочих дней");
  });

  it("franchise contract calls out Rospatent registration as a precondition", () => {
    const out = generateContract("franchise", {
      franchisor: "ООО «Бренд»",
      franchisorInn: "111",
      franchisee: "ИП Иванов",
      franchiseeInn: "222",
      trademark: "«Бренд», свидетельство № 999999",
      territory: "г. Москва",
      exclusivity: "exclusive",
      lumpSum: "500000",
      royaltyPercent: "5",
      term: "5",
    });
    expectInOutput(out,"Роспатент");
    expectInOutput(out,"статья 1028");
    expectInOutput(out,"исключительности");
    expectInOutput(out,"500 000");
    expectInOutput(out,"5%");
    expectInOutput(out,"5 (пять) лет");
  });

  it("transport contract surfaces both addresses and freight charge", () => {
    const out = generateContract("transport", {
      carrier: "ООО «Логистика»",
      carrierInn: "111",
      shipper: "ООО «Отправитель»",
      shipperInn: "222",
      consignee: "ООО «Получатель», СПб",
      cargo: "Электроника",
      originAddress: "г. Москва",
      destinationAddress: "г. Санкт-Петербург",
      freightCharge: "75000",
      loadingDate: "2026-03-01",
      deliveryDeadline: "5",
    });
    expectInOutput(out,"Москва");
    expectInOutput(out,"Санкт-Петербург");
    expectInOutput(out,"75 000");
    expectInOutput(out,"5 (пяти) рабочих дней");
    expectInOutput(out,"статья 796");
  });

  it("storage with keeper-insured branch calls out the insurance party", () => {
    const out = generateContract("storage", {
      depositor: "ООО «Поклажедатель»",
      depositorInn: "111",
      keeper: "ООО «Склад»",
      keeperInn: "222",
      items: "Партия оборудования",
      storageAddress: "Подольск",
      valuation: "3000000",
      feePerMonth: "30000",
      termMonths: "6",
      insurance: "keeper",
    });
    expectInOutput(out,"3 000 000");
    expectInOutput(out,"30 000");
    expectInOutput(out,"6 (шести) месяцев");
    expectInOutput(out,"Хранитель за свой счёт страхует");
    expectInOutput(out,"статья 891");
  });
});

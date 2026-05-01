/**
 * Российские договорные шаблоны (готовые, юридически корректные)
 * Используют Handlebars синтаксис {{VARIABLE}} для заполнения
 */

export interface TemplateVariable {
  name: string;
  type: "text" | "number" | "date" | "email" | "phone" | "url";
  label: string;
  placeholder: string;
  required: boolean;
  hint?: string;
}

export interface ContractTemplate {
  code: string;
  name: string;
  category: string;
  description: string;
  content: string;
  variables: TemplateVariable[];
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    code: "PROM_SALE",
    name: "Договор купли-продажи",
    category: "Коммерческие",
    description: "Договор купли-продажи товаров между юридическими лицами или ИП",
    variables: [
      { name: "SELLER_NAME", type: "text", label: "Продавец (ФИО/название)", placeholder: "ООО Вектор", required: true },
      { name: "SELLER_ADDRESS", type: "text", label: "Адрес продавца", placeholder: "г. Москва, ул. Примерная, д. 1", required: true },
      { name: "SELLER_INN", type: "text", label: "ИНН продавца", placeholder: "7712345678", required: false },
      { name: "BUYER_NAME", type: "text", label: "Покупатель", placeholder: "ООО Альфа", required: true },
      { name: "BUYER_ADDRESS", type: "text", label: "Адрес покупателя", placeholder: "г. Санкт-Петербург, ул. Другая, д. 2", required: true },
      { name: "BUYER_INN", type: "text", label: "ИНН покупателя", placeholder: "7801234567", required: false },
      { name: "GOODS_DESCRIPTION", type: "text", label: "Описание товара", placeholder: "Профилированный брус 150х150мм, сосна, класс АБ", required: true },
      { name: "QUANTITY", type: "number", label: "Количество (в единицах)", placeholder: "100", required: true },
      { name: "UNIT", type: "text", label: "Единица измерения", placeholder: "шт.", required: true },
      { name: "PRICE_PER_UNIT", type: "number", label: "Цена за единицу (₽)", placeholder: "5000", required: true },
      { name: "TOTAL_AMOUNT", type: "number", label: "Сумма контракта (₽)", placeholder: "500000", required: true },
      { name: "CURRENCY", type: "text", label: "Валюта", placeholder: "RUB", required: false },
      { name: "PAYMENT_TERMS", type: "text", label: "Условия оплаты", placeholder: "50% авансом, 50% при получении", required: true },
      { name: "DELIVERY_TERMS", type: "text", label: "Условия доставки", placeholder: "Доставка ТК 'Деловые линии' за счет покупателя", required: true },
      { name: "DELIVERY_DATE", type: "date", label: "Дата поставки", placeholder: "2026-06-01", required: true },
      { name: "CONTRACT_DATE", type: "date", label: "Дата подписания", placeholder: "2026-05-01", required: true },
    ],
    content: `
ДОГОВОР КУПЛИ-ПРОДАЖИ №_____

Дата: {{CONTRACT_DATE}}
г. Москва

СТОРОНЫ:
Продавец (Поставщик): {{SELLER_NAME}}
Адрес: {{SELLER_ADDRESS}}
ИНН: {{SELLER_INN}}

Покупатель: {{BUYER_NAME}}
Адрес: {{BUYER_ADDRESS}}
ИНН: {{BUYER_INN}}

именуемые в дальнейшем «Продавец» и «Покупатель» соответственно, заключили настоящий договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
1.1. Продавец обязуется передать Покупателю, а Покупатель обязуется принять и оплатить товар:
Наименование: {{GOODS_DESCRIPTION}}
Количество: {{QUANTITY}} {{UNIT}}
Цена за единицу: {{PRICE_PER_UNIT}} {{CURRENCY}}
Общая стоимость: {{TOTAL_AMOUNT}} {{CURRENCY}}

2. ЦЕНА И УСЛОВИЯ ОПЛАТЫ
2.1. Общая стоимость товара составляет {{TOTAL_AMOUNT}} {{CURRENCY}} (в том числе НДС, если применимо).
2.2. Условия оплаты: {{PAYMENT_TERMS}}
2.3. Платёж производится на расчётный счёт Продавца.

3. ДОСТАВКА И ПЕРЕДАЧА ТОВАРА
3.1. Доставка товара: {{DELIVERY_TERMS}}
3.2. Дата поставки: {{DELIVERY_DATE}}
3.3. Товар считается переданным Покупателю в момент передачи грузоперевозчику или, если доставка осуществляется Продавцом, в момент физической передачи товара.

4. ПРАВА И ОБЯЗАННОСТИ СТОРОН
4.1. Продавец гарантирует:
- Право собственности на товар на момент передачи
- Товар надлежащего качества без видимых дефектов
- Соответствие товара описанию в договоре

4.2. Покупатель обязуется:
- Принять товар в оговоренный срок
- Произвести оплату в установленные сроки
- Проверить товар на предмет соответствия качеству

5. ОТВЕТСТВЕННОСТЬ СТОРОН
5.1. За нарушение сроков поставки Продавец выплачивает штраф 0,5% от стоимости товара за каждый день просрочки.
5.2. За несвоевременную оплату Покупатель выплачивает пеню 0,5% от суммы платежа за каждый день просрочки.

6. ИЗМЕНЕНИЕ И РАСТОРЖЕНИЕ ДОГОВОРА
6.1. Изменение условий договора возможно только по письменному согласию обеих сторон.
6.2. Договор может быть расторгнут по соглашению сторон или в случае существенного нарушения условий одной из сторон.

7. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ
7.1. Договор составлен в двух экземплярах, по одному для каждой стороны.
7.2. Все споры решаются в соответствии с законодательством Российской Федерации.

ПОДПИСИ:

ПРОДАВЕЦ:
_____________________ (подпись)
_____________________ (расшифровка ФИО)

ПОКУПАТЕЛЬ:
_____________________ (подпись)
_____________________ (расшифровка ФИО)
`.trim(),
  },

  {
    code: "PROM_USLUG",
    name: "Договор оказания услуг",
    category: "Коммерческие",
    description: "Договор между исполнителем и заказчиком на оказание услуг",
    variables: [
      { name: "EXECUTOR_NAME", type: "text", label: "Исполнитель (ФИО/название)", placeholder: "ИП Иванов И.И.", required: true },
      { name: "EXECUTOR_ADDRESS", type: "text", label: "Адрес исполнителя", placeholder: "г. Москва, ул. Примерная, д. 1", required: true },
      { name: "CLIENT_NAME", type: "text", label: "Заказчик", placeholder: "ООО Клиент", required: true },
      { name: "CLIENT_ADDRESS", type: "text", label: "Адрес заказчика", placeholder: "г. Санкт-Петербург, ул. Другая, д. 2", required: true },
      { name: "SERVICE_DESCRIPTION", type: "text", label: "Описание услуги", placeholder: "Юридическое консультирование по контрактам", required: true },
      { name: "SERVICE_SCOPE", type: "text", label: "Объём работ", placeholder: "30 часов консультаций", required: true },
      { name: "PRICE_PER_HOUR", type: "number", label: "Стоимость в час (₽)", placeholder: "2000", required: true },
      { name: "TOTAL_COST", type: "number", label: "Общая стоимость (₽)", placeholder: "60000", required: true },
      { name: "DEADLINE", type: "date", label: "Срок выполнения", placeholder: "2026-06-30", required: true },
      { name: "PAYMENT_SCHEDULE", type: "text", label: "График оплаты", placeholder: "50% авансом, 50% при завершении", required: true },
      { name: "CONTRACT_DATE", type: "date", label: "Дата подписания", placeholder: "2026-05-01", required: true },
    ],
    content: `
ДОГОВОР ОКАЗАНИЯ УСЛУГ №_____

Дата: {{CONTRACT_DATE}}

СТОРОНЫ:
Исполнитель: {{EXECUTOR_NAME}}
Адрес: {{EXECUTOR_ADDRESS}}

Заказчик: {{CLIENT_NAME}}
Адрес: {{CLIENT_ADDRESS}}

1. ПРЕДМЕТ ДОГОВОРА
1.1. Исполнитель обязуется оказать Заказчику услугу:
{{SERVICE_DESCRIPTION}}

Объём работ: {{SERVICE_SCOPE}}

2. СТОИМОСТЬ И УСЛОВИЯ ОПЛАТЫ
2.1. Стоимость услуги: {{TOTAL_COST}} рублей
2.2. Условия оплаты: {{PAYMENT_SCHEDULE}}
2.3. Платёж производится банковским переводом или наличными.

3. СРОКИ ВЫПОЛНЕНИЯ
3.1. Срок выполнения услуг: {{DEADLINE}}
3.2. В случае просрочки Исполнитель платит штраф 1% в день от суммы контракта.

4. ПРАВА И ОБЯЗАННОСТИ
4.1. Исполнитель обязуется:
- Оказать услугу надлежащего качества
- Использовать профессиональный подход
- Соблюдать сроки

4.2. Заказчик обязуется:
- Оплатить услугу в оговоренные сроки
- Предоставить необходимую информацию

5. ПРЕКРАЩЕНИЕ ДОГОВОРА
5.1. Договор прекращается после полного выполнения обязательств.
5.2. Любая сторона может расторгнуть договор за 10 дней письменного уведомления.

ПОДПИСИ:
Исполнитель: _____________________ ({{EXECUTOR_NAME}})
Заказчик: _____________________ ({{CLIENT_NAME}})
`.trim(),
  },

  {
    code: "NONDISCLOSURE",
    name: "Соглашение о конфиденциальности (NDA)",
    category: "Правовые",
    description: "NDA для защиты коммерческой тайны и конфиденциальной информации",
    variables: [
      { name: "DISCLOSING_PARTY", type: "text", label: "Раскрывающая сторона", placeholder: "ООО Стартап", required: true },
      { name: "RECEIVING_PARTY", type: "text", label: "Получающая сторона", placeholder: "ИП Партнёр", required: true },
      { name: "CONFIDENTIAL_INFO", type: "text", label: "Тип конфиденциальной информации", placeholder: "Коммерческие предложения, клиентская база, технологии", required: true },
      { name: "DURATION_MONTHS", type: "number", label: "Срок действия (месяцы)", placeholder: "12", required: true },
      { name: "CONTRACT_DATE", type: "date", label: "Дата подписания", placeholder: "2026-05-01", required: true },
    ],
    content: `
СОГЛАШЕНИЕ О КОНФИДЕНЦИАЛЬНОСТИ

Дата: {{CONTRACT_DATE}}

Между {{DISCLOSING_PARTY}} и {{RECEIVING_PARTY}}

1. ОПРЕДЕЛЕНИЕ КОНФИДЕНЦИАЛЬНОЙ ИНФОРМАЦИИ
Конфиденциальная информация — это любая информация, раскрываемая одной стороной другой, включая:
- {{CONFIDENTIAL_INFO}}
- Технические данные
- Коммерческие предложения
- Финансовые данные

2. ОБЯЗАТЕЛЬСТВА СТОРОН
2.1. Получающая сторона обязуется:
- Сохранять конфиденциальность информации
- Не разглашать информацию третьим лицам без письменного согласия
- Использовать информацию только в целях сотрудничества
- Защищать информацию от несанкционированного доступа

3. ИСКЛЮЧЕНИЯ
Конфиденциальная защита не распространяется на информацию:
- Являющуюся общественным достоянием
- Полученную без нарушения обязательств
- Требуемую раскрыть по закону (с уведомлением другой стороны)

4. СРОК ДЕЙСТВИЯ
Соглашение действует {{DURATION_MONTHS}} месяцев с момента подписания.

5. ОТВЕТСТВЕННОСТЬ
При нарушении конфиденциальности нарушившая сторона выплачивает убытки в размере, установленном судом.

ПОДПИСИ:
{{DISCLOSING_PARTY}}: _____________________
{{RECEIVING_PARTY}}: _____________________
`.trim(),
  },

  {
    code: "TRUDOVOY",
    name: "Трудовой договор",
    category: "Трудовые",
    description: "Трудовой договор между работодателем и работником",
    variables: [
      { name: "EMPLOYER_NAME", type: "text", label: "Работодатель (название компании)", placeholder: "ООО Компания", required: true },
      { name: "EMPLOYEE_NAME", type: "text", label: "Работник (ФИО)", placeholder: "Иванов Иван Иванович", required: true },
      { name: "EMPLOYEE_PASSPORT", type: "text", label: "Паспортные данные работника", placeholder: "Паспорт 12 34 567890, выдан ...", required: true },
      { name: "POSITION", type: "text", label: "Должность", placeholder: "Юридический консультант", required: true },
      { name: "DEPARTMENT", type: "text", label: "Отдел/подразделение", placeholder: "Юридический отдел", required: false },
      { name: "START_DATE", type: "date", label: "Дата начала работы", placeholder: "2026-06-01", required: true },
      { name: "SALARY", type: "number", label: "Зарплата (₽/месяц)", placeholder: "60000", required: true },
      { name: "WORKING_HOURS", type: "text", label: "Режим работы", placeholder: "40 часов в неделю, пн-пт 09:00-18:00", required: true },
      { name: "TRIAL_PERIOD", type: "number", label: "Испытательный срок (дни)", placeholder: "30", required: false },
      { name: "CONTRACT_DATE", type: "date", label: "Дата подписания", placeholder: "2026-05-15", required: true },
    ],
    content: `
ТРУДОВОЙ ДОГОВОР №_____

МЕЖДУ РАБОТОДАТЕЛЕМ И РАБОТНИКОМ

1. СТОРОНЫ
Работодатель: {{EMPLOYER_NAME}}
Работник: {{EMPLOYEE_NAME}}
Паспортные данные: {{EMPLOYEE_PASSPORT}}

2. СУЩЕСТВЕННЫЕ УСЛОВИЯ
2.1. Должность: {{POSITION}}
2.2. Место работы: {{DEPARTMENT}}
2.3. Дата начала работы: {{START_DATE}}
2.4. Режим работы: {{WORKING_HOURS}}

3. ОПЛАТА ТРУДА
3.1. Ежемесячный оклад: {{SALARY}} рублей
3.2. Оплата производится {{PAYMENT_DATE}} числа каждого месяца
3.3. Районный коэффициент (если применимо): в соответствии с законодательством

4. ИСПЫТАТЕЛЬНЫЙ СРОК
{{#if TRIAL_PERIOD}}4.1. Испытательный срок: {{TRIAL_PERIOD}} дней
4.2. При неудовлетворительных результатах контракт может быть расторгнут досрочно{{/if}}

5. ПРАВА И ОБЯЗАННОСТИ
5.1. Работник обязуется:
- Добросовестно выполнять свои должностные обязанности
- Соблюдать Правила внутреннего трудового распорядка
- Сохранять конфиденциальность информации

5.2. Работодатель обязуется:
- Своевременно выплачивать зарплату
- Создавать безопасные условия труда
- Не требовать выполнения незаконных работ

6. РЕЖИМ РАБОТЫ И ОТПУСК
6.1. Рабочая неделя: 40 часов
6.2. Ежегодный оплачиваемый отпуск: 28 календарных дней

7. ПРЕКРАЩЕНИЕ ДОГОВОРА
7.1. Договор может быть расторгнут по взаимному согласию сторон
7.2. Любая сторона может расторгнуть договор за 2 недели письменного уведомления

ПОДПИСИ:
Работодатель: _____________________ ({{EMPLOYER_NAME}})
Работник: _____________________ ({{EMPLOYEE_NAME}})
Дата: {{CONTRACT_DATE}}
`.trim(),
  },

  {
    code: "LOAN",
    name: "Договор займа",
    category: "Имущественные",
    description: "Договор займа между кредитором и заёмщиком",
    variables: [
      { name: "LENDER_NAME", type: "text", label: "Кредитор (ФИО/название)", placeholder: "ООО Финанс", required: true },
      { name: "BORROWER_NAME", type: "text", label: "Заёмщик (ФИО/название)", placeholder: "ИП Сидоров", required: true },
      { name: "LOAN_AMOUNT", type: "number", label: "Сумма займа (₽)", placeholder: "500000", required: true },
      { name: "INTEREST_RATE", type: "number", label: "Процентная ставка (% в год)", placeholder: "12", required: true },
      { name: "LOAN_TERM_MONTHS", type: "number", label: "Срок займа (месяцы)", placeholder: "12", required: true },
      { name: "REPAYMENT_SCHEDULE", type: "text", label: "График погашения", placeholder: "Равными частями ежемесячно", required: true },
      { name: "COLLATERAL", type: "text", label: "Обеспечение (залог)", placeholder: "Недвижимое имущество", required: false },
      { name: "CONTRACT_DATE", type: "date", label: "Дата подписания", placeholder: "2026-05-01", required: true },
    ],
    content: `
ДОГОВОР ЗАЙМА №_____

Дата: {{CONTRACT_DATE}}

СТОРОНЫ:
Кредитор: {{LENDER_NAME}}
Заёмщик: {{BORROWER_NAME}}

1. СУММА И ПРЕДМЕТ ЗАЙМА
1.1. Кредитор передаёт Заёмщику в собственность деньги в сумме {{LOAN_AMOUNT}} рублей
1.2. Заёмщик обязуется возвратить эту сумму с процентами в сроки, предусмотренные договором

2. ПРОЦЕНТНАЯ СТАВКА И ПРОЦЕНТЫ
2.1. Процентная ставка: {{INTEREST_RATE}}% годовых
2.2. Проценты начисляются и выплачиваются согласно графику погашения

3. ГРАФИК ПОГАШЕНИЯ
3.1. {{REPAYMENT_SCHEDULE}}
3.2. Полная сумма к возврату (с процентами): {{TOTAL_REPAY}} рублей

4. ОБЕСПЕЧЕНИЕ
{{#if COLLATERAL}}4.1. Обеспечение займа: {{COLLATERAL}}
4.2. Обеспечение остаётся в собственности Заёмщика{{/if}}

5. ДОСРОЧНОЕ ПОГАШЕНИЕ
5.1. Заёмщик имеет право погасить займ досрочно без штрафа

6. ОТВЕТСТВЕННОСТЬ ЗА ПРОСРОЧКУ
6.1. При просрочке платежа начисляется пеня 0,5% в день от просроченной суммы

7. КОНФИДЕНЦИАЛЬНОСТЬ
7.1. Стороны сохраняют конфиденциальность условий договора

ПОДПИСИ:
Кредитор: _____________________ ({{LENDER_NAME}})
Заёмщик: _____________________ ({{BORROWER_NAME}})
`.trim(),
  },

  {
    code: "PRETENSION",
    name: "Претензионное письмо",
    category: "Правовые",
    description: "Претензия по задолженности или нарушению обязательств",
    variables: [
      { name: "FROM_NAME", type: "text", label: "От кого (компания/ФИО)", placeholder: "ООО Кредитор", required: true },
      { name: "FROM_ADDRESS", type: "text", label: "Адрес отправителя", placeholder: "г. Москва, ул. Примерная, д. 1", required: true },
      { name: "TO_NAME", type: "text", label: "Кому (должник)", placeholder: "ООО Должник", required: true },
      { name: "TO_ADDRESS", type: "text", label: "Адрес должника", placeholder: "г. Санкт-Петербург, ул. Другая, д. 2", required: true },
      { name: "CLAIM_AMOUNT", type: "number", label: "Сумма претензии (₽)", placeholder: "100000", required: true },
      { name: "CLAIM_REASON", type: "text", label: "Причина претензии", placeholder: "Неуплата по счёту от 01.04.2026", required: true },
      { name: "DUE_DATE", type: "date", label: "Дата, к которой требуется ответ", placeholder: "2026-06-15", required: true },
      { name: "CONTRACT_NUMBER", type: "text", label: "Номер договора (если есть)", placeholder: "ДКП-2026-001", required: false },
      { name: "LETTER_DATE", type: "date", label: "Дата письма", placeholder: "2026-05-20", required: true },
    ],
    content: `
ПРЕТЕНЗИЯ

От: {{FROM_NAME}}, {{FROM_ADDRESS}}
Кому: {{TO_NAME}}, {{TO_ADDRESS}}

Дата: {{LETTER_DATE}}

Уважаемые {{TO_NAME}}!

Настоящим письмом направляем вам претензию в связи с нарушением условий договора.

ОСНОВАНИЕ ПРЕТЕНЗИИ:
{{CLAIM_REASON}}

{{#if CONTRACT_NUMBER}}Договор №: {{CONTRACT_NUMBER}}{{/if}}

СУММА ПРЕТЕНЗИИ: {{CLAIM_AMOUNT}} рублей

ТРЕБОВАНИЯ:
Требуем выполнения следующих действий:
1. Перечисления суммы {{CLAIM_AMOUNT}} рублей на расчётный счёт
2. Устранения допущенных нарушений

СРОК ДЛЯ ОТВЕТА:
Просим направить ответ на настоящую претензию и произвести платёж не позднее {{DUE_DATE}}.

При неисполнении требований настоящей претензии мы будем вынуждены обратиться в суд с иском о взыскании задолженности, судебных издержек и других убытков.

С уважением,
{{FROM_NAME}}

Подпись: _____________________
Печать (если есть)
`.trim(),
  },

  {
    code: "POWER_OF_ATTORNEY",
    name: "Доверенность",
    category: "Правовые",
    description: "Доверенность на представление интересов",
    variables: [
      { name: "GRANTOR_NAME", type: "text", label: "Выдающий доверенность (ФИО)", placeholder: "Иванов Иван Иванович", required: true },
      { name: "GRANTOR_PASSPORT", type: "text", label: "Паспортные данные доверителя", placeholder: "Паспорт 12 34 567890", required: true },
      { name: "REPRESENTATIVE_NAME", type: "text", label: "Представитель (ФИО)", placeholder: "Петров Петр Петрович", required: true },
      { name: "REPRESENTATIVE_PASSPORT", type: "text", label: "Паспортные данные представителя", placeholder: "Паспорт 98 76 543210", required: true },
      { name: "AUTHORITY_SCOPE", type: "text", label: "Объём полномочий", placeholder: "Право подписи договоров, получение документов, расчеты", required: true },
      { name: "VALID_UNTIL", type: "date", label: "Действительна до", placeholder: "2027-05-01", required: true },
      { name: "ISSUED_DATE", type: "date", label: "Дата выдачи", placeholder: "2026-05-01", required: true },
    ],
    content: `
ДОВЕРЕННОСТЬ

Я, {{GRANTOR_NAME}}, {{GRANTOR_PASSPORT}}, выдаю настоящую доверенность

{{REPRESENTATIVE_NAME}}, {{REPRESENTATIVE_PASSPORT}}

в том, что он является моим уполномоченным представителем на осуществление следующих действий:

1. {{AUTHORITY_SCOPE}}

ПОЛНОМОЧИЯ ПРЕДСТАВИТЕЛЯ:
- Подписание документов от моего имени
- Представление моих интересов в государственных органах и организациях
- Получение информации и документов
- Совершение иных действий, необходимых для реализации указанных полномочий

СРОК ДЕЙСТВИЯ:
Доверенность действует с {{ISSUED_DATE}} по {{VALID_UNTIL}}

ОТЗЫВ:
Доверенность может быть отозвана в любой момент путём направления письменного уведомления.

ДАТА ВЫДАЧИ: {{ISSUED_DATE}}

ПОДПИСЬ ДОВЕРИТЕЛЯ: _____________________
({{GRANTOR_NAME}})

УДОСТОВЕРЕНИЕ (нотариусом):
_____________________
`.trim(),
  },
];

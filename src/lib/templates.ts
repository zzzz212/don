export interface TemplateField {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "select";
  placeholder: string;
  required: boolean;
  options?: { value: string; label: string }[];
}

export interface DocumentTemplate {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  category: string;
  estimatedTime: string;
  fields: TemplateField[];
}

export const templates: DocumentTemplate[] = [
  {
    id: "nda",
    name: "Соглашение о неразглашении (NDA)",
    shortName: "NDA",
    description:
      "Защитите конфиденциальную информацию при работе с партнёрами, подрядчиками и сотрудниками.",
    icon: "shield",
    category: "Конфиденциальность",
    estimatedTime: "2 мин",
    fields: [
      {
        id: "disclosingParty",
        label: "Раскрывающая сторона (название организации / ФИО)",
        type: "text",
        placeholder: "ООО «Ваша компания»",
        required: true,
      },
      {
        id: "disclosingInn",
        label: "ИНН раскрывающей стороны",
        type: "text",
        placeholder: "7712345678",
        required: true,
      },
      {
        id: "receivingParty",
        label: "Получающая сторона (название организации / ФИО)",
        type: "text",
        placeholder: "ИП Иванов И.И.",
        required: true,
      },
      {
        id: "receivingInn",
        label: "ИНН получающей стороны",
        type: "text",
        placeholder: "771234567890",
        required: true,
      },
      {
        id: "subject",
        label: "Предмет (какую информацию защищаем)",
        type: "textarea",
        placeholder:
          "Техническая документация, бизнес-планы, клиентская база...",
        required: true,
      },
      {
        id: "duration",
        label: "Срок действия",
        type: "select",
        placeholder: "",
        required: true,
        options: [
          { value: "1", label: "1 год" },
          { value: "2", label: "2 года" },
          { value: "3", label: "3 года" },
          { value: "5", label: "5 лет" },
          { value: "indefinite", label: "Бессрочно" },
        ],
      },
      {
        id: "penalty",
        label: "Штраф за нарушение (₽)",
        type: "number",
        placeholder: "500000",
        required: true,
      },
    ],
  },
  {
    id: "lease",
    name: "Договор аренды нежилого помещения",
    shortName: "Аренда",
    description:
      "Типовой договор аренды для офиса, склада или торгового помещения с защитой интересов арендатора.",
    icon: "building",
    category: "Недвижимость",
    estimatedTime: "3 мин",
    fields: [
      {
        id: "landlord",
        label: "Арендодатель (название / ФИО)",
        type: "text",
        placeholder: "ООО «Арендодатель»",
        required: true,
      },
      {
        id: "landlordInn",
        label: "ИНН арендодателя",
        type: "text",
        placeholder: "7712345678",
        required: true,
      },
      {
        id: "tenant",
        label: "Арендатор (название / ФИО)",
        type: "text",
        placeholder: "ООО «Ваша компания»",
        required: true,
      },
      {
        id: "tenantInn",
        label: "ИНН арендатора",
        type: "text",
        placeholder: "7712345678",
        required: true,
      },
      {
        id: "address",
        label: "Адрес помещения",
        type: "text",
        placeholder: "г. Москва, ул. Примерная, д. 1, оф. 101",
        required: true,
      },
      {
        id: "area",
        label: "Площадь (кв.м)",
        type: "number",
        placeholder: "50",
        required: true,
      },
      {
        id: "rent",
        label: "Арендная плата в месяц (₽)",
        type: "number",
        placeholder: "100000",
        required: true,
      },
      {
        id: "deposit",
        label: "Обеспечительный платёж (₽)",
        type: "number",
        placeholder: "100000",
        required: false,
      },
      {
        id: "duration",
        label: "Срок аренды",
        type: "select",
        placeholder: "",
        required: true,
        options: [
          { value: "11", label: "11 месяцев" },
          { value: "12", label: "1 год" },
          { value: "36", label: "3 года" },
          { value: "60", label: "5 лет" },
        ],
      },
      {
        id: "startDate",
        label: "Дата начала",
        type: "date",
        placeholder: "",
        required: true,
      },
    ],
  },
  {
    id: "sale",
    name: "Договор купли-продажи",
    shortName: "Купля-продажа",
    description:
      "Договор для продажи товаров, оборудования или имущества между юридическими или физическими лицами.",
    icon: "handshake",
    category: "Торговля",
    estimatedTime: "3 мин",
    fields: [
      {
        id: "seller",
        label: "Продавец (название / ФИО)",
        type: "text",
        placeholder: "ООО «Продавец»",
        required: true,
      },
      {
        id: "sellerInn",
        label: "ИНН продавца",
        type: "text",
        placeholder: "7712345678",
        required: true,
      },
      {
        id: "buyer",
        label: "Покупатель (название / ФИО)",
        type: "text",
        placeholder: "ООО «Покупатель»",
        required: true,
      },
      {
        id: "buyerInn",
        label: "ИНН покупателя",
        type: "text",
        placeholder: "7712345678",
        required: true,
      },
      {
        id: "subject",
        label: "Предмет договора (что продаётся)",
        type: "textarea",
        placeholder: "Оборудование, товар, имущество...",
        required: true,
      },
      {
        id: "price",
        label: "Цена (₽)",
        type: "number",
        placeholder: "500000",
        required: true,
      },
      {
        id: "paymentTerms",
        label: "Условия оплаты",
        type: "select",
        placeholder: "",
        required: true,
        options: [
          { value: "prepaid", label: "100% предоплата" },
          { value: "postpaid", label: "Оплата при получении" },
          { value: "partial", label: "50% предоплата, 50% при получении" },
          { value: "installments", label: "Рассрочка" },
        ],
      },
      {
        id: "deliveryDate",
        label: "Срок поставки / передачи",
        type: "date",
        placeholder: "",
        required: true,
      },
      {
        id: "warranty",
        label: "Гарантийный срок",
        type: "select",
        placeholder: "",
        required: false,
        options: [
          { value: "0", label: "Без гарантии" },
          { value: "6", label: "6 месяцев" },
          { value: "12", label: "1 год" },
          { value: "24", label: "2 года" },
        ],
      },
    ],
  },
  {
    id: "service",
    name: "Договор оказания услуг",
    shortName: "Услуги",
    description:
      "Для оформления отношений с подрядчиками, фрилансерами и поставщиками услуг.",
    icon: "briefcase",
    category: "Услуги",
    estimatedTime: "3 мин",
    fields: [
      {
        id: "contractor",
        label: "Исполнитель (название / ФИО)",
        type: "text",
        placeholder: "ИП Петров П.П.",
        required: true,
      },
      {
        id: "contractorInn",
        label: "ИНН исполнителя",
        type: "text",
        placeholder: "771234567890",
        required: true,
      },
      {
        id: "client",
        label: "Заказчик (название / ФИО)",
        type: "text",
        placeholder: "ООО «Ваша компания»",
        required: true,
      },
      {
        id: "clientInn",
        label: "ИНН заказчика",
        type: "text",
        placeholder: "7712345678",
        required: true,
      },
      {
        id: "services",
        label: "Описание услуг",
        type: "textarea",
        placeholder: "Разработка веб-сайта, маркетинговые услуги...",
        required: true,
      },
      {
        id: "price",
        label: "Стоимость услуг (₽)",
        type: "number",
        placeholder: "200000",
        required: true,
      },
      {
        id: "deadline",
        label: "Срок выполнения",
        type: "date",
        placeholder: "",
        required: true,
      },
      {
        id: "paymentTerms",
        label: "Условия оплаты",
        type: "select",
        placeholder: "",
        required: true,
        options: [
          { value: "prepaid", label: "100% предоплата" },
          { value: "postpaid", label: "Оплата по факту" },
          { value: "partial", label: "50/50" },
          { value: "milestone", label: "Поэтапная оплата" },
        ],
      },
    ],
  },
  {
    id: "employment",
    name: "Трудовой договор",
    shortName: "Трудовой",
    description:
      "Типовой трудовой договор, соответствующий ТК РФ, для оформления сотрудников.",
    icon: "users",
    category: "Кадры",
    estimatedTime: "4 мин",
    fields: [
      {
        id: "employer",
        label: "Работодатель (название организации)",
        type: "text",
        placeholder: "ООО «Ваша компания»",
        required: true,
      },
      {
        id: "employerInn",
        label: "ИНН работодателя",
        type: "text",
        placeholder: "7712345678",
        required: true,
      },
      {
        id: "employee",
        label: "ФИО работника",
        type: "text",
        placeholder: "Иванов Иван Иванович",
        required: true,
      },
      {
        id: "position",
        label: "Должность",
        type: "text",
        placeholder: "Менеджер по продажам",
        required: true,
      },
      {
        id: "salary",
        label: "Оклад (₽/мес, до вычета НДФЛ)",
        type: "number",
        placeholder: "80000",
        required: true,
      },
      {
        id: "startDate",
        label: "Дата начала работы",
        type: "date",
        placeholder: "",
        required: true,
      },
      {
        id: "probation",
        label: "Испытательный срок",
        type: "select",
        placeholder: "",
        required: true,
        options: [
          { value: "0", label: "Без испытательного срока" },
          { value: "1", label: "1 месяц" },
          { value: "3", label: "3 месяца" },
          { value: "6", label: "6 месяцев (для руководителей)" },
        ],
      },
      {
        id: "schedule",
        label: "Режим работы",
        type: "select",
        placeholder: "",
        required: true,
        options: [
          { value: "full", label: "Полный рабочий день (5/2)" },
          { value: "shift", label: "Сменный график" },
          { value: "remote", label: "Удалённая работа" },
          { value: "flexible", label: "Гибкий график" },
        ],
      },
    ],
  },
];

export function getTemplate(id: string): DocumentTemplate | undefined {
  return templates.find((t) => t.id === id);
}

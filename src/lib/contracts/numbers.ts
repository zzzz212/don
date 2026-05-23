// Russian sum-in-words (сумма прописью) for legal documents.
// Handles 0 to 999_999_999_999 rubles plus kopecks.

const UNITS_M = [
  "ноль", "один", "два", "три", "четыре", "пять",
  "шесть", "семь", "восемь", "девять",
];
const UNITS_F = [
  "ноль", "одна", "две", "три", "четыре", "пять",
  "шесть", "семь", "восемь", "девять",
];
const TEENS = [
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];
const TENS = [
  "", "", "двадцать", "тридцать", "сорок", "пятьдесят",
  "шестьдесят", "семьдесят", "восемьдесят", "девяносто",
];
const HUNDREDS = [
  "", "сто", "двести", "триста", "четыреста", "пятьсот",
  "шестьсот", "семьсот", "восемьсот", "девятьсот",
];

type GenderForm = "m" | "f";

function tripletToWords(n: number, gender: GenderForm): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const tens = Math.floor(rest / 10);
  const units = rest % 10;

  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);

  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    if (tens > 0) parts.push(TENS[tens]);
    if (units > 0) {
      parts.push(gender === "f" ? UNITS_F[units] : UNITS_M[units]);
    }
  }

  return parts.join(" ");
}

// Plural form for Russian: "1 рубль / 2 рубля / 5 рублей"
function pluralForm(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export function rublesInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "ноль рублей 00 копеек";

  const rubles = Math.floor(amount);
  const kopecks = Math.round((amount - rubles) * 100);

  if (rubles === 0) {
    return `ноль рублей ${kopecks.toString().padStart(2, "0")} копеек`;
  }

  const billions = Math.floor(rubles / 1_000_000_000);
  const millions = Math.floor((rubles % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((rubles % 1_000_000) / 1_000);
  const ones = rubles % 1_000;

  const parts: string[] = [];

  if (billions > 0) {
    parts.push(tripletToWords(billions, "m"));
    parts.push(pluralForm(billions, ["миллиард", "миллиарда", "миллиардов"]));
  }
  if (millions > 0) {
    parts.push(tripletToWords(millions, "m"));
    parts.push(pluralForm(millions, ["миллион", "миллиона", "миллионов"]));
  }
  if (thousands > 0) {
    parts.push(tripletToWords(thousands, "f"));
    parts.push(pluralForm(thousands, ["тысяча", "тысячи", "тысяч"]));
  }
  if (ones > 0 || parts.length === 0) {
    parts.push(tripletToWords(ones, "m"));
  }

  const rubleWord = pluralForm(rubles, ["рубль", "рубля", "рублей"]);
  const kopeckStr = kopecks.toString().padStart(2, "0");

  // Capitalize first letter
  const text = `${parts.join(" ")} ${rubleWord} ${kopeckStr} копеек`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Format a number with non-breaking spaces between thousand groups
export function formatRubles(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount);
}

// Combined helper: "100 000 (Сто тысяч рублей 00 копеек)"
export function moneyDisplay(amount: number): string {
  return `${formatRubles(amount)} (${rublesInWords(amount)})`;
}

// Date in Russian: "5 мая 2026 года"
export function dateInWords(isoDate: string): string {
  if (!isoDate) return "";
  const [yyyy, mm, dd] = isoDate.split("-");
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  const monthIdx = parseInt(mm, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return isoDate;
  return `«${parseInt(dd, 10)}» ${months[monthIdx]} ${yyyy} года`;
}

export function todayInWords(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return dateInWords(`${yyyy}-${mm}-${dd}`);
}

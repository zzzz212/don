// Lightweight i18n dictionary. We deliberately avoid next-intl / formatjs
// because:
//   1) Most app content is dynamic (AI output, user-uploaded contracts,
//      DaData responses) and isn't translated anyway,
//   2) Marketing & legal pages are RU-only by product decision (RU lawyer
//      audience), so the heavy machinery (ICU plurals, server-driven
//      locale routing) buys us nothing,
//   3) A flat key/value JSON object inlined in the bundle is faster to
//      ship and easier to add a third language later if the market asks.
//
// Translators: keep the EN copy short — the UI is sized around the RU
// strings, and RU tends to be ~20% longer than English. If a label needs
// more space in EN, abbreviate.

export type Locale = "ru" | "en";

export const SUPPORTED_LOCALES: Locale[] = ["ru", "en"];
export const DEFAULT_LOCALE: Locale = "ru";

export const LOCALE_LABEL: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
};

export const LOCALE_SHORT: Record<Locale, string> = {
  ru: "RU",
  en: "EN",
};

type Dict = Record<string, string>;

const ru: Dict = {
  "brand.name": "Яксо",
  "brand.tagline": "AI-юрист для бизнеса",

  "nav.primary": "Основная навигация",
  "nav.dashboard": "Дашборд",
  "nav.analyze": "Анализ",
  "nav.templates": "Шаблоны",
  "nav.counterparty": "Контрагенты",
  "nav.chat": "AI-юрист",
  "nav.network": "Сеть",
  "nav.openApp": "В кабинет",
  "nav.menuOpen": "Открыть меню",
  "nav.menuClose": "Закрыть меню",

  "auth.login": "Войти",
  "auth.register": "Регистрация",
  "auth.logout": "Выйти из аккаунта",

  "plan.free": "Бесплатный тариф",
  "plan.pro": "Про",
  "plan.business": "Бизнес",
  "plan.trial": "Триал",

  "common.loading": "Загрузка…",
  "common.save": "Сохранить",
  "common.cancel": "Отмена",
  "common.delete": "Удалить",
  "common.close": "Закрыть",
  "common.error": "Ошибка",
  "common.retry": "Попробовать снова",

  "theme.light": "Светлая тема",
  "theme.dark": "Тёмная тема",
  "theme.system": "Системная тема",
  "theme.toggle": "Переключить тему",

  "language.toggle": "Сменить язык",

  "disclaimer.notLegalAdvice":
    "Яксо — справочный сервис, не заменяет юриста. AI может ошибаться — проверяйте важные документы у профильного специалиста.",
  "disclaimer.privacy": "Политика конфиденциальности",
  "disclaimer.terms": "Пользовательское соглашение",
  "disclaimer.offer": "Публичная оферта",

  "skip.toContent": "Перейти к содержимому",
};

const en: Dict = {
  "brand.name": "Yakso",
  "brand.tagline": "AI legal assistant for business",

  "nav.primary": "Primary navigation",
  "nav.dashboard": "Dashboard",
  "nav.analyze": "Analysis",
  "nav.templates": "Templates",
  "nav.counterparty": "Counterparties",
  "nav.chat": "AI lawyer",
  "nav.network": "Network",
  "nav.openApp": "Open app",
  "nav.menuOpen": "Open menu",
  "nav.menuClose": "Close menu",

  "auth.login": "Sign in",
  "auth.register": "Sign up",
  "auth.logout": "Sign out",

  "plan.free": "Free plan",
  "plan.pro": "Pro",
  "plan.business": "Business",
  "plan.trial": "Trial",

  "common.loading": "Loading…",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.close": "Close",
  "common.error": "Error",
  "common.retry": "Try again",

  "theme.light": "Light theme",
  "theme.dark": "Dark theme",
  "theme.system": "System theme",
  "theme.toggle": "Toggle theme",

  "language.toggle": "Switch language",

  "disclaimer.notLegalAdvice":
    "Yakso is an informational service, not a substitute for a lawyer. AI may err — verify important documents with a qualified professional.",
  "disclaimer.privacy": "Privacy policy",
  "disclaimer.terms": "Terms of service",
  "disclaimer.offer": "Public offer",

  "skip.toContent": "Skip to content",
};

export const messages: Record<Locale, Dict> = { ru, en };

// Lookup with graceful degradation: if the key is missing in the active
// locale we fall back to RU (we always ship the full RU dictionary), and
// if it's missing there too we return the key itself so it's obvious
// during development.
export function translate(locale: Locale, key: string): string {
  const value = messages[locale]?.[key] ?? messages[DEFAULT_LOCALE]?.[key];
  return value ?? key;
}

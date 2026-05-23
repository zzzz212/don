# 📋 ФАЗА 3: Расширенная функциональность

## 🎯 Три стратегических расширения

---

## 1️⃣ ПОЛНАЯ БАЗА ЗНАНИЙ РОССИЙСКОГО ПРАВА

### Описание
Встроенная справочная система со статьями ГК РФ, ТК РФ, других законов — с поиском и контекстной привязкой.

### Архитектура

#### БД (Prisma)
```prisma
model LegalKnowledge {
  id            String   @id @default(cuid())
  code          String   @unique // "gk_rf_432", "tk_rf_71"
  type          String   // "statute" | "article" | "clause"
  title         String
  shortTitle    String
  fullText      String   @db.Text
  commentary    String?  @db.Text // Пояснения и примеры
  practiceNotes String?  @db.Text // Судебная практика
  relatedCodes  String[] // ["gk_rf_430", "gk_rf_433"]
  
  tags          String[] // ["contracts", "liability", "damages"]
  searchVector  String   @db.Text // Для полнотекстового поиска
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([code])
  @@index([tags])
  @@fulltext([searchVector]) // MySQL/PostgreSQL поддержка
}

model LegalReference {
  id        String   @id @default(cuid())
  userId    String
  knownId   String
  note      String?
  
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  knowledge LegalKnowledge @relation(fields: [knownId], references: [id], onDelete: Cascade)
  
  @@unique([userId, knownId])
}
```

#### API endpoints
```
GET  /api/legal/search?q=ответственность&limit=10
GET  /api/legal/code/:code (ст. 432 ГК РФ)
GET  /api/legal/related/:code (связанные статьи)
POST /api/legal/save-reference (сохранить в закладки)
GET  /api/legal/my-references
```

#### Фронтенд
- Новая вкладка **"Справочник"** в главном меню
  - Поле поиска (с автодополнением + фильтры по типу)
  - Результаты со статьей (текст + комментарий + судебная практика)
  - Кнопка "Сохранить" (в закладки)
  - Ссылки на связанные статьи (граф)
  
- Модальное окно при клике на цитату из анализа
  - "Узнать больше о ст. 333 ГК РФ"
  - Прямое открытие соответствующей страницы справочника

#### Источники данных
1. **Парсинг**: Consultant.ru, Zakon.ru API
2. **Или** готовые datasets (LawFirm API)
3. **Или** ручное внесение (парсер + validation)

#### Таймлайн
- **Неделя 1**: Создание БД, парсер, загрузка 500 основных статей
- **Неделя 2**: API endpoints, поиск, полнотекстовый индекс
- **Неделя 3**: Фронтенд + интеграция с анализом контрактов
- **Неделя 4**: Комментарии, судебная практика, граф связей

---

## 2️⃣ СРАВНЕНИЕ ВЕРСИЙ ДОГОВОРОВ (Versioning)

### Описание
Способность сохранять разные версии документа, сравнивать их и видеть все изменения.

### Архитектура

#### БД
```prisma
model DocumentVersion {
  id              String   @id @default(cuid())
  generatedDocId  String
  versionNumber   Int      // 1, 2, 3...
  title           String   // "v1", "v2 — с правками", и т.д.
  content         String   @db.Text
  formData        Json     // Исходные данные формы
  changesSummary  String?  // "Изменена ст. 3.1, добавлена ст. 5"
  
  createdAt       DateTime @default(now())
  createdBy       String   // userId
  
  generatedDoc    GeneratedDocument @relation(fields: [generatedDocId], references: [id], onDelete: Cascade)
  creator         User     @relation(fields: [createdBy], references: [id], onDelete: SetNull)
  
  @@unique([generatedDocId, versionNumber])
  @@index([generatedDocId, versionNumber])
}

model VersionComparison {
  id        String   @id @default(cuid())
  v1Id      String
  v2Id      String
  userId    String
  
  diffs     Json     // [{type: "added" | "removed" | "changed", section, oldText, newText}]
  
  createdAt DateTime @default(now())
  
  v1        DocumentVersion @relation("fromVersion", fields: [v1Id], references: [id], onDelete: Cascade)
  v2        DocumentVersion @relation("toVersion", fields: [v2Id], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([v1Id, v2Id, userId])
}
```

#### API endpoints
```
POST /api/generated/:id/create-version
  { title: "v2 — с поправками контрагента" }

GET  /api/generated/:id/versions
  → [{versionNumber, title, createdAt, createdBy}]

GET  /api/generated/:id/version/:vNumber
  → {content, formData, changesSummary}

GET  /api/versions/compare/:v1/:v2
  → [{type, section, oldText, newText, lineNumber}]

POST /api/versions/revert/:id/:vNumber
  → создаёт новую версию на основе старой
```

#### Фронтенд
**Страница просмотра документа** (`/generated/[id]`):
- Новая вкладка **"Версии"** (рядом с основным просмотром)
  - Список всех версий: дата, кто создал, название
  - Выбор версии → открывается просмотр
  - Кнопка "Сравнить с..." → выбрать другую версию

**Страница сравнения** (`/generated/[id]/compare/[v1]/[v2]`):
- Два столбца (рядом):
  - Слева: версия v1
  - Справа: версия v2
- Все изменения подсвечены:
  - 🔴 Удалено (красный фон)
  - 🟢 Добавлено (зеленый фон)
  - 🟡 Изменено (жёлтый фон)
- Счётчик изменений (X добавлений, Y удалений, Z изменений)
- Кнопка "Вернуться на версию v1"

**Форма создания версии**:
- После изменения данных формы:
  - Кнопка "Создать версию v2"
  - Диалог: название + опциональный комментарий
  - Автоматически генерируется summary changes

#### Таймлайн
- **Неделя 1**: Модель БД, API для создания/получения версий
- **Неделя 2**: Алгоритм сравнения (diff), хранение различий
- **Неделя 3**: Фронтенд просмотра версий, split-view сравнение
- **Неделя 4**: Highlight изменений, revert, UI polish

---

## 3️⃣ ЮРИДИЧЕСКИЙ СКОРИНГ КОНТРАГЕНТОВ

### Описание
Автоматическое получение информации о контрагенте по ИНН из открытых источников (ЕГРЮЛ, судебные реестры, долги) + расчёт риск-скора.

### Архитектура

#### БД
```prisma
model CounterpartyProfile {
  id            String   @id @default(cuid())
  inn           String   @unique
  name          String
  organizationType String  // "ООО" | "ИП" | "ИП"
  
  // Из ЕГРЮЛ
  registrationDate DateTime?
  address       String?
  okved         String?   // Основной вид деятельности
  capitalSize   Int?
  statusCode    String?   // "активна" | "ликвидация" | и т.д.
  
  // Из судебных реестров
  activeLawsuits Int? @default(0)    // Текущие судебные дела
  completedLawsuits Int? @default(0) // Закрытые дела
  lossesCount   Int? @default(0)     // Проигранные дела
  
  // Долги и платежи
  debtFound     Boolean? @default(false)
  debtAmount    BigInt?
  debtSources   String[] // ["налоги", "алименты", "штрафы"]
  
  // Расчётный скор
  riskScore     Int // 0-100 (0 = зелёный, 50 = жёлтый, 100 = красный)
  riskLevel     String // "low" | "medium" | "high" | "critical"
  riskFactors   String[] // ["active_lawsuits", "debt", "registration_recent", и т.д.]
  
  lastUpdated   DateTime @updatedAt
  dataSource    String // "egrul" | "kad" | "fedresurs" | и т.д.
  
  createdAt     DateTime @default(now())
}

model CounterpartyCheck {
  id            String   @id @default(cuid())
  userId        String
  documentId    String?  // Если связано с документом
  inn           String
  profile       CounterpartyProfile @relation(fields: [inn], references: [inn], onDelete: Cascade)
  
  notes         String?  // Пользовательский комментарий
  
  createdAt     DateTime @default(now())
  
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

#### API endpoints
```
POST /api/counterparty/check
  { inn: "7701234567" }
  → {profile, riskScore, riskLevel, details}

GET  /api/counterparty/:inn
  → полный профиль контрагента

GET  /api/counterparty/batch-check
  { inns: ["7701234567", "7702345678"] }
  → [{inn, riskScore, riskLevel}]

GET  /api/counterparty/:inn/lawsuits
  → список судебных дел (с деталями)

GET  /api/counterparty/:inn/debts
  → список долгов (налоги, штрафы, и т.д.)

POST /api/counterparty/:inn/note
  { note: "Деловые партнёры 3 года" }
```

#### Интеграция с внешними API

**1. ЕГРЮЛ (ФНС России)**
```
API: https://egrul.nalog.ru
Доступ: публичный, без авторизации
Формат: JSON

GET https://egrul.nalog.ru/api/v1/person/legal?inn=7701234567
```

**2. КАД (Краткая информация о делах)**
```
API: https://kad.arbitr.ru
Доступ: публичный, но требует парсинга HTML
Способ: Selenium или Puppeteer для скрейпинга

Поиск по ИНН → получить список дел
```

**3. ФЕДРЕСУРС (долги)**
```
API: https://fedresurs.ru/
Доступ: публичный (требует парсинга)
Данные: информация о долгах физ./юр. лиц
```

**4. ФССП (судебные приставы)**
```
API: https://api.fssprus.ru/ (если доступен)
Или парсинг: https://service.fssp.gov.ru/
```

#### Алгоритм рассчёта Risk Score

```
Базовый скор: 30 (нейтральный)

Вычитаем баллы (риск ↓):
- Основана > 5 лет назад: -10
- Статус "активна": -5
- Нет судебных дел: -5
- Нет долгов: -10

Добавляем баллы (риск ↑):
- Активные судебные дела (каждое): +5 (макс +20)
- Проигранные дела: +10 (макс +20)
- Долги найдены: +15
- Налоговые долги: +10
- Статус "ликвидация/ликвидирована": +30
- Основана < 6 месяцев: +15
- Множество судебных дел: +10

Итоговый скор: 0-100

Уровни риска:
- 0-25: 🟢 LOW (зелёный)
- 26-50: 🟡 MEDIUM (жёлтый)
- 51-75: 🟠 HIGH (оранжевый)
- 76-100: 🔴 CRITICAL (красный)
```

#### Фронтенд

**Новая вкладка "Контрагенты"** (в главном меню):
- Поле ввода ИНН
- Кнопка "Проверить"
- Результаты со скором:
  - Риск-бар (0-100, цветной)
  - Статус (активна / ликвидация / и т.д.)
  - Основана (дата)
  - Вид деятельности
  - **АКТИВНЫЕ СУДЕБНЫЕ ДЕЛА** (кнопка → список)
  - **ДОЛГИ** (кнопка → детали)
  - Ваш комментарий (textarea)

**Интеграция в форму договора**:
- При заполнении ИНН в поле "Контрагент":
  - Автоматический поиск профиля
  - Мини-скор контрагента под полем (зелёный/жёлтый/красный)
  - Кнопка "Подробнее" → открывает полный профиль в модальном окне

**История проверок**:
- Вкладка "Проверки" в личном кабинете
- Все проверённые контрагенты (с датами, скорами)
- Возможность снова открыть деталь

#### Таймлайн

- **Неделя 1**: 
  - Создание БД, парсер ЕГРЮЛ
  - API endpoints для сохранения профилей
  - Кэширование (Redis)
  
- **Неделя 2**:
  - Интеграция с КАД (судебные дела)
  - Интеграция с ФЕДРЕСУРС (долги)
  - Алгоритм расчёта Risk Score
  
- **Неделя 3**:
  - Фронтенд вкладка "Контрагенты"
  - Интеграция в форму договора
  - История проверок
  
- **Неделя 4**:
  - Уведомления (риск контрагента)
  - Мониторинг (следить за изменениями)
  - Экспорт отчёта

---

## 🏗️ ПЛАН РЕАЛИЗАЦИИ

### Приоритизация по impact × effort

```
                  HIGH IMPACT
                       ↑
                       │
 Юридический скор      │  + Сравнение версий
      (3️⃣)            │      (2️⃣)
                       │
───────────────────────┼──────────────────→ EFFORT
                       │
 База знаний (1️⃣)     │
      (LOW)            │  
                       ↓
                   LOW IMPACT
```

### Рекомендуемый порядок

**1️⃣ Юридический скор контрагентов** (3-4 недели)
- Наибольший продуктовый impact
- Привлекает пользователей (быстрая проверка)
- Окупает затраты на парсинг

**2️⃣ Сравнение версий** (3-4 недели)
- Быстрая реализация (в основном фронтенд)
- Высокая ценность для power users
- Меньше зависит от внешних API

**3️⃣ База знаний права** (4 недели)
- Долгосрочный проект
- Требует большого объёма контента
- Но очень важна для стратегии

---

## 🔧 ТЕХНОЛОГИЧЕСКИЙ СТЕК

### Бэкенд
- **Парсинг**: Puppeteer, Cheerio, Selenium
- **Кэширование**: Redis (кэш профилей на 1 месяц)
- **Очередь**: Bull/RabbitMQ (для асинхронного парсинга)
- **Поиск**: Elasticsearch или PostgreSQL full-text search
- **API интеграции**: axios, node-fetch

### Фронтенд
- **Split-view**: react-split-pane
- **Diff viewer**: react-diff-viewer
- **Rich text preview**: react-markdown
- **Modal**: существующая система (Headless UI)

### БД
- **Версионирование**: JSON diff (jsondiffpatch)
- **Полнотекстовый поиск**: PostgreSQL GIN index
- **Кэширование**: Redis

---

## 💰 ПРИМЕРНАЯ ОЦЕНКА

| Фича | Effort | Cost | ROI |
|------|--------|------|-----|
| Юридический скор | 3-4 нед | $12-16K | ⭐⭐⭐⭐⭐ |
| Версии договоров | 2-3 нед | $8-12K | ⭐⭐⭐⭐ |
| База знаний | 4+ нед | $16-20K | ⭐⭐⭐⭐ |
| **ИТОГО** | **9-11 нед** | **$36-48K** | **⭐⭐⭐⭐⭐** |

---

## ✅ ПРОВЕРОЧНЫЙ ЛИСТ

- [ ] БД миграции созданы
- [ ] API endpoints реализованы
- [ ] Парсеры внешних источников работают
- [ ] Фронтенд компоненты разработаны
- [ ] Интеграции протестированы
- [ ] Кэширование настроено
- [ ] Уведомления добавлены
- [ ] Экспорт работает
- [ ] Тесты написаны
- [ ] Документация обновлена

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ ВОЗМОЖНОСТИ (Future)

- **Мониторинг контрагентов**: отслеживание изменений в профиле
- **Batch-проверки**: загрузка CSV со списком ИНН
- **Рейтинг партнёров**: публичный рейтинг надёжности
- **Интеграция с CRM**: синхронизация контрагентов
- **Уведомления**: email/SMS при изменении статуса
- **Договор-конструктор**: автоматическое генерирование с учётом рисков
- **Аналитика**: статистика по судебным делам, долгам по индустриям


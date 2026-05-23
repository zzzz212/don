# Миграция на Neon PostgreSQL для продакшна

## 📋 Текущее состояние

- **Локальная разработка**: SQLite (файл `dev.db`) ✅
- **Продакшн**: нужен PostgreSQL (Neon рекомендуется)
- **Код**: готов для обоих БД (одна схема работает везде)

## 🚀 Шаг за шагом: переход на Neon

### 1. Создать проект Neon (5 мин)

1. Перейти на **https://console.neon.tech/**
2. Зарегистрироваться (GitHub / Email)
3. Создать новый проект (выбрать регион ближе к хостингу)
4. Скопировать **Connection String** (выглядит так):
   ```
   postgresql://user:password@ep-xxxxx.region.neon.tech/neondb
   ```

### 2. Обновить переменные окружения

**Для .env.production или Vercel/Railway settings:**

```bash
# Замените на свой Neon URL
DATABASE_URL=postgresql://user:password@ep-xxxxx.region.neon.tech/neondb

# Остальное остаётся как есть
AUTH_SECRET="generate-new-secret"
AUTH_TRUST_HOST=true

# Выбрать ONE ключ AI:
GEMINI_API_KEY=...  # или ANTHROPIC_API_KEY
```

### 3. Обновить Prisma schema для продакшна

**При деплое на хостинг:**

1. Откройте `prisma/schema.prisma`
2. Измените провайдер:
   ```prisma
   datasource db {
     provider = "postgresql"  # Было "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

3. **Локально остаётся SQLite**:
   ```bash
   # .env (dev)
   DATABASE_URL="file:./dev.db"
   ```

### 4. Запустить миграции на Neon

**Первый раз (создание таблиц):**

```bash
# Локально сгенерируем миграцию (если есть изменения схемы)
npx prisma migrate dev --name initial

# Затем деплоим на Neon
npx prisma migrate deploy
```

**На хостинге (автоматический деплой):**
```bash
# В процессе деплоя скрипт должен запустить:
npx prisma generate
npx prisma migrate deploy
npx prisma db seed  # если есть seed скрипт
```

### 5. Инициализировать справочник (seed данные)

После миграции один раз запустить:

```bash
curl -X POST https://your-app.com/api/admin/seed-legal \
  -H "x-admin-key: your-secret-admin-key"
```

## 🔧 Оптимальная конфигурация

| Окружение | БД | Переменные |
|-----------|----|-----------| 
| **Разработка (npm run dev)** | SQLite | `.env` с `file:./dev.db` |
| **Продакшн (Vercel/Railway)** | Neon PostgreSQL | `.env.production` с Neon URL |
| **Staging** | Neon PostgreSQL | `.env.staging` с отдельным проектом Neon |

## 🌐 Хостинги, которые хорошо работают с Neon

### Рекомендуемые:

1. **Vercel** (лучше всего для Next.js)
   - Автоматический деплой из GitHub
   - Встроенная поддержка переменных окружения
   - Команды миграции можно запустить в `vercel.json`

2. **Railway.app**
   - Simple Redis + PostgreSQL
   - Автоматическое масштабирование
   - Бесплатно на начальном уровне

3. **Render.com**
   - Поддержка Next.js
   - Встроенный PostgreSQL, но лучше использовать Neon

### Что не использовать:

- ❌ Heroku (платный, медленный)
- ❌ Replit (ограничения на БД)

## 📋 Пример деплоя на Vercel

### 1. Подключить GitHub

```bash
# На GitHub создайте новый репозиторий
git remote add github https://github.com/you/don.git
git push github main
```

### 2. Подключить в Vercel

1. Перейти на https://vercel.com
2. "New Project" → выбрать репозиторий
3. Указать переменные окружения:
   ```
   DATABASE_URL = postgresql://...
   AUTH_SECRET = your-secret
   GEMINI_API_KEY = your-key
   ```
4. Деплой!

### 3. Запустить миграции в Vercel

В `vercel.json` добавьте hooks:
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "env": {
    "DATABASE_URL": "@database_url"
  }
}
```

Миграции запустятся автоматически перед `npm run build`.

## ⚡ Оптимизация для продакшна

После деплоя:

1. **Включить логирование**:
   ```env
   DEBUG=prisma:*  # Или Sentry для ошибок
   ```

2. **Настроить кэширование**:
   - CloudFlare CDN для статики
   - Redis для сессий (если Neon слишком нагружен)

3. **Мониторинг Neon**:
   - В консоли Neon смотреть "Monitoring"
   - Alert на превышение CPU/подключений

## 🐛 Часто встречаемые ошибки

### "Can't reach database server"
- Проверить DATABASE_URL
- Убедиться что Neon проект запущен
- Добавить IP адрес хостинга в Neon firewall

### "too many connections"
- Уменьшить `max_pool_size` в Prisma:
  ```prisma
  datasource db {
    url = env("DATABASE_URL")
    extensions = [pgvector]
  }
  ```

### "migration failed"
- Запустить `npx prisma migrate resolve --rolled-back migration_name`
- Или полностью пересоздать БД и seed заново

## 📞 Контакты Neon support

- Документация: https://neon.tech/docs
- Discord: https://neon.tech/discord
- Email: support@neon.tech

## Чек-лист перед продакшном

- [ ] DATABASE_URL указана правильно
- [ ] `prisma/schema.prisma` использует "postgresql"
- [ ] `npx prisma generate` выполнен
- [ ] Миграции применены: `npx prisma migrate deploy`
- [ ] Seed данные загружены: `/api/admin/seed-legal`
- [ ] DADATA_API_KEY (если используется) добавлен
- [ ] AUTH_SECRET сгенерирован (не "abc123")
- [ ] Логирование настроено (Sentry или CloudWatch)
- [ ] Тест эндпоинта: `curl https://your-app.com/api/counterparty/check`

# Quickstart: Деплой приложения

## Локальная проверка контейнера

```bash
# Собрать образ
docker build -t training-app .

# Запустить контейнер с переменными окружения
docker run -d --name training-app \
  -p 8000:8000 \
  -v $(pwd)/db:/app/db \
  -e TELEGRAM_BOT_TOKEN="test-token" \
  -e SECRET_KEY="test-secret-key" \
  -e TELEGRAM_WEBAPP_URL="https://example.com" \
  -e ALLOWED_HOSTS="localhost,127.0.0.1" \
  training-app

# Проверить что Django отвечает
curl http://localhost:8000/api/programs/

# Проверить логи (gunicorn + bot)
docker logs training-app

# Остановить и удалить
docker stop training-app && docker rm training-app
```

## Проверка CI/CD

1. Настроить GitHub Secrets в репозитории:
   - `SSH_HOST` — IP сервера
   - `SSH_USER` — пользователь SSH
   - `SSH_KEY` — приватный SSH-ключ
   - `TELEGRAM_BOT_TOKEN` — токен бота
   - `SECRET_KEY` — Django secret key
   - `TELEGRAM_WEBAPP_URL` — URL Mini App
   - `ALLOWED_HOSTS` — разрешённые хосты

2. Запушить в main → Actions workflow запускается автоматически

3. Проверить в GitHub Actions:
   - Job "test" прошёл
   - Job "build" собрал и запушил образ в ghcr.io
   - Job "deploy" подключился к серверу и перезапустил контейнер

## Проверка на сервере

```bash
# Проверить что контейнер запущен
docker ps | grep training-app

# Проверить логи
docker logs training-app

# Проверить что приложение отвечает
curl http://localhost:8000/api/programs/
```

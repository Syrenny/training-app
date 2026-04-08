# training-app
Simple training app to provide automatic calculation of weights

## Docker Compose

Development uses [docker-compose.yml](/home/syrenny/Desktop/clones/training-app/docker-compose.yml):

- `web`: Django `runserver` with autoreload and bind-mounted backend code
- `bot`: Telegram bot worker sharing the same mounted backend code
- `frontend`: Vite dev server with bind-mounted frontend code

Example local startup:

```bash
mkdir -p data/db
docker compose up --build
```

In Docker-based development, the frontend proxies API requests to the `web` service through `VITE_API_PROXY_TARGET=http://web:8000`.

Production uses [compose.prod.yaml](/home/syrenny/Desktop/clones/training-app/compose.prod.yaml):

- `web`: Django + Gunicorn + migrations, also serves the built SPA and static files
- `bot`: Telegram bot worker using the same prebuilt application image as `web`

Useful files:

- [.env.dev.example](/home/syrenny/Desktop/clones/training-app/.env.dev.example)
- [.env.prod.example](/home/syrenny/Desktop/clones/training-app/.env.prod.example)
- [backend/.env.example](/home/syrenny/Desktop/clones/training-app/backend/.env.example)

Useful environment variables:

- `SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_WEBAPP_URL`
- `ALLOWED_HOSTS`
- `APP_DB_DIR`
- `WEB_PORT`

For Telegram website login outside the Mini App, configure the bot domain in `@BotFather` and expose the site over HTTPS.

Settings are split into:

- `config.settings.base`
- `config.settings.dev`
- `config.settings.prod`

For backend-only local development and maintenance commands, use `uv`:

```bash
cd backend
uv run python manage.py migrate
uv run pytest tests -q
```

Production compose startup:

```bash
docker compose -f compose.prod.yaml --env-file .env.production up -d
```

If Caddy runs directly on the host, publish only `web` on loopback and proxy Caddy to it:

```caddy
your-domain.example {
    reverse_proxy 127.0.0.1:8000
}
```

Recommended production binding:

- `WEB_BIND_HOST=127.0.0.1`
- `WEB_PORT=8000`

In this setup:

- `web` is the only published container
- `bot` exposes no ports

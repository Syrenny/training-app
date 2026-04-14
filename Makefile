.DEFAULT_GOAL := dev

.PHONY: dev con migrate mm mmm seed sh dbsh createsuperuser \
	build test-backend lint clean 

ENV_FILE := .env
COMPOSE_FILE_NAME := $(shell grep -E "^COMPOSE_FILE_NAME=" $(ENV_FILE) 2>/dev/null | cut -d '=' -f2 | tr -d ' ' | tr -d '"' | tr -d "'")
COMPOSE_FILE := $(if $(COMPOSE_FILE_NAME),$(COMPOSE_FILE_NAME),compose.yaml)
DC := docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE)
PM := $(DC) exec web
ENV_INFO = @echo "Compose file: $(COMPOSE_FILE) | Service: web"

con:
	$(ENV_INFO)
	$(PM) sh

m:
	$(ENV_INFO)
	$(PM) python manage.py migrate $(app)

mm:
	$(ENV_INFO)
	$(PM) python manage.py makemigrations $(app)

mmm:
	$(ENV_INFO)
	$(PM) python manage.py makemigrations $(app)
	$(PM) python manage.py migrate $(app)

seed:
	$(ENV_INFO)
	$(PM) python manage.py seeddata --dev-user

sh:
	$(ENV_INFO)
	$(PM) python manage.py shell

dbsh:
	$(ENV_INFO)
	$(PM) python manage.py dbshell

createsuperuser:
	$(ENV_INFO)
	$(PM) python manage.py createsuperuser

test-backend:
	cd backend && uv run python manage.py test tests/ --verbosity=2

lint:
	cd frontend && npx tsc --noEmit

clean:
	rm -rf backend/db.sqlite3 backend/staticfiles backend/static/frontend
	rm -rf frontend/dist frontend/node_modules/.vite

dev:
	$(DC) up -d

down:
	$(DC) down
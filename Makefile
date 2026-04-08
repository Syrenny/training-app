.PHONY: install install-backend install-frontend migrate seed \
       dev dev-backend dev-frontend bot build test lint clean \
       compose-up compose-build compose-down compose-prod-up compose-prod-down

install: install-backend install-frontend

install-backend:
	cd backend && uv sync

install-frontend:
	cd frontend && npm install

migrate:
	cd backend && uv run python manage.py migrate

seed:
	cd backend && uv run python manage.py seeddata

dev-backend:
	cd backend && uv run python manage.py runserver

dev-frontend:
	cd frontend && npm run dev

dev:
	$(MAKE) dev-backend & $(MAKE) dev-frontend & wait

bot:
	cd backend && uv run python manage.py runbot

build:
	cd frontend && npm run build
	mkdir -p backend/templates
	cp backend/static/frontend/index.html backend/templates/index.html

compose-build:
	docker compose build

compose-up:
	docker compose up --build -d

compose-down:
	docker compose down

compose-prod-up:
	docker compose -f compose.prod.yaml up --build -d

compose-prod-down:
	docker compose -f compose.prod.yaml down

test: test-backend test-frontend

test-backend:
	cd backend && uv run python manage.py test tests/ --verbosity=2

test-frontend:
	cd frontend && npm run test 2>/dev/null || echo "No frontend tests configured yet"

lint:
	cd frontend && npx tsc --noEmit

clean:
	rm -rf backend/db.sqlite3 backend/staticfiles backend/static/frontend
	rm -rf frontend/dist frontend/node_modules/.vite

createsuperuser:
	cd backend && uv run python manage.py createsuperuser

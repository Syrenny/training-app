#!/bin/sh

docker compose -f compose.prod.yaml --env-file .env.production up -d --build
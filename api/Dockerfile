# Build from repo root: docker compose build api (context: .)
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache bash curl && corepack enable

# Yarn 4 monorepo — lockfile lives at repository root
COPY package.json yarn.lock .yarnrc.yml ./
COPY api/package.json ./api/package.json
COPY client/package.json ./client/package.json

RUN yarn install --immutable

COPY api ./api

WORKDIR /app/api

RUN yarn build

RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]

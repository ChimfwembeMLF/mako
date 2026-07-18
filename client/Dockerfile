# Build from repo root: docker compose build client (context: .)
FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN corepack enable

# Install all deps (incl. dev) for Vite build — Dokploy often sets NODE_ENV=production
ENV NODE_ENV=development

COPY package.json yarn.lock .yarnrc.yml ./
COPY api/package.json ./api/package.json
COPY client/package.json ./client/package.json

RUN yarn install --immutable

COPY client ./client

WORKDIR /app/client

ENV DISABLE_PWA=true

RUN yarn build

FROM nginx:alpine

COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]

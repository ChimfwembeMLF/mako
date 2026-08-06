FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json yarn.lock .yarnrc.yml ./
COPY api/package.json ./api/package.json
COPY client/package.json ./client/package.json
RUN --mount=type=cache,target=/root/.yarn/berry/cache yarn install --immutable || yarn install

FROM base AS build
COPY package.json yarn.lock .yarnrc.yml ./
COPY api/package.json ./api/package.json
COPY client/package.json ./client/package.json
COPY --from=deps /app/node_modules ./node_modules
RUN yarn workspaces focus custom-template-api
COPY api ./api
WORKDIR /app/api
RUN yarn build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app/api
COPY --from=build /app/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/api/package.json ./
EXPOSE 4000
CMD ["node", "dist/main.js"]

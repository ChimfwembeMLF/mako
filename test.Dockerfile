FROM node:20-alpine
RUN corepack enable
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY api/package.json ./api/package.json
COPY client/package.json ./client/package.json
RUN yarn install --immutable || yarn install
RUN yarn workspaces focus custom-template-api
COPY api ./api
WORKDIR /app/api
RUN yarn build
RUN ls -la dist

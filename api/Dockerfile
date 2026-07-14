FROM node:20-alpine

WORKDIR /app

# Install required dependencies (curl for Docker healthcheck)
RUN apk add --no-cache \
      nodejs \
      yarn \
      bash \
      curl

# Enable Corepack to use the correct Yarn version
RUN corepack enable

# Copy dependency files
COPY package.json yarn.lock .yarnrc.yml ./

# Install dependencies
RUN yarn install --immutable

# Copy source code
COPY . .

# Build the application
RUN yarn build

EXPOSE 4000

CMD ["yarn", "start:prod"]

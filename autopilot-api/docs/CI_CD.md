# CI/CD — GitHub Actions

Workflows live in the repo root at `.github/workflows/`.

## CI (`ci.yml`)

Runs on pull requests and pushes to `main` when files under `autopilot-api/` change.

| Job | Required | What it does |
|-----|----------|--------------|
| **build** | Yes | `yarn install` + client `npm ci` + `yarn build` (Vite + Nest) |
| **test-client** | Yes | `vitest run` in `resources/client` |
| **test-api** | Advisory | `yarn test` (unit tests; does not block merges yet) |
| **lint** | Advisory | `yarn lint:ci` + client ESLint (does not block merges yet) |

### Branch protection (recommended)

In GitHub → **Settings → Branches → Branch protection rules** for `main`:

1. Require status check **Build (API + client)**
2. Require status check **Test (client)**
3. Optionally require PR reviews before merge

## CD (`deploy-production.yml`)

Deploys to production when `main` is updated (same path filter as CI), or manually via **Actions → Deploy Production → Run workflow**.

On the server it:

1. `git pull` in `DEPLOY_PATH`
2. Runs `yarn deploy:prod` in `autopilot-api/` (install, build, migrations, PM2 restart)

Manual runs can skip migrations by unchecking **Run database migrations during deploy**.

### GitHub secrets

Add these under **Settings → Secrets and variables → Actions**:

| Secret | Example | Purpose |
|--------|---------|---------|
| `DEPLOY_HOST` | `mako.tekreminnovations.com` | SSH hostname |
| `DEPLOY_USER` | `deploy` | SSH user |
| `DEPLOY_SSH_KEY` | *(private key)* | PEM private key for `DEPLOY_USER` |
| `DEPLOY_PATH` | `/home/deploy/autopilot` | Absolute path to the **git repo root** on the server |

Deploy uses SSH port **22** by default. Use a non-standard port via an SSH `ProxyCommand` / bastion, or edit the workflow if your host requires a different port.

### GitHub environment

The deploy job uses the **production** environment. Create it under **Settings → Environments** to add approval gates or environment-scoped secrets.

### Server prerequisites

The server must already have:

- Git clone of this repo at `DEPLOY_PATH`
- Node.js 20+, Corepack/Yarn 4, npm, PM2
- `autopilot-api/.env` filled from `docs/env.mako.production.server.template`
- PM2 app configured (`ecosystem.config.json` — see `docs/DEPLOY.md`)

Deploy user SSH key should be authorized in `~/.ssh/authorized_keys`. The server's deploy key or HTTPS credentials must allow `git pull` from GitHub.

### First-time server setup

```bash
cd autopilot-api
cp docs/env.mako.production.server.template .env   # edit secrets
yarn install:all
yarn build
yarn db:sync
yarn migrations:run:prod
yarn seed:prod
yarn pm2:start
yarn pm2:save
yarn pm2:startup   # run the sudo command it prints
```

After that, pushes to `main` deploy automatically (or trigger **Deploy Production** manually).

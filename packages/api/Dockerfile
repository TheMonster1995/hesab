# Debian "slim" (not Alpine): Prisma's engines detect OpenSSL 3 here out of the
# box. On Alpine (musl) Prisma often fails to detect libssl and the schema
# engine won't launch.

# ---- build stage ----
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install workspace deps using the root lockfile for reproducibility.
# npm ci validates the lockfile against ALL workspaces, so both manifests
# must be present even though this image only builds the api.
COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/package.json
COPY packages/web/package.json packages/web/package.json
RUN npm ci

COPY packages/api ./packages/api
RUN npm run prisma:generate -w @hesab/api
RUN npm run build -w @hesab/api

# ---- runtime stage ----
FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/api ./packages/api

WORKDIR /app/packages/api
EXPOSE 4000
# Apply any pending migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

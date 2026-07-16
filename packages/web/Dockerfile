# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# npm ci validates the lockfile against ALL workspaces, so both manifests
# must be present even though this image only builds the web client.
COPY package.json package-lock.json ./
COPY packages/web/package.json packages/web/package.json
COPY packages/api/package.json packages/api/package.json
RUN npm ci

COPY packages/web ./packages/web
RUN npm run build -w @hesab/web

# ---- runtime stage: static files served by nginx, /graphql proxied to the api ----
FROM nginx:alpine AS run
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80

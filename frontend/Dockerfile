FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# Patch OS packages: base images lag behind Alpine security fixes
# (Trivy gates the deploy on HIGH/CRITICAL CVEs).
RUN apk --no-cache upgrade
# Site config is mounted from deploy/nginx.conf by docker-compose.prod.yml so
# proxy/TLS changes do not require an image rebuild.
COPY --from=build /app/dist /usr/share/nginx/html

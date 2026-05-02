# syntax=docker/dockerfile:1

#  Build stage
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_ vars are baked into the JS bundle at build time.
# VITE_API_URL is intentionally omitted — the app falls back to
# window.location.origin so nginx can proxy without a hardcoded URL.
ARG VITE_DASHBOARD_TOKEN=dev-token
ENV VITE_DASHBOARD_TOKEN=$VITE_DASHBOARD_TOKEN

RUN npm run build

# Serve stage (mirrors S3 static hosting) 
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# AgroArc frontend image (Heroku-compatible).
# Multi-stage: Vite/Node builds the SPA, Nginx serves the static bundle.
# Build from the frontend/ directory:
#   docker build -t agroarc-frontend:latest ./frontend
#
# Heroku notes:
#   - Nginx listens on $PORT (Heroku injects it). Locally it defaults to 80.
#   - VITE_API_BASE_URL must be set at build time (bundled into the JS).

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Override at build time:
#   docker build --build-arg VITE_API_BASE_URL=https://my-api.herokuapp.com ...
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build


# ---------- Stage 2: Runtime ----------
FROM nginx:1.27-alpine AS runtime

# nginx:alpine's docker-entrypoint.d/20-envsubst-on-templates.sh will
# render any files in /etc/nginx/templates/*.template through envsubst at
# container start. NGINX_ENVSUBST_FILTER_VARIABLES restricts substitution
# to PORT so nginx's own $uri / $host placeholders are left untouched.
ENV PORT=80 \
    NGINX_ENVSUBST_FILTER_VARIABLES="PORT"

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]

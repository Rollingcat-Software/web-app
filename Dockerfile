# app.fivucsas.com — Vite SPA (PWA) served by nginx behind Traefik.
# Migrated off Hostinger (plan cancelled 2026-06) onto the Hetzner box.
# Packages the pre-built dist/ (incl. the 14 MB client-side ML models under
# dist/models/). CI rebuilds dist/ first, so the same Dockerfile works in CI.
FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY dist/ /usr/share/nginx/html/
EXPOSE 80

# ── Build stage ──────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=/
ENV VITE_API_URL=$VITE_API_URL VITE_SOCKET_URL=$VITE_SOCKET_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Nginx stage ──────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

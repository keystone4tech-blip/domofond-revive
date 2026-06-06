# Stage 1: Build React/Vite App
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем зависимости и устанавливаем их
COPY package*.json ./
RUN npm install

# Копируем весь код и собираем продакшен билд
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=1536" npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Копируем конфиг nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранный проект из первого этапа
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

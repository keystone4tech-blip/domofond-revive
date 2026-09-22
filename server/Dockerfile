FROM node:20-alpine

# Установка postgresql-client, gzip и bash для создания резервных копий базы данных через pg_dump
RUN apk add --no-cache postgresql-client gzip bash

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Создаем директорию для хранения локальных резервных копий
RUN mkdir -p /backups

EXPOSE 5000

# Запуск рабочего сервера Node.js
CMD ["node", "index.js"]

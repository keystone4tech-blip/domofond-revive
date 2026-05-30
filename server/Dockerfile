FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

# В продакшене используем node, а не nodemon/dev-сервер
CMD ["node", "index.js"]

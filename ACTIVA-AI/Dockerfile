FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate && npm prune --omit=dev

USER node
EXPOSE 3000

CMD ["node", "server/index.js"]

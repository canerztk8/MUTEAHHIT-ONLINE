FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY server/ ./server/

ENV PORT=7860
EXPOSE 7860

CMD ["node", "server/index.js"]

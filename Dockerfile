FROM node:20-alpine

# Instala openssl necessário para a engine do Prisma ORM no Alpine Linux
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3001

CMD ["npm", "start"]

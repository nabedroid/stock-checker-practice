FROM node:20-alpine

WORKDIR /app

EXPOSE 5173

COPY ./stocker/package.json ./
RUN npm install
COPY ./stocker/ .
COPY ./common/ .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

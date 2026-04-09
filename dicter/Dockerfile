FROM node:20-alpine

WORKDIR /app

EXPOSE 3001

COPY ./dicter/package.json ./
RUN npm install
COPY ./dicter/ .
COPY ./common/ .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

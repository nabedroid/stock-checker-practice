FROM node:20-alpine

WORKDIR /app

EXPOSE 3001

COPY ./manager/package.json ./
RUN npm install
COPY ./manager/ .
COPY ./common/ .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

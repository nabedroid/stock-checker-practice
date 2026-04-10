FROM node:20-alpine

WORKDIR /app

EXPOSE 5173

COPY ./main/package.json ./
RUN npm install
COPY ./main/ .
COPY ./common/ .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

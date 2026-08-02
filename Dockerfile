# Dockerfile
FROM ghcr.io/synthetixio/docker-node/alpine:20.0
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
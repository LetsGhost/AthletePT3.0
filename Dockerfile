# Dev-only image
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig*.json ./
COPY nodemon.json ./
COPY src ./src

ENV NODE_ENV=development
ENV PORT=3000

# Expose app port
EXPOSE 3000

# Run with ts-node-dev for live reload
CMD ["npm", "run", "dev"]
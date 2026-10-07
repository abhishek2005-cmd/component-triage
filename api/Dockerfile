FROM node:22-alpine

WORKDIR /app/api
COPY api/package*.json ./
RUN npm ci --omit=dev
COPY api/src ./src
COPY api/scripts ./scripts
COPY data/parts.json /app/data/parts.json
EXPOSE 3000
CMD ["npm", "start"]

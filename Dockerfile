FROM node:20-alpine
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy server source and build
COPY server/ ./server/
RUN cd server && npm run build

EXPOSE 3001
CMD ["node", "server/dist/index.js"]

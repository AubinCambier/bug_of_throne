FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 8000 3001

CMD ["bash", "-lc", "npm run server & SERVER_PID=$!; npm run start -- --host 0.0.0.0 --port 8000 & CLIENT_PID=$!; trap 'kill $SERVER_PID $CLIENT_PID' SIGINT SIGTERM; wait -n $SERVER_PID $CLIENT_PID; EXIT_CODE=$?; kill $SERVER_PID $CLIENT_PID 2>/dev/null || true; wait || true; exit $EXIT_CODE"]

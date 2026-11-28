FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY vendor ./vendor
RUN npm ci --no-audit --no-fund
COPY . .
RUN chown -R node:node /app
USER node
EXPOSE 4173
CMD ["sh","-c","npm run db:local && npm run dev -- --host 0.0.0.0 --port 4173 --strictPort"]

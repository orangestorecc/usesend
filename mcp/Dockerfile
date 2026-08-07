# Imagem de produção do servidor MCP do useSend.
# Build context = ./mcp
FROM node:22-slim

WORKDIR /app

# Instala dependências (inclui tsx, usado pra rodar o servidor)
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

# Código
COPY . .

ENV NODE_ENV=production
EXPOSE 8787

# start = tsx src/server.ts
CMD ["npm", "start"]

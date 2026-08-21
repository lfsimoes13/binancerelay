FROM node:20-slim

WORKDIR /app

# Instala apenas as dependências de produção
COPY package*.json ./
RUN npm install --omit=dev

# Copia o código do relay
COPY . .

# Expõe a porta que o relay escuta
EXPOSE 8080

CMD [ "npm", "start" ]

# Build stage: produce static assets (no native deps needed for Vite build)
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps without running native scripts (avoids better-sqlite3 compile in Cloud Build)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts || npm install --ignore-scripts

COPY . .
RUN npm run build

# Run stage: serve with nginx (Cloud Run uses port 8080)
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

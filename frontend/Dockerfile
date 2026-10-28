# Build stage for React / Vite
FROM node:20-alpine as builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./
RUN npm ci

# Copy sources and build
COPY . .
RUN npm run build

# Production static serving with Nginx
FROM nginx:alpine

# Copy custom nginx configuration for SPA routing and API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


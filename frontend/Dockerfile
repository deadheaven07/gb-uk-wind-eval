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
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


# infra/docker/frontend.Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/tsconfig.json frontend/vite.config.ts /app/
COPY frontend/src /app/src
COPY frontend/index.html /app/index.html
RUN npm i && npm run build

FROM nginx:alpine
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

FROM node:20-alpine AS builder

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . /workspace
RUN npm run build -- --outDir dist --base=/

FROM nginx:alpine AS production

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /workspace/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

FROM node:20-alpine AS deps
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps && \
    npm install ajv@^8.12.0 --legacy-peer-deps --no-save

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./
ARG REACT_APP_API_BASE_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]



# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_* vars are inlined into the client bundle at build time, so they must
# be supplied as build args (docker build --build-arg / compose build.args),
# not as runtime environment variables.
ARG VITE_LLM_API_KEY=""
ARG VITE_LLM_MODEL=""
ARG VITE_LLM_BASE_URL=""
ENV VITE_LLM_API_KEY=$VITE_LLM_API_KEY \
    VITE_LLM_MODEL=$VITE_LLM_MODEL \
    VITE_LLM_BASE_URL=$VITE_LLM_BASE_URL

RUN npm run build

# ---- Serve stage ----
FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

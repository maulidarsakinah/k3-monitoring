FROM node:20-alpine

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN pnpm install --filter k3-monitoring-dashboard --frozen-lockfile=false

COPY frontend frontend

WORKDIR /workspace/frontend

EXPOSE 5173

CMD ["pnpm", "dev", "--", "--host", "0.0.0.0"]

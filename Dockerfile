# syntax=docker/dockerfile:1.7

############################################
# Builder: install deps and build Next app #
############################################
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Ensure reproducible, clean installs
ENV CI=true

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
# Skip strict env validation during build; real envs provided at runtime
ARG SKIP_ENV_VALIDATION=1
ENV SKIP_ENV_VALIDATION=${SKIP_ENV_VALIDATION}
RUN npm run build


############################################
# Runner: minimal runtime, run start-socket #
############################################
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Set production env
ENV NODE_ENV=production

# Install tsx globally to run TypeScript entry in production
RUN npm i -g tsx@4

# Install runtime deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built Next output and runtime files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next-env.d.ts ./next-env.d.ts

# Expose the app port
EXPOSE 3000

# Start the custom Next + Socket.IO server
CMD ["npm", "run", "start-socket"]






FROM node:22-alpine AS builder
WORKDIR /app
RUN npm i -g pnpm@9
COPY package.json pnpm-lock.yaml* ./
COPY packages/cascade/package.json packages/cascade/
RUN cd packages/cascade && pnpm install --frozen-lockfile --prod 2>/dev/null || pnpm install --prod
COPY packages/cascade/src ./packages/cascade/src
RUN pnpm --filter @spain-address/cascade build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/cascade/dist ./dist
COPY --from=builder /app/packages/cascade/package.json ./package.json
EXPOSE 5978
CMD ["node", "dist/cli.js"]

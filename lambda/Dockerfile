# ------------------------------------------------------------------
# Selenium MCP Server — AWS Lambda Container Image
#
# Uses selenium-webdriver + @sparticuz/chromium (headless Chrome)
# exposed as a remote MCP endpoint via Streamable HTTP transport.
#
# Build context: repository root
#   docker build -f lambda/Dockerfile -t selenium-ai-agent-lambda .
# ------------------------------------------------------------------

# ---- Stage 1: compile TypeScript ----
FROM node:22-slim AS builder
WORKDIR /build

COPY selenium-mcp-server/package*.json ./
RUN npm ci

COPY selenium-mcp-server/src/  ./src/
COPY selenium-mcp-server/bin/  ./bin/
COPY selenium-mcp-server/tsconfig.json ./

RUN npx tsc

# ---- Stage 2: Lambda runtime ----
FROM public.ecr.aws/lambda/nodejs:22

# Chrome / Chromium system dependencies (Amazon Linux 2023 / dnf)
RUN dnf -y install --setopt=install_weak_deps=0 \
  ca-certificates atk at-spi2-atk at-spi2-core cups-libs gtk3 \
  libX11 libXcomposite libXcursor libXdamage libXext libXfixes \
  libXrandr libXtst pango alsa-lib libdrm libgbm nss \
  dejavu-sans-fonts liberation-fonts dbus-libs expat glib2 \
  libgcc libstdc++ nspr mesa-libGL \
  && dnf clean all

WORKDIR /var/task

# Install ALL runtime dependencies (server deps + @sparticuz/chromium)
COPY lambda/package.json ./
RUN npm install --production --loglevel=error && npm cache clean --force

# Copy compiled MCP server (dist/src/*, dist/bin/*)
COPY --from=builder /build/dist/ ./dist/

# Copy Lambda handler
COPY lambda/handler.js ./

# Pre-create Chrome temp directories
RUN mkdir -p /tmp/chrome-user /tmp/chrome-cache

CMD ["handler.handler"]

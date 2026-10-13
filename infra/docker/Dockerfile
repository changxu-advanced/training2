FROM node:26.10.0-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash ca-certificates curl git postgresql-client sudo unzip python3 python3-yaml \
    && rm -rf /var/lib/apt/lists/* \
    && echo 'node ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/node \
    && npm install -g pnpm@12.9.1 @openai/codex@0.162.1

WORKDIR /workspaces/training2
USER node
CMD ["sleep", "infinity"]

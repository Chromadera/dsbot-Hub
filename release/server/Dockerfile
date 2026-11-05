# DSBots Hub server image: DS Bot fork with host reactions + back gestures.
FROM ghcr.io/fei2411/ds-bot:dev
COPY ds-bot-0.2.6-hub.2.tgz /tmp/ds-bot.tgz
RUN set -eux; \
    template=/opt/dsh-template/profiles/web; \
    rm -rf "$template/node_modules/ds-bot"; \
    tar -xzf /tmp/ds-bot.tgz -C "$template/node_modules"; \
    mv "$template/node_modules/package" "$template/node_modules/ds-bot"; \
    test -f "$template/node_modules/ds-bot/src/host/reactions.js"; \
    node -e "const p=require('$template/node_modules/ds-bot/package.json'); if(p.version!=='0.2.6-hub.2') throw new Error(p.version)"; \
    chown -R root:root "$template/node_modules/ds-bot"

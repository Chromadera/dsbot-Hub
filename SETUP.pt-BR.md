# DSBots Hub — runbook de instalação para agentes

<p>
  <a href="SETUP.md">English</a> ·
  <strong>Português (Brasil)</strong> ·
  <a href="SETUP.zh-CN.md">简体中文</a>
</p>

> **Este arquivo é um contrato de execução, não uma introdução.** Ele foi escrito
> para que um operador possa entregá-lo a um agente de IA com acesso ao shell, e o
> agente instale o DSBots Hub com segurança, uma fase verificada por vez. Leia o
> arquivo inteiro antes de executar qualquer coisa.

## Contrato

1. Leia este arquivo inteiro primeiro. Execute as fases em ordem.
2. Peça ao operador cada entrada necessária. Nunca invente token, chave, hostname,
   endpoint, nome de contêiner, nome de perfil ou caminho.
3. Nunca imprima, ecoe, registre ou cole um segredo. Guarde-o em uma variável de
   shell, use-a e relate apenas se ela está definida. Se um comando imprimir um
   segredo por acidente, não o repita.
4. Nunca grave um segredo em arquivo versionado. A chave do provedor vai para
   `server/.env` com modo `600`; tokens ficam em variáveis de shell ou na UI do hub.
5. Não instale Docker, DSH, Node ou pacotes de sistema sem permissão.
6. Não reinicie um serviço sem o comando exato do operador (`DSH_RESTART_CMD`) ou
   sem que ele tenha pedido isso explicitamente.
7. Não apague volume, contêiner, perfil ou backup. O rollback restaura; ele não
   faz limpeza.
8. Pare na primeira verificação que falhar. Relate a fase, o comando exato, o
   código de saída e a saída com os segredos ocultos.
9. A única imagem base de servidor é `ghcr.io/fei2411/ds-bot:dev`. Não baixe
   outras imagens ou pacotes por conta própria.
10. Não faça push de imagem, tag de release, mudança de DNS ou abertura de porta
    para a internet sem permissão explícita.
11. Sucesso na instalação não torna segura uma credencial exposta antes. Peça ao
    operador para rotacionar tudo o que possa ter vazado antes desta execução.

## O que já deve existir (não vem no pacote)

Nada disto vem no arquivo de release. O `preflight.sh` verifica; instalar qualquer
item exige permissão do operador.

| Pré-requisito | Para quê | Observação |
|---|---|---|
| DSH 0.2.2-alpha.3+ com um perfil web existente | o hub em si | A release instala um plugin no DSH; não instala o DSH |
| Node 24.9.0+ | preflight, empacotamento, host do DSH | `node --version` |
| Docker Engine + plugin Compose | a imagem de servidor incluída | Não é necessário se você só usa um servidor DS Bot existente |
| Acesso de rede a `ghcr.io` | baixar `ghcr.io/fei2411/ds-bot:dev` | Pré-baixe a imagem em hosts offline |
| Acesso de rede ao registry npm | os plugins de desktop fixados no `install.sh` | Use `WITH_DESKTOP=0` para pular |
| Conta e chave de um provedor de modelo, ou um servidor DS Bot existente | acesso aos modelos | Qualquer provedor que o DSH atenda; OpenCode Go é só o padrão |
| Um navegador | Fase 4 e verificação da UI | Não há caminho headless suportado |
| Opcionalmente Tailscale/LAN + TLS | acesso pelo celular | Não é necessário no mesmo host |

## Entradas

Colete estes dados antes da Fase 2. Use exatamente estes nomes de variável em
todos os comandos.

| Variável | Obrigatória | Padrão | Como obter |
|---|---|---|---|
| `RELEASE_DIR` | sim | diretório do `preflight.sh` | O operador informa onde o arquivo foi descompactado |
| `DSH_PROFILE` | não | `web` | Nome do perfil DSH do operador |
| `DSH_BIN` | não | `dsh` | Caminho do CLI DSH, se não estiver no `PATH` |
| `DSH_RESTART_CMD` | não | vazio | Comando de restart fornecido pelo operador; pergunte, não adivinhe |
| `DS_BOT_CONTAINER` | não | `ds-bot` | `docker ps --format '{{.Names}}'` |
| `DS_BOT_PROFILE` | não | `web` | Perfil dentro do contêiner, normalmente `web` |
| `DS_BOT_ENDPOINT` | sim | `http://127.0.0.1:13081` | Endereço que o hub acessa; deve casar com a porta publicada |
| `SERVER_LABEL` | sim | nenhum | Nome curto, por exemplo `Main` |
| `PROVIDER_KEY_ENV` | servidor novo | `OPENCODE_GO_API_KEY` | Nome da variável que a rota do modelo espera (`apiKeyEnv`) |
| `PROVIDER_API_KEY` | servidor novo | nenhum | O valor da chave; não pode aparecer na transcrição |
| `HUB_PROXY_BIND` | só celular | `127.0.0.1` | Endereço da tailnet ou LAN que o celular alcança |
| `PUBLIC_HOST` | só celular | nenhum | Host que o celular usa na URL do DSH |

Se `DSH_RESTART_CMD` estiver vazio, instale e relate o restart como **etapa
manual**. Não pare nem mate o processo do DSH por conta própria.

## Fase 0 — preflight

```bash
cd "$RELEASE_DIR"
./preflight.sh
```

Esperado: uma lista de linhas `PASS` e `== summary: N passed, 0 warnings, 0 failed ==`.

- Qualquer `FAIL`: pare e relate. Não contorne dependência ausente.
- Um `WARN` sobre `server/.env` é esperado antes da Fase 2A.
- Se `preflight.sh` não existir, o arquivo está incompleto: pare.

Anote o diretório de release impresso; as fases seguintes assumem que você
continua nele.

## Fase 1 — verificar a release

```bash
cd "$RELEASE_DIR"
sha256sum -c SHA256SUMS
```

Esperado: todas as linhas terminam em `OK`.

Depois leia a versão do fork sem instalá-lo:

```bash
tar -xOf ds-bot-0.2.6-hub.3.tgz package/package.json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))'
```

Esperado: `0.2.6-hub.3`. Qualquer outro valor: pare.

## Fase 2 — servidor DS Bot

Escolha **um** caminho. Pergunte ao operador qual se aplica.

### 2A. Servidor novo

Qualquer provedor que o DSH atenda funciona aqui. A rota de modelo do contêiner
nomeia a variável de ambiente que ela lê (`apiKeyEnv`); o compose incluído usa uma
rota OpenCode Go por padrão. Combine `PROVIDER_KEY_ENV` com o operador antes de
escrever.

```bash
cp server/.env.example server/.env
chmod 600 server/.env
# Uma linha por rota. Escreva sem imprimir o valor:
#   printf '%s=%s\n' "$PROVIDER_KEY_ENV" "$PROVIDER_API_KEY" > server/.env
grep -Eq '^[A-Z][A-Z0-9_]*_API_KEY=.+' server/.env && echo "provider key present"
```

Nunca rode grep da chave sem `-q`; isso imprime o valor. Nunca rode
`docker compose config` de forma que o ambiente resolvido vá para a transcrição.
Se o operador usar outro provedor, a rota dele precisa existir ou ser adicionada
antes; veja [docs/providers.md](docs/providers.md).

Inicie o servidor:

```bash
docker compose -f server/compose.yml up -d --build
```

Se você definir `DS_BOT_PORT` em `server/.env`, ajuste `DS_BOT_ENDPOINT` para
`http://127.0.0.1:<porta>` e use esse valor abaixo.

Aguarde o contêiner e verifique as versões. A repetição cobre a primeira
inicialização:

```bash
for _ in $(seq 1 30); do
  DATA_VERSION="$(docker exec "$DS_BOT_CONTAINER" node -p \
    "require('/data/profiles/$DS_BOT_PROFILE/node_modules/ds-bot/package.json').version" 2>/dev/null)"
  TEMPLATE_VERSION="$(docker exec "$DS_BOT_CONTAINER" node -p \
    "require('/opt/dsh-template/profiles/$DS_BOT_PROFILE/node_modules/ds-bot/package.json').version" 2>/dev/null)"
  if [ "$DATA_VERSION" = "0.2.6-hub.3" ] && [ "$TEMPLATE_VERSION" = "0.2.6-hub.3" ]; then break; fi
  sleep 2
done
printf 'data=%s template=%s\n' "$DATA_VERSION" "$TEMPLATE_VERSION"
```

Esperado: `data=0.2.6-hub.3 template=0.2.6-hub.3`. Qualquer outro valor após a
repetição: pare e leia os logs do contêiner.

### 2B. Servidor existente

Instale o fork no perfil de dados em uso. O script cria o próprio backup com data
e reinicia o contêiner:

```bash
./server/install-existing.sh "$DS_BOT_CONTAINER" ds-bot-0.2.6-hub.3.tgz "$DS_BOT_PROFILE"
```

Anote o caminho de backup que ele imprime (`backup: /data/.../ds-bot.bak-<stamp>`)
para o relatório e para o rollback. Verifique a versão do perfil de dados como na
fase 2A. O template da imagem não muda, a menos que você o reconstrua.

Se o operador quiser atualizar também o template da imagem, reconstrua e recrie a
partir de `server/` — nunca remova o volume de dados.

### 2C. Capturar o token de login

A linha `dsh web` do contêiner imprime o token. Ele muda a cada reinício, então
capture-o depois que o servidor estiver rodando — e de novo após qualquer
reinício.

```bash
TOKEN=""
for _ in $(seq 1 60); do
  TOKEN="$(docker logs "$DS_BOT_CONTAINER" 2>&1 | grep -o 'token=[^ ]*' | tail -1 | cut -d= -f2-)"
  if [ -n "$TOKEN" ]; then break; fi
  sleep 2
done
test -n "$TOKEN" && echo "token captured"
```

`echo "token captured"` imprime um status, nunca o valor.

### 2D. Servidores locais adicionais

Repita a Fase 2 para cada servidor que o operador quiser. Cada um é um contêiner
independente, com nome, porta de host, diretório de dados e token próprios.
Reutilize a imagem criada pelo compose:

```bash
docker run -d --name dsbot-b \
  --restart unless-stopped \
  -p "127.0.0.1:${DS_BOT_PORT:-14001}:3080" \
  --env-file server/.env \
  -v /opt/dsbot-b/data:/data \
  -v /opt/dsbot-b/workspace:/workspace \
  dsbots/ds-bot:0.2.6-hub.3
```

Regras:

- Crie os diretórios no host antes, com o dono do `PUID`/`PGID` do contêiner
  (padrão `1000:1000`).
- Mantenha as portas de host fora de `13090`–`13199`; o hub aloca ali as origens
  do navegador.
- Use um `--env-file` separado quando a segunda equipe usar outro provedor ou
  chave.
- Nunca monte o mesmo volume de dados em dois contêineres.
- Capture o token de cada contêiner com a Fase 2C, usando seu próprio
  `DS_BOT_CONTAINER`.

## Fase 3 — instalar o hub

```bash
cd "$RELEASE_DIR"
./install.sh "$DSH_PROFILE"
```

Apenas hub e gate mobile:

```bash
WITH_DESKTOP=0 ./install.sh "$DSH_PROFILE"
```

Verifique a dependência do perfil:

```bash
"${DSH_BIN:-dsh}" plugin --profile "$DSH_PROFILE" list --depth 0 | grep dsbot-hub
```

Esperado: uma linha `dsbot-hub` na versão `0.11.14`. Se a sintaxe do CLI for
diferente nesta instalação, pare e peça o caminho do perfil em vez de editar o
perfil à mão.

Depois rode `DSH_RESTART_CMD` se o operador forneceu um, e peça para forçar a
atualização do navegador. Caso contrário, relate o restart como manual.

## Fase 4 — adicionar o primeiro servidor

Normalmente é uma etapa de navegador: o hub usa um cookie de grant host-only.

1. Abra a URL do DSH.
2. Escolha **Bots** (shell mobile) ou o painel **DS Bot Hub** na barra lateral.
3. Abra o chip do servidor → engrenagem → **Add server**.
4. Informe `SERVER_LABEL`, `DS_BOT_ENDPOINT` e o token capturado na Fase 2C.
5. Salve.
6. Confirme que o servidor selecionado passa a ser `SERVER_LABEL` e que os bots
   carregam.

Repita os passos 1–6 para cada contêiner, com id, rótulo e endpoint próprios.
Cada servidor tem seu token; um inacessível mantém os outros alternáveis.

Para entregar o token ao operador sem imprimi-lo, o caminho mais limpo é deixá-lo
ler no próprio terminal:

```bash
docker logs "$DS_BOT_CONTAINER" 2>&1 | grep -o 'token=[^ ]*' | tail -1 | cut -d= -f2-
```

Se você já o tem em `$TOKEN`, cole diretamente no formulário que está operando.
Se não houver navegador nem área de transferência, pare em **manual pendente**.
Nunca cole o token no chat para "ajudar".

## Fase 5 — verificar

Execute estas verificações para cada contêiner:

```bash
docker ps --format '{{.Names}} {{.Image}} {{.Status}}' | grep "$DS_BOT_CONTAINER"

docker exec "$DS_BOT_CONTAINER" node -p \
  "require('/data/profiles/$DS_BOT_PROFILE/node_modules/ds-bot/package.json').version"

docker exec "$DS_BOT_CONTAINER" sh -lc \
  "test -f /data/profiles/$DS_BOT_PROFILE/node_modules/ds-bot/src/host/reactions.js && echo reactions_present"
```

Esperado: a imagem esperada, `0.2.6-hub.3`, `reactions_present`.

Na UI do hub, confirme:

- o iframe do servidor carrega e mostra os bots;
- toque longo abre a folha de ações;
- Select Text abre o leitor e o voltar fecha;
- um chip de reação aparece depois de reagir;
- perguntar ao bot qual reação você deixou retorna a resposta.

Se não puder verificar a UI, marque como **pendente**; não relate instalação
completa.

## Fase 6 — celular e acesso remoto

Somente se o operador quiser acesso pelo celular. Peça `PUBLIC_HOST` e
`HUB_PROXY_BIND`, depois mostre o arquivo e o diff exatos antes de editar:

```yaml
- id: dsbot-hub
  config:
    proxy:
      bind: <tailnet-or-lan-address>
```

Regras:

- `127.0.0.1` só funciona para navegador no mesmo host.
- `0.0.0.0` expõe as portas de origem em todas as interfaces; exija firewall/ACL.
- A URL do celular é a do DSH web, não uma porta de origem.
- Se a página do DSH for HTTPS, as origens também precisam ser HTTPS.

Reinicie o DSH com `DSH_RESTART_CMD` e peça ao operador para abrir a URL do DSH no
celular e escolher **Bots**.

## Fase 7 — relatório

Retorne exatamente este formato, sem valores de segredo:

```text
Status: success | pending-manual | failed
Phase: <last completed phase>
Release: 0.11.14
DS Bot: 0.2.6-hub.3
Hub: 0.11.14
Server container: <name / image / status>
Data profile: <version>
Image template: <version>
Hub URL: <url>
Servers: <count and labels>
Phone bind: <address or not configured>
Manual steps remaining: <restart / hard refresh / add server / phone bind>
Secrets printed: no
Rollback backup: <path or none>
Failures: <none, or phase / command / exit code / redacted output>
```

Não inclua token, chave, cookie, ambiente do contêiner nem conteúdo de `.env`.

## Fase 8 — rollback

Use somente após uma verificação que falhou e com aprovação do operador.

Perfil de dados — use o caminho de backup capturado na Fase 2B:

```bash
docker exec -u 0 -e PROFILE="$DS_BOT_PROFILE" -e BACKUP="<captured backup path>" \
  "$DS_BOT_CONTAINER" sh -ec '
    profile="/data/profiles/$PROFILE"
    test -d "$BACKUP"
    rm -rf "$profile/node_modules/ds-bot"
    mv "$BACKUP" "$profile/node_modules/ds-bot"
    chown -R node:node "$profile/node_modules/ds-bot"
  '
docker restart "$DS_BOT_CONTAINER"
```

Hub — reinstale o tarball anterior no mesmo perfil e reinicie o DSH:

```bash
"${DSH_BIN:-dsh}" plugin --profile "$DSH_PROFILE" add ./dsbot-hub-<previous>.tgz
```

Nunca apague o volume de dados e nunca rode `docker compose down -v`.

## Condições de parada

Pare e pergunte ao operador quando:

- faltar uma entrada obrigatória ou ela for ambígua;
- o preflight ou um checksum falhar;
- uma versão não for `0.11.14` / `0.2.6-hub.3`;
- o contêiner não estiver rodando ou os logs mostrarem erro de inicialização;
- um comando for imprimir ou persistir um segredo;
- um restart, push de imagem, mudança de DNS ou exclusão não estiver autorizado;
- uma etapa de navegador for necessária e não houver navegador.

## Apêndice — manuseio de segredos

| Valor | Manuseio seguro |
|---|---|
| Chave(s) de provedor | Em `server/.env` (modo 600) com o nome do `apiKeyEnv` da rota; nunca como argumento de CLI |
| Token de login do contêiner | Variável de shell; cole na UI do hub; nunca ecoe nem versione |
| Cookie da equipe | Fica nas credenciais do DSH; nunca exporte nem copie entre máquinas |
| `.env`, `secrets.json`, cookies | Nunca abra em um comando cuja saída você imprime |

Se um segredo foi impresso mesmo assim:

1. Diga que foi exposto, sem repeti-lo.
2. Peça ao operador para rotacionar (chave do provedor: reemitir; token: reiniciar
   para gerar outro; cookie: colar um token novo).
3. Não continue a instalação até o operador confirmar a rotação.

<p>
  <a href="README.pt-BR.md">README</a> ·
  <a href="SETUP.md">English</a> ·
  <a href="SETUP.zh-CN.md">简体中文</a>
</p>

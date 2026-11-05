<p align="center"><img src="icon.svg" width="72" height="72" alt="DSBots Hub"></p>

<h1 align="center">DSBots Hub</h1>

<p align="center">Um ou mais servidores DS Bot atrás de um único seletor no DeepSeek Harness.</p>

<p align="center">
  <a href="README.md">English</a> ·
  <strong>Português (Brasil)</strong> ·
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  Versão <strong>0.11.13</strong> · DS Bot <strong>0.2.6-hub.2</strong> · DSH <strong>0.2.2-alpha.3+</strong>
</p>

---

O DSBots Hub adiciona um seletor de servidores ao DeepSeek Harness (DSH) e
embute a interface real do DS Bot do servidor selecionado. Cada servidor mantém
sua própria origem, seu próprio cookie de sessão e seus próprios bots. O
navegador nunca recebe a credencial original da equipe.

Ele foi feito para **um operador com uma ou mais equipes DS Bot auto-hospedadas**:
um perfil DSH, um hub e qualquer número de servidores.

> **Não é um serviço multi-inquilino.** Não há contas de usuário, papéis nem
> auditoria. Use em uma Tailscale ou LAN atrás de um proxy TLS, nunca na internet
> aberta. Veja [Segurança](#segurança).

## Recursos

- **Um seletor, vários servidores.** Os bots abaixo do chip pertencem ao servidor
  selecionado. A troca preserva a conversa de cada servidor.
- **Isolamento por origem.** A interface embutida nunca é servida pela origem do
  DSH. Cada servidor ganha sua própria origem de proxy e um cookie de sessão
  host-only.
- **Reações no servidor.** O usuário pode deixar até duas reações por mensagem; o
  bot deixa uma. Os bots recebem a ferramenta `react` e um aviso antes do próximo
  turno quando você reage a eles. *(Requer o fork do DS Bot incluído.)*
- **Gestos de voltar.** O botão Voltar do Android e o deslize da borda fecham a
  camada do topo — folha de ações, citação, leitor de mensagem, configurações,
  seletor de servidor — antes que o hub navegue para fora.
- **Fluxo para celular e tablet.** Folha de toque longo, teclado de emoji nativo,
  leitor de mensagem selecionável e barra de hover restrita ao desktop.
- **Nada é copiado.** Bots, conversas, memória e credenciais ficam nos servidores.

## Como funciona

```text
Navegador
  |
  +-- DSH + painel DSBots Hub ......... origem do DSH
  |     |  API do painel (mesma origem): /dsbot-hub/api
  |     |  GET /dsbot-hub/api/servers/<id>/open -> grant de curta duração
  |     v
  +-- iframe --> origem de cada servidor --> proxy do hub --> servidor DS Bot
  |              (cookie host-only)          (injeta o cookie da equipe)
  |
  +-- ferramentas --> /api/bot em cada endpoint
```

O hub pede um grant, o grant define um cookie host-only na origem daquele
servidor e o proxy injeta o cookie real da equipe no upstream. Sem reescrever
HTML, sem cookies compartilhados e sem ações entre servidores. As portas de
origem são alocadas automaticamente entre `13090` e `13199`.

## Requisitos

| Componente | Versão | Observação |
|---|---|---|
| DSH | 0.2.2-alpha.3+ | perfil web; a shell mobile exige 0.2.2+ |
| Node | 24.9.0+ | CLI do host e build |
| DS Bot | 0.2.6 | o DS Bot padrão atende o hub; o fork incluído adiciona reações e gestos de voltar |
| Docker + Compose | atual | apenas para a imagem de servidor incluída |
| Provedor de modelo | qualquer um suportado pelo DSH | OpenCode Go é o padrão do pacote; veja [Provedores de modelo](#provedores-de-modelo) |
| Rede | Tailscale, LAN ou proxy TLS | o hub usa HTTP simples atrás dela |

Nada acima vem dentro do arquivo de release. A release instala um plugin do DSH e
um build de imagem de servidor; DSH, Node, Docker e a conta do provedor são
responsabilidade sua. O [SETUP.pt-BR.md](SETUP.pt-BR.md) lista cada um por fase.

## Início rápido

O arquivo de release contém o hub, o gate mobile, o fork do DS Bot e o build da
imagem de servidor.

### 1. Descompacte e verifique

```bash
mkdir -p dsbot-hub-0.11.13
tar -xzf dsbot-hub-release-0.11.13.tar.gz -C dsbot-hub-0.11.13
cd dsbot-hub-0.11.13

sha256sum -c SHA256SUMS     # cada linha deve terminar em OK
./preflight.sh              # verificações do host e dos artefatos
```

### 2. Configure e inicie o servidor DS Bot

Coloque a chave do provedor em um arquivo de ambiente privado, não na linha de
comando:

```bash
cp server/.env.example server/.env
chmod 600 server/.env
$EDITOR server/.env         # defina uma chave de provedor; OpenCode Go é o padrão

docker compose -f server/compose.yml up -d --build
```

O compose publica `127.0.0.1:13081` e guarda os dados em `/opt/ds-bot`. Ambos
são padrões, não caminhos fixos: `DS_BOT_PORT`, `DS_BOT_CONTAINER`,
`DS_BOT_DATA_DIR` e `DS_BOT_WORKSPACE_DIR` em `server/.env` os substituem. Se os
diretórios de dados não existirem, crie-os com o dono definido por `PUID`/`PGID`
(padrão `1000:1000`) antes de iniciar.

O contêiner lê todos os valores de `server/.env`. O compose incluído está
configurado para uma rota OpenCode Go, mas isso é uma opção, não uma exigência —
veja [Provedores de modelo](#provedores-de-modelo).

### 3. Instale o hub no DSH

```bash
./install.sh web            # ou: ./install.sh "$DSH_PROFILE"
```

Isso instala o `dsbot-hub`, o gate mobile e o conjunto fixado de plugins de
desktop. Use `WITH_DESKTOP=0 ./install.sh web` para instalar apenas o hub e o
gate.

### 4. Reinicie o DSH e abra o hub

Reinicie o processo que serve o DSH web e force a atualização do navegador. O
painel aparece na barra lateral e como **Bots** na shell mobile.

### 5. Adicione o servidor

Abra **DS Bot Hub → engrenagem → Add server** e preencha:

| Campo | Valor |
|---|---|
| Name | Qualquer nome, por exemplo `Main` |
| Endpoint | `http://127.0.0.1:13081` |
| Login token | o token impresso pelo contêiner (abaixo) |

O DSH dentro do contêiner imprime sua URL de login na inicialização. Leia o token
sem imprimi-lo em um log compartilhado:

```bash
docker logs ds-bot 2>&1 | grep -o 'token=[^ ]*' | tail -1 | cut -d= -f2-
```

Cole o valor no campo de token. O hub o guarda como um segredo do DSH e o troca
pelo cookie da equipe; o navegador nunca vê o cookie.

> O token muda quando o contêiner reinicia. Se o servidor mostrar **sign in**
> depois, cole um token novo.

Pronto. O chip deve mostrar o nome do servidor e os bots devem carregar.

## Provedores de modelo

O DS Bot não depende do OpenCode Go. Os modelos vêm do adaptador `llm-pi-ai` do
DSH: cada rota nomeia a variável de ambiente que guarda sua chave (`apiKeyEnv`).
O compose incluído passa todo o `server/.env` para o contêiner, então adicionar
um provedor não exige editar o compose.

O compose incluído usa uma rota OpenCode Go (`OPENCODE_GO_API_KEY`). Para outro
provedor:

1. Adicione a rota em `providers`, na linha `llm-pi-ai` do perfil do contêiner.
2. Coloque a chave em `server/.env` com o nome que o `apiKeyEnv` da rota usa.
3. Reinicie o contêiner e escolha o modelo do bot no DS Bot.

```yaml
providers:
  opencode-go:
    apiKeyEnv: OPENCODE_GO_API_KEY
  openai:
    apiKeyEnv: OPENAI_API_KEY
```

Um bloco `config:` em um patch substitui toda a configuração da entrada, então
repita todas as rotas que quiser manter. Gateways personalizados também precisam
de `api`, `baseURL` e `models`.

Lista completa de campos, exemplos de gateway e opções de armazenamento de chave
em [docs/providers.md](docs/providers.md).

## Usando um servidor DS Bot existente

O hub conversa com as rotas que a própria interface do DS Bot usa, então um
servidor DS Bot 0.2.6 existente funciona sem mudanças: adicione-o com o endpoint
e o token de login.

O fork incluído adiciona reações no servidor, a ferramenta `react` dos bots e a
pilha de voltar compartilhada. Duas formas de migrar:

```bash
# contêiner existente: faz backup e atualiza o perfil de dados em uso
./server/install-existing.sh ds-bot ds-bot-0.2.6-hub.2.tgz

# ou reconstrua a imagem para que novos contêineres já usem o fork
docker compose -f server/compose.yml up -d --build
```

O `install-existing.sh` mantém um backup com data do pacote antigo em
`/data/profiles/web/node_modules/ds-bot.bak-<timestamp>` e reinicia o contêiner.
Ele não apaga o volume de dados.

## Vários servidores locais

Um contêiner é uma equipe. Para rodar uma segunda equipe no mesmo host, dê a ela
nome, porta de host, diretório de dados e token próprios:

```bash
docker run -d --name dsbot-b \
  --restart unless-stopped \
  -p 127.0.0.1:14001:3080 \
  --env-file server/.env \
  -v /opt/dsbot-b/data:/data \
  -v /opt/dsbot-b/workspace:/workspace \
  dsbots/ds-bot:0.2.6-hub.2
```

Mantenha as portas de host fora de `13090`–`13199`: o hub aloca ali as origens do
navegador. Nunca monte o mesmo volume de dados em dois contêineres. Depois
adicione `http://127.0.0.1:14001` no hub com id, rótulo e token próprios. Repita
para cada servidor; cada contêiner tem seu token, e um fora do ar não esconde os
outros.

Mais em [docs/multiple-servers.md](docs/multiple-servers.md).

## Celular e acesso remoto

O celular carrega o app web do DSH, e as origens embutidas do hub precisam estar
acessíveis a partir dele. Aponte os dois para a mesma interface:

```yaml
- id: dsbot-hub
  config:
    proxy:
      listen: 127.0.0.1:13091
      bind: 100.x.y.z        # endereço da tailnet, ou 0.0.0.0 atrás de uma ACL
```

Depois abra a URL do DSH no celular, por exemplo `http://<ip-da-tailnet>:3080/`,
e escolha **Bots**. A Tailscale roteia todas as portas do host, então não é
preciso encaminhar porta por porta.

Se o DSH for servido por HTTPS, as portas de origem também precisam de HTTPS, ou
o navegador bloqueia o iframe por conteúdo misto. Um certificado para o host cobre
todas as portas; termine o TLS com Caddy ou `tailscale serve`.

O passo a passo completo — incluindo túneis SSH e subdomínios públicos — está em
[docs/install.md](docs/install.md).

## Configuração

O painel da engrenagem é o editor normal. YAML na linha `dsbot-hub` é o caminho
de bootstrap e automação:

```yaml
- id: dsbot-hub
  config:
    servers:
      - id: main
        label: Main
        endpoint: http://127.0.0.1:13081
    proxy:
      listen: 127.0.0.1:13091
      bind: 127.0.0.1
```

| Campo | Padrão | Significado |
|---|---|---|
| `servers[].endpoint` | — | Endereço que o hub acessa; o cookie é vinculado ao host e à porta |
| `servers[].origin` | automático | Origem do navegador para a interface embutida; uma porta de loopback é alocada |
| `servers[].cookieRef` | `DSBOT_<ID>_COOKIE` | Nome do segredo do DSH que guarda o cookie da equipe |
| `proxy.listen` | `127.0.0.1:13091` | Listener compartilhado para origens baseadas em hostname |
| `proxy.bind` | `127.0.0.1` | Interface em que as origens por servidor escutam |
| `proxy.grantTtlSeconds` | `60` | Validade do grant |
| `proxy.sessionHours` | `12` | Validade da sessão embutida |

Veja [docs/config.md](docs/config.md) para todos os campos e as regras de origem.

## Conteúdo da versão

| Artefato | Finalidade |
|---|---|
| `dsbot-hub-0.11.13.tgz` | plugin do hub para o DSH |
| `dsbot-mobile-desktop-gate-0.1.1.tgz` | gate mobile da interface desktop |
| `ds-bot-0.2.6-hub.2.tgz` | fork do DS Bot: reações e gestos de voltar |
| `dsbot-hub-release-0.11.13.tar.gz` | release descompactada: docs, perfil, instalador, build do servidor |
| `SHA256SUMS` | checksums dos artefatos |
| `preflight.sh` | verificação do host e da release |

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| O painel não aparece na barra lateral | O DSH não foi reiniciado ou o bundle não está no perfil |
| Quadro embutido em branco | Porta de origem não vinculada à interface usada, ou página HTTPS embutindo origem HTTP |
| **Sign in** / 401 no servidor | Token mudou, ou host/porta do endpoint mudou depois que o cookie foi criado |
| **Link expired** / 403 | Grants são de uso único e curtos; abra o servidor novamente |
| O `compose` sai com `env file ... not found` | Falta `server/.env`; copie `server/.env.example` |
| Um bot responde `MISSING_CREDENTIAL` | Falta a chave da rota; adicione em `server/.env` com o nome do `apiKeyEnv` |
| O quadro do segundo servidor fica em branco | A porta de host colide com `13090`–`13199` ou não está vinculada à interface usada |
| 403 vindo do upstream | A autoridade do endpoint e a do cookie não coincidem |

Mais em [docs/troubleshooting.md](docs/troubleshooting.md).

## Documentação

- [SETUP.pt-BR.md](SETUP.pt-BR.md) — runbook de instalação executável por agente
- [Instalação e rede](docs/install.md)
- [Configuração](docs/config.md)
- [Provedores de modelo](docs/providers.md)
- [Vários servidores](docs/multiple-servers.md)
- [Shell mobile e gestos](docs/mobile.md)
- [Gestos de voltar](docs/back-gesture.md)
- [Atualização](docs/upgrade.md)
- [Compatibilidade](docs/compatibility.md)
- [Operação](docs/operations.md)
- [Solução de problemas](docs/troubleshooting.md)

## Segurança

- O token de login do DS Bot dá controle total daquela equipe. A chave do
  provedor é crédito utilizável. Mantenha os dois fora do histórico do shell, do
  chat e do git.
- Mantenha o hub em uma rede privada. As ACLs da Tailscale são a fronteira
  externa; os cookies de grant/sessão são a interna.
- Não exponha a porta do DSH, as portas do proxy nem a porta do DS Bot à internet.
- Rode como usuário não-root. Mantenha `server/.env` com modo `600` e o diretório
  do DSH privado.
- Leia [SECURITY.md](SECURITY.md) antes de expor o hub a outra pessoa.

## Licença

Apache-2.0. O fork do DS Bot incluído também é Apache-2.0, com `LICENSE`,
`NOTICE` e `MODIFICATIONS.md` próprios dentro do tarball. Veja [NOTICE](NOTICE) e
[THIRD_PARTY.md](THIRD_PARTY.md).

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="SETUP.pt-BR.md">Instalação</a>
</p>

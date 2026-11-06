# DSBots Hub — 代理安装运行手册

<p>
  <a href="SETUP.md">English</a> ·
  <a href="SETUP.pt-BR.md">Português (Brasil)</a> ·
  <strong>简体中文</strong>
</p>

> **本文件是执行契约，不是介绍。** 运维人员可以把它交给拥有 shell 权限的 AI
> 代理，让代理按阶段安装 DSBots Hub，每个阶段都经过验证。执行任何命令前先读
> 完整份文件。

## 契约

1. 先读完整份文件，按顺序执行阶段。
2. 向运维人员索取所有必要输入。绝不编造 token、密钥、主机名、endpoint、
   容器名、配置名或路径。
3. 绝不打印、回显、记录或粘贴机密。把它保存在 shell 变量中，使用后只报告
   “已设置”。如果命令意外打印了机密，不要重复它。
4. 绝不把机密写入被跟踪的文件。提供商密钥写入 `server/.env`（权限 `600`）；
   token 只留在 shell 变量或 Hub 界面中。
5. 未经许可，不安装 Docker、DSH、Node 或系统软件包。
6. 没有运维人员给出的确切命令（`DSH_RESTART_CMD`）或明确要求时，不重启服务。
7. 不删除数据卷、容器、配置或备份。回滚是恢复，不是清理。
8. 第一个验证失败就停止。报告阶段、确切命令、退出码，以及隐藏机密后的输出。
9. 唯一的服务器基础镜像是 `ghcr.io/fei2411/ds-bot:dev`。不要自行拉取其他镜像
   或软件包。
10. 未经明确许可，不推送镜像、打发布标签、修改 DNS 或把端口开放到公网。
11. 安装成功并不代表此前泄露的凭据已经安全。提醒运维人员轮换本次操作前可能
    泄露的一切。

## 必须提前准备（不在发布包内）

以下内容都不在发布包中。`preflight.sh` 会检查它们；安装任何一项都需要运维人员
许可。

| 前提 | 用于 | 说明 |
|---|---|---|
| DSH 0.2.2-alpha.3+ 及现有 Web 配置 | Hub 本身 | 发布包只安装 DSH 插件，不安装 DSH |
| Node 24.9.0+ | preflight、打包、DSH 主机 | `node --version` |
| Docker Engine + Compose 插件 | 随附服务器镜像 | 若只使用已有 DS Bot 服务器则不需要 |
| 访问 `ghcr.io` 的网络 | 拉取 `ghcr.io/fei2411/ds-bot:dev` | 离线主机请预先拉取 |
| 访问 npm registry 的网络 | `install.sh` 中固定的桌面插件 | 用 `WITH_DESKTOP=0` 跳过 |
| 模型提供商账号和密钥，或已有 DS Bot 服务器 | 模型访问 | 任意 DSH 支持的提供商；OpenCode Go 只是默认 |
| 浏览器 | 第 4 阶段和界面验证 | 没有受支持的无头路径 |
| 可选 Tailscale/局域网 + TLS | 手机访问 | 同一主机使用不需要 |

## 输入

在第 2 阶段前收集这些值。所有命令都使用下列准确变量名。

| 变量 | 必需 | 默认 | 获取方式 |
|---|---|---|---|
| `RELEASE_DIR` | 是 | `preflight.sh` 所在目录 | 运维人员告知解压位置 |
| `DSH_PROFILE` | 否 | `web` | 运维人员的 DSH 配置名 |
| `DSH_BIN` | 否 | `dsh` | DSH CLI 路径（不在 `PATH` 时） |
| `DSH_RESTART_CMD` | 否 | 空 | 由运维人员提供；询问，不要猜测 |
| `DS_BOT_CONTAINER` | 否 | `ds-bot` | `docker ps --format '{{.Names}}'` |
| `DS_BOT_PROFILE` | 否 | `web` | 容器内的配置名，通常是 `web` |
| `DS_BOT_ENDPOINT` | 是 | `http://127.0.0.1:13081` | Hub 访问的地址；必须与发布端口一致 |
| `SERVER_LABEL` | 是 | 无 | 简短名称，例如 `Main` |
| `PROVIDER_KEY_ENV` | 仅新服务器 | `OPENCODE_GO_API_KEY` | 模型路由读取的环境变量名（`apiKeyEnv`） |
| `PROVIDER_API_KEY` | 仅新服务器 | 无 | 密钥值；不得出现在记录中 |
| `HUB_PROXY_BIND` | 仅手机 | `127.0.0.1` | 手机可访问的 tailnet 或局域网地址 |
| `PUBLIC_HOST` | 仅手机 | 无 | 手机访问 DSH URL 时使用的主机 |

如果 `DSH_RESTART_CMD` 为空，完成安装并把重启报告为**手动步骤**。不要自行
停止或终止 DSH 进程。

## 第 0 阶段 — preflight

```bash
cd "$RELEASE_DIR"
./preflight.sh
```

预期：若干 `PASS` 行，以及 `== summary: N passed, 0 warnings, 0 failed ==`。

- 出现任何 `FAIL`：停止并报告。不要绕过缺失的依赖。
- 第 2A 阶段前出现关于 `server/.env` 的 `WARN` 是正常的。
- 如果 `preflight.sh` 不存在，发布包不完整：停止。

记下输出的发布目录；后续阶段假定你仍在该目录。

## 第 1 阶段 — 校验发布包

```bash
cd "$RELEASE_DIR"
sha256sum -c SHA256SUMS
```

预期：每一行都以 `OK` 结尾。

然后在不安装的情况下读取分支版本：

```bash
tar -xOf ds-bot-0.2.6-hub.3.tgz package/package.json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))'
```

预期：`0.2.6-hub.3`。其他值：停止。

## 第 2 阶段 — DS Bot 服务器

只选择**一条**路径。询问运维人员适用哪条。

### 2A. 新服务器

任何 DSH 支持的提供商都可以。容器的模型路由指定它读取的环境变量名
（`apiKeyEnv`）；随附的 compose 默认使用 OpenCode Go 路由。写入前先与运维人员
确认 `PROVIDER_KEY_ENV`。

```bash
cp server/.env.example server/.env
chmod 600 server/.env
# 每条路由一行。写入时不要打印值：
#   printf '%s=%s\n' "$PROVIDER_KEY_ENV" "$PROVIDER_API_KEY" > server/.env
grep -Eq '^[A-Z][A-Z0-9_]*_API_KEY=.+' server/.env && echo "provider key present"
```

绝不要不带 `-q` 对密钥执行 grep；那会打印值。绝不要让 `docker compose config`
把解析后的环境变量写进记录。如果运维人员使用其他提供商，其路由必须已存在或先
添加；见 [docs/providers.md](docs/providers.md)。

启动服务器：

```bash
docker compose -f server/compose.yml up -d --build
```

如果设置了 `server/.env` 中的 `DS_BOT_PORT`，请把 `DS_BOT_ENDPOINT` 设为
`http://127.0.0.1:<端口>`，并在后续步骤中使用该值。

等待容器并校验版本。重试用于覆盖容器首次启动：

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

预期：`data=0.2.6-hub.3 template=0.2.6-hub.3`。重试后仍不符：停止并查看容器
日志。

### 2B. 已有服务器

把分支安装到正在使用的数据配置。脚本会创建自己的时间戳备份并重启容器：

```bash
./server/install-existing.sh "$DS_BOT_CONTAINER" ds-bot-0.2.6-hub.3.tgz "$DS_BOT_PROFILE"
```

记下它输出的备份路径（`backup: /data/.../ds-bot.bak-<stamp>`），用于报告和
回滚。按 2A 的方式校验数据配置版本。除非你重建镜像，镜像模板不会改变。

如果运维人员还想升级镜像模板，从 `server/` 重建并重新创建容器——绝不要删除
数据卷。

### 2C. 捕获登录 token

容器的 `dsh web` 行会打印 token。它每次重启都会改变，因此在服务器运行后捕获，
并在任何重启后重新捕获。

```bash
TOKEN=""
for _ in $(seq 1 60); do
  TOKEN="$(docker logs "$DS_BOT_CONTAINER" 2>&1 | grep -o 'token=[^ ]*' | tail -1 | cut -d= -f2-)"
  if [ -n "$TOKEN" ]; then break; fi
  sleep 2
done
test -n "$TOKEN" && echo "token captured"
```

`echo "token captured"` 只打印状态，绝不打印值。

### 2D. 额外的本地服务器

对运维人员需要的每台服务器重复第 2 阶段。每台都是独立容器，拥有自己的名称、
主机端口、数据目录和 token。复用 compose 构建出的镜像：

```bash
docker run -d --name dsbot-b \
  --restart unless-stopped \
  -p "127.0.0.1:${DS_BOT_PORT:-14001}:3080" \
  --env-file server/.env \
  -v /opt/dsbot-b/data:/data \
  -v /opt/dsbot-b/workspace:/workspace \
  dsbots/ds-bot:0.2.6-hub.3
```

规则：

- 先在主机创建目录，属主设为容器的 `PUID`/`PGID`（默认 `1000:1000`）。
- 主机端口不要落在 `13090`–`13199`；Hub 在该区间分配浏览器来源端口。
- 第二台团队使用其他提供商或密钥时，使用单独的 `--env-file`。
- 绝不要让两个容器共用同一个数据卷。
- 用第 2C 阶段和各自的 `DS_BOT_CONTAINER` 捕获每个容器的 token。

## 第 3 阶段 — 安装 Hub

```bash
cd "$RELEASE_DIR"
./install.sh "$DSH_PROFILE"
```

只装 Hub 和移动端 gate：

```bash
WITH_DESKTOP=0 ./install.sh "$DSH_PROFILE"
```

校验配置依赖：

```bash
"${DSH_BIN:-dsh}" plugin --profile "$DSH_PROFILE" list --depth 0 | grep dsbot-hub
```

预期：出现 `dsbot-hub` 行，版本 `0.11.14`。如果此安装的 CLI 语法不同，请停止
并索取配置路径，不要手动编辑配置。

然后，如果运维人员提供了 `DSH_RESTART_CMD` 就运行它，并让对方强制刷新浏览器。
否则把重启报告为手动步骤。

## 第 4 阶段 — 添加第一台服务器

这通常是浏览器步骤：Hub 使用 host-only grant Cookie。

1. 打开 DSH URL。
2. 选择 **Bots**（移动端外壳）或侧边栏的 **DS Bot Hub** 面板。
3. 打开服务器切换器 → 齿轮 → **Add server**。
4. 填写 `SERVER_LABEL`、`DS_BOT_ENDPOINT` 和第 2C 阶段捕获的 token。
5. 保存。
6. 确认选中的服务器变为 `SERVER_LABEL`，且机器人正常加载。

对每个容器重复步骤 1–6，使用独立的 id、名称和 endpoint。每台服务器有自己的
token；一台不可达不影响其他服务器切换。

在不打印 token 的前提下交给运维人员，最干净的方式是让对方在自己的终端读取：

```bash
docker logs "$DS_BOT_CONTAINER" 2>&1 | grep -o 'token=[^ ]*' | tail -1 | cut -d= -f2-
```

如果你已经把它保存在 `$TOKEN`，直接粘贴到你正在操作的表单中。如果既没有
浏览器也没有剪贴板，停在**手动待办**。绝不要把 token 粘贴到聊天中“帮忙”。

## 第 5 阶段 — 验证

对每个容器运行以下检查：

```bash
docker ps --format '{{.Names}} {{.Image}} {{.Status}}' | grep "$DS_BOT_CONTAINER"

docker exec "$DS_BOT_CONTAINER" node -p \
  "require('/data/profiles/$DS_BOT_PROFILE/node_modules/ds-bot/package.json').version"

docker exec "$DS_BOT_CONTAINER" sh -lc \
  "test -f /data/profiles/$DS_BOT_PROFILE/node_modules/ds-bot/src/host/reactions.js && echo reactions_present"
```

预期：正确的镜像、`0.2.6-hub.3`、`reactions_present`。

在 Hub 界面确认：

- 服务器 iframe 加载并显示机器人；
- 长按打开操作面板；
- Select Text 打开阅读器，返回可关闭；
- 添加回应后出现回应标签；
- 询问机器人你留下的回应，能得到正确回答。

如果无法检查界面，标记为**待办**；不要报告安装完成。

## 第 6 阶段 — 手机与远程访问

仅在运维人员需要手机访问时执行。索取 `PUBLIC_HOST` 和 `HUB_PROXY_BIND`，
编辑前展示确切文件与 diff：

```yaml
- id: dsbot-hub
  config:
    proxy:
      bind: <tailnet-or-lan-address>
```

规则：

- `127.0.0.1` 只适用于同一主机上的浏览器。
- `0.0.0.0` 会把来源端口暴露在所有网卡上；必须有防火墙/ACL。
- 手机使用 DSH Web 的 URL，不是来源端口。
- 如果 DSH 页面是 HTTPS，来源也必须是 HTTPS。

用 `DSH_RESTART_CMD` 重启 DSH，然后让运维人员在手机上打开 DSH URL 并选择
**Bots**。

## 第 7 阶段 — 报告

严格按此格式返回，不含任何机密值：

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

不要包含 token、密钥、Cookie、容器环境或 `.env` 内容。

## 第 8 阶段 — 回滚

仅在验证失败且运维人员批准后使用。

数据配置——使用第 2B 阶段记录的备份路径：

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

Hub——把上一个 tarball 重新安装到同一配置，然后重启 DSH：

```bash
"${DSH_BIN:-dsh}" plugin --profile "$DSH_PROFILE" add ./dsbot-hub-<previous>.tgz
```

绝不要删除数据卷，也绝不要运行 `docker compose down -v`。

## 停止条件

出现以下情况时停止并询问运维人员：

- 缺少必需输入或输入不明确；
- preflight 或校验和失败；
- 版本不是 `0.11.14` / `0.2.6-hub.3`；
- 容器未运行，或日志显示启动错误；
- 命令会打印或持久化机密；
- 重启、镜像推送、DNS 变更或删除未获授权；
- 需要浏览器步骤但没有浏览器。

## 附录 — 机密处理

| 值 | 安全做法 |
|---|---|
| 提供商密钥 | 放在 `server/.env`（权限 600），变量名与路由的 `apiKeyEnv` 一致；绝不作为 CLI 参数 |
| 容器登录 token | shell 变量；粘贴到 Hub 界面；绝不回显或提交 |
| 团队 Cookie | 保存在 DSH 凭据中；绝不导出或在机器间复制 |
| `.env`、`secrets.json`、Cookie | 绝不在会打印输出的命令中打开 |

如果机密仍被打印：

1. 说明它已暴露，但不要重复内容。
2. 让运维人员轮换（提供商密钥：重新签发；token：重启生成新的；Cookie：粘贴
   新 token）。
3. 在运维人员确认轮换前不要继续安装。

<p>
  <a href="README.zh-CN.md">README</a> ·
  <a href="SETUP.md">English</a> ·
  <a href="SETUP.pt-BR.md">Português (Brasil)</a>
</p>

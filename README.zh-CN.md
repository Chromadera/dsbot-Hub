<p align="center"><img src="icon.svg" width="72" height="72" alt="DSBots Hub"></p>

<h1 align="center">DSBots Hub</h1>

<p align="center">在 DeepSeek Harness 中用同一个切换器管理一个或多个 DS Bot 服务器。</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <strong>简体中文</strong>
</p>

<p align="center">
  版本 <strong>0.11.14</strong> · DS Bot <strong>0.2.6-hub.3</strong> · DSH <strong>0.2.2-alpha.3+</strong>
</p>

---

DSBots Hub 为 DeepSeek Harness（DSH）增加服务器切换器，并内嵌所选服务器的
真实 DS Bot 界面。每个服务器保留自己的来源（origin）、自己的会话 Cookie 和
自己的机器人。浏览器始终不会持有上游团队的凭据。

它面向**一名运维人员管理一个或多个自托管 DS Bot 团队**：一个 DSH 配置、
一个 Hub、任意数量的服务器。

> **这不是多租户服务。** 没有用户账号、角色或审计日志。请部署在 Tailscale
> 或 TLS 代理之后的局域网中，绝不要直接暴露在公网。见[安全](#安全)。

## 功能

- **一个切换器，多个服务器。** 切换器下方的机器人属于所选服务器；切换时保留
  每个服务器各自的会话。
- **来源隔离。** 内嵌界面从不从 DSH 来源提供。每个服务器有自己的代理来源和
  仅限该来源的会话 Cookie。
- **服务器端表情回应。** 用户每条消息最多两个回应，机器人最多一个。机器人获得
  `react` 工具，并在你对其消息作出回应后收到下一轮提示。*（需要随附的
  DS Bot 分支。）*
- **返回手势。** Android 返回键和边缘滑动会先关闭最上层——操作面板、引用、
  消息阅读器、设置、服务器面板——然后才允许 Hub 导航离开。
- **手机与平板流程。** 长按面板、系统表情输入、可选择文本的消息阅读器；
  仅桌面端的悬停工具栏在触摸设备上隐藏。
- **不复制数据。** 机器人、聊天、记忆和凭据都留在各自服务器上。

## 工作原理

```text
浏览器
  |
  +-- DSH + DSBots Hub 面板 .......... DSH 来源
  |     |  同源面板 API: /dsbot-hub/api
  |     |  GET /dsbot-hub/api/servers/<id>/open -> 短期 grant
  |     v
  +-- iframe --> 每服务器来源 --> Hub 代理 --> DS Bot 服务器
  |              (host-only Cookie)   (注入团队 Cookie)
  |
  +-- 工具 --> 每个服务器 endpoint 上的 /api/bot
```

Hub 申请 grant，grant 在该服务器来源上设置 host-only Cookie，代理再向上游注入
真实的团队 Cookie。没有 HTML 重写、没有共享 Cookie、没有跨服务器操作。来源
端口在 `13090`–`13199` 之间自动分配。

## 要求

| 组件 | 版本 | 说明 |
|---|---|---|
| DSH | 0.2.2-alpha.3+ | Web 配置；移动端外壳需要 0.2.2+ |
| Node | 24.9.0+ | 主机 CLI 与构建 |
| DS Bot | 0.2.6 | 原版即可用于 Hub；随附分支增加回应和返回手势 |
| Docker + Compose | 当前版本 | 仅用于随附的服务器镜像 |
| 模型提供商 | 任意 DSH 支持的提供商 | OpenCode Go 是随附默认值；见[模型提供商](#模型提供商) |
| 网络 | Tailscale、局域网或 TLS 代理 | Hub 在其后使用明文 HTTP |

以上任何一项都不在发布包内。发布包安装的是 DSH 插件和服务器镜像构建；DSH、
Node、Docker 以及提供商账号需要你自行准备。[SETUP.zh-CN.md](SETUP.zh-CN.md)
按阶段列出。

## 快速开始

发布包包含 Hub、移动端 gate、DS Bot 分支以及服务器镜像构建文件。

### 1. 解压并校验

```bash
mkdir -p dsbot-hub-0.11.14
tar -xzf dsbot-hub-release-0.11.14.tar.gz -C dsbot-hub-0.11.14
cd dsbot-hub-0.11.14

sha256sum -c SHA256SUMS     # 每一行都必须以 OK 结尾
./preflight.sh              # 检查主机与产物
```

### 2. 配置并启动 DS Bot 服务器

把提供商密钥放进私有环境文件，而不是命令行：

```bash
cp server/.env.example server/.env
chmod 600 server/.env
$EDITOR server/.env         # 填写提供商密钥；OpenCode Go 是默认值

docker compose -f server/compose.yml up -d --build
```

compose 会把服务器发布到 `127.0.0.1:13081`，数据存放在 `/opt/ds-bot`。两者
都是默认值而非固定路径：`server/.env` 中的 `DS_BOT_PORT`、`DS_BOT_CONTAINER`、
`DS_BOT_DATA_DIR` 和 `DS_BOT_WORKSPACE_DIR` 可以覆盖。如果数据目录不存在，请先
创建并交给 `PUID`/`PGID`（默认 `1000:1000`）。

容器会读取 `server/.env` 中的所有值。随附的 compose 针对 OpenCode Go 路由
编写，但这只是一种选择，不是硬性要求——见[模型提供商](#模型提供商)。

### 3. 把 Hub 安装到 DSH

```bash
./install.sh web            # 或: ./install.sh "$DSH_PROFILE"
```

这会安装 `dsbot-hub`、移动端 gate 以及固定版本的桌面插件集。只安装 Hub 和
gate：`WITH_DESKTOP=0 ./install.sh web`。

### 4. 重启 DSH 并打开 Hub

重启提供 DSH Web 的进程，然后强制刷新浏览器。面板会出现在侧边栏，移动端
外壳中出现在 **Bots**。

### 5. 添加服务器

打开 **DS Bot Hub → 齿轮 → Add server**，填写：

| 字段 | 值 |
|---|---|
| Name | 任意名称，例如 `Main` |
| Endpoint | `http://127.0.0.1:13081` |
| Login token | 容器打印的 token（见下） |

容器内的 DSH 会在启动时打印登录 URL。读取 token 时不要把它输出到共享日志：

```bash
docker logs ds-bot 2>&1 | grep -o 'token=[^ ]*' | tail -1 | cut -d= -f2-
```

把该值粘贴到 token 字段。Hub 将其保存为 DSH 机密，并换取团队 Cookie；
浏览器永远看不到该 Cookie。

> 容器重启后 token 会改变。如果服务器之后显示 **sign in**，请粘贴新的 token。

完成。切换器应显示服务器名称，其机器人应正常加载。

## 模型提供商

DS Bot 不绑定 OpenCode Go。模型来自 DSH 的 `llm-pi-ai` 适配器：每条路由都指定
保存其密钥的环境变量（`apiKeyEnv`）。随附的 compose 会把整个 `server/.env`
传入容器，因此添加提供商不需要修改 compose。

随附的 compose 使用一条 OpenCode Go 路由（`OPENCODE_GO_API_KEY`）。使用其他提供商：

1. 在容器配置的 `llm-pi-ai` 行中，把路由加入 `providers`。
2. 把密钥写入 `server/.env`，变量名与路由的 `apiKeyEnv` 一致。
3. 重启容器，然后在 DS Bot 中为机器人选择模型。

```yaml
providers:
  opencode-go:
    apiKeyEnv: OPENCODE_GO_API_KEY
  openai:
    apiKeyEnv: OPENAI_API_KEY
```

补丁中的 `config:` 块会替换该条目的整个配置，因此要重新列出所有仍需保留的
路由。自定义网关还需要 `api`、`baseURL` 和 `models`。

完整字段、网关示例和密钥存储方式见 [docs/providers.md](docs/providers.md)。

## 使用已有的 DS Bot 服务器

Hub 调用的是 DS Bot 界面自身使用的路由，因此已有的 DS Bot 0.2.6 服务器无需
改动：用它的 endpoint 和登录 token 添加即可。

随附分支增加了服务器端回应、机器人 `react` 工具和共享返回栈。有两种迁移方式：

```bash
# 已有容器：备份并更新其正在使用的数据配置
./server/install-existing.sh ds-bot ds-bot-0.2.6-hub.3.tgz

# 或重建镜像，让新容器直接使用该分支
docker compose -f server/compose.yml up -d --build
```

`install-existing.sh` 会在
`/data/profiles/web/node_modules/ds-bot.bak-<timestamp>` 保留带时间戳的旧包备份，
并重启容器。它不会删除数据卷。

## 多台本地服务器

一个容器就是一个团队。要在同一主机上运行第二个团队，请给它独立的名称、主机
端口、数据目录和 token：

```bash
docker run -d --name dsbot-b \
  --restart unless-stopped \
  -p 127.0.0.1:14001:3080 \
  --env-file server/.env \
  -v /opt/dsbot-b/data:/data \
  -v /opt/dsbot-b/workspace:/workspace \
  dsbots/ds-bot:0.2.6-hub.3
```

主机端口不要落在 `13090`–`13199`：Hub 在该区间分配浏览器来源端口。绝不要让
两个容器共用同一个数据卷。然后在 Hub 中用独立的 id、名称和 token 添加
`http://127.0.0.1:14001`。每台服务器重复一次；每个容器有自己的 token，其中一台
离线不影响其他服务器。

更多见 [docs/multiple-servers.md](docs/multiple-servers.md)。

## 手机与远程访问

手机加载 DSH Web 应用，Hub 的内嵌来源也必须能被手机访问。让两者指向同一
接口：

```yaml
- id: dsbot-hub
  config:
    proxy:
      listen: 127.0.0.1:13091
      bind: 100.x.y.z        # tailnet 地址，或在 ACL 之后的 0.0.0.0
```

然后在手机上打开 DSH URL，例如 `http://<tailnet-ip>:3080/`，选择 **Bots**。
Tailscale 会路由主机上的所有端口，因此不需要逐端口转发。

如果 DSH 使用 HTTPS，来源端口也必须是 HTTPS，否则浏览器会因混合内容阻止
iframe。一张覆盖该主机名的证书即可用于所有端口；用 Caddy 或
`tailscale serve` 终止 TLS。

完整步骤（包括 SSH 隧道和公网子域名）见 [docs/install.md](docs/install.md)。

## 配置

齿轮面板是常规编辑方式；`dsbot-hub` 行上的 YAML 用于引导和自动化：

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

| 字段 | 默认值 | 含义 |
|---|---|---|
| `servers[].endpoint` | — | Hub 访问的地址；Cookie 绑定到它的主机和端口 |
| `servers[].origin` | 自动 | 内嵌界面的浏览器来源；会分配一个 loopback 端口 |
| `servers[].cookieRef` | `DSBOT_<ID>_COOKIE` | 保存团队 Cookie 的 DSH 机密名 |
| `proxy.listen` | `127.0.0.1:13091` | 基于主机名的来源共用监听器 |
| `proxy.bind` | `127.0.0.1` | 每服务器来源绑定的接口 |
| `proxy.grantTtlSeconds` | `60` | grant 有效期 |
| `proxy.sessionHours` | `12` | 内嵌会话有效期 |

所有字段和来源规则见 [docs/config.md](docs/config.md)。

## 发布内容

| 文件 | 用途 |
|---|---|
| `dsbot-hub-0.11.14.tgz` | DSH Hub 插件 |
| `dsbot-mobile-desktop-gate-0.1.2.tgz` | 移动端桌面 UI gate |
| `ds-bot-0.2.6-hub.3.tgz` | DS Bot 分支：回应与返回手势 |
| `dsbot-hub-release-0.11.14.tar.gz` | 解压后的发布包：文档、配置、安装脚本、服务器构建 |
| `SHA256SUMS` | 产物校验和 |
| `preflight.sh` | 主机与发布包检查 |

## 故障排查

| 现象 | 可能原因 |
|---|---|
| 侧边栏没有面板 | DSH 未重启，或 bundle 不在配置中 |
| 内嵌框空白 | 来源端口未绑定到所用接口，或 HTTPS 页面内嵌 HTTP 来源 |
| 服务器显示 **Sign in** / 401 | token 已变，或 Cookie 创建后 endpoint 的主机/端口变了 |
| **Link expired** / 403 | grant 一次性且有效期短；重新打开该服务器 |
| `compose` 退出并提示 `env file ... not found` | 缺少 `server/.env`；复制 `server/.env.example` |
| 机器人回复 `MISSING_CREDENTIAL` | 该路由没有密钥；按 `apiKeyEnv` 名称写入 `server/.env` |
| 第二台服务器的内嵌框空白 | 主机端口与 `13090`–`13199` 冲突，或未绑定到所用接口 |
| 上游返回 403 | endpoint 的 authority 与 Cookie 的 authority 不一致 |

更多内容见 [docs/troubleshooting.md](docs/troubleshooting.md)。

## 文档

- [SETUP.zh-CN.md](SETUP.zh-CN.md) — 可由代理执行的安装运行手册
- [安装与网络](docs/install.md)
- [配置](docs/config.md)
- [模型提供商](docs/providers.md)
- [多服务器](docs/multiple-servers.md)
- [移动端外壳与手势](docs/mobile.md)
- [返回手势](docs/back-gesture.md)
- [升级](docs/upgrade.md)
- [兼容性](docs/compatibility.md)
- [运维](docs/operations.md)
- [故障排查](docs/troubleshooting.md)

## 安全

- DS Bot 登录 token 等同于该团队的完全控制权；提供商密钥是可消费的额度。
  两者都不要进入 shell 历史、聊天记录或 git。
- 把 Hub 保持在私有网络。Tailscale ACL 是外层边界，grant/会话 Cookie 是内层。
- 不要把 DSH 端口、代理端口或 DS Bot 端口暴露到公网。
- 以非 root 用户运行。`server/.env` 保持 `600`，DSH 主目录保持私有。
- 在把 Hub 暴露给他人之前先读 [SECURITY.md](SECURITY.md)。

## 许可证

Apache-2.0。随附的 DS Bot 分支同样使用 Apache-2.0，其 tarball 内含独立的
`LICENSE`、`NOTICE` 和 `MODIFICATIONS.md`。见 [NOTICE](NOTICE) 与
[THIRD_PARTY.md](THIRD_PARTY.md)。

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <a href="SETUP.zh-CN.md">安装指南</a>
</p>

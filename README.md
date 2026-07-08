# 塔罗圣战 PvP 在线对战 — 完整部署指南

## 项目结构

```
deploy/
├── pvp5.html       # 前端页面（GitHub Pages 托管）
├── server.js       # WebSocket 游戏服务器（Koyeb / Render 部署）
├── package.json    # Node.js 依赖配置
├── Procfile        # 云平台启动命令
└── README.md       # 本文件
```

---

## 第一步：部署 WebSocket 游戏服务器（推荐 Koyeb）

### 方案 A：Koyeb（推荐，免费且原生支持 WebSocket）

> Koyeb 免费套餐：每月 €5.5 额度，始终在线，自动 HTTPS，原生 WebSocket 支持。

1. **注册账号** → https://app.koyeb.com
2. **创建 GitHub 仓库**（将 deploy/ 目录推送到 GitHub，见第四步）
3. **在 Koyeb 创建 Service**：
   - 选择 "Deploy from Git Repository"
   - 连接你的 GitHub，选择对应仓库
   - Builder: **Dockerfile**（Koyeb 会自动检测 Node.js）
   - **Build Command**: 留空
   - **Run Command**: `node server.js`
   - **Port**: `8080`
   - **Environment Variables**: 无需额外设置（server.js 已读取 `PORT` 环境变量）
   - 点击 "Deploy"

4. **部署完成后**：
   - Koyeb 会分配一个 `.koyeb.app` 域名，例如 `tarot-pvp-xxx.koyeb.app`
   - **复制这个域名**（例如 `wss://tarot-pvp-xxx.koyeb.app`）

> ⚠️ 注意：server.js 监听 `process.env.PORT`（Koyeb 会自动设置），并且裸 WebSocket 服务可以用 `wss://` 前缀连接。如果 Koyeb 自动提供 TLS，使用 `wss://` 而非 `ws://`。

### 方案 B：Render（备选）

1. 注册 → https://render.com
2. 创建 **Web Service**，连接 GitHub 仓库
3. 设置：
   - **Name**: `tarot-pvp-server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free（免费实例 15 分钟无活动会休眠，唤醒有延迟）
4. 部署完毕后，Render 会分配 `https://tarot-pvp-server.onrender.com` 域名

> ⚠️ Render 免费版当 WebSocket 连接闲置时会休眠，适合测试用途。如需生产环境，建议升级付费套餐或使用 Koyeb。

### 方案 C：Heroku（已取消免费套餐，不推荐）

> Heroku 自 2022 年 11 月起已取消免费套餐，最低 $5/月。如需使用，步骤类似但不在此赘述。

---

## 第二步：托管前端页面到 GitHub Pages

### 创建仓库并推送

1. 在 GitHub 创建一个新仓库（如 `tarot-pvp`）
2. 推送 deploy/ 目录内容到该仓库（见第四步）

### 启用 GitHub Pages

1. 进入 GitHub 仓库 → **Settings** → **Pages**
2. **Source**: 选择 `Deploy from a branch`
3. **Branch**: `main`，**folder**: `/ (root)`
4. 点击 **Save**
5. 等待几分钟，GitHub 会显示你的页面地址：
   `https://你的用户名.github.io/tarot-pvp/pvp5.html`

---

## 第三步：配置前后端连接地址

### 修改服务器地址

打开 **`pvp5.html`**，找到顶部附近这段代码：

```javascript
// ===== 服务器地址配置（部署时修改此项）=====
const PVP_SERVER_URL = "wss://你的服务器域名.com:443";  // 部署后替换为实际地址
```

将其中的 URL 替换为你的实际服务器地址：

| 平台    | 示例地址                                                              |
|---------|----------------------------------------------------------------------|
| Koyeb   | `wss://tarot-pvp-xxxx.koyeb.app`                                    |
| Render  | `wss://tarot-pvp-server.onrender.com`（Render 可能用 `ws://` 取决于 TLS 配置） |

> 🔑 **重要判断规则**：
> - 如果浏览器通过 `https://` 访问页面 → 服务器必须用 `wss://`（安全 WebSocket）
> - 如果浏览器通过 `http://` 访问页面 → 服务器可用 `ws://` 或 `wss://`
> - GitHub Pages 默认是 `https://` → **必须使用 `wss://`**
> - Koyeb 提供自动 TLS → 使用 `wss://`
> - Render 免费版需要确认是否支持 TLS WebSocket，尝试 `wss://`，不通则换 `ws://`

### 修改后重新推送

1. 修改完成后，提交并推送：
   ```bash
   git add pvp5.html
   git commit -m "配置服务器地址"
   git push
   ```

2. GitHub Pages 会自动重新部署（约 1-2 分钟生效）

---

## 第四步：初始化 Git 并推送（完整命令）

在 deploy 目录下执行：

```powershell
# 1. 进入 deploy 目录
cd C:\Users\白洛因\Documents\pvp\deploy

# 2. 初始化 Git 仓库
git init
git add .
git commit -m "初始化：塔罗圣战 PvP 在线对战"

# 3. 推送到 GitHub（替换 <用户名> 和 <仓库名>）
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git branch -M main
git push -u origin main
```

### 后续更新推送

```powershell
git add .
git commit -m "更新说明"
git push
```

---

## 完整架构示意图

```
┌─────────────────────────────────────────────────────┐
│                   浏览器 (玩家)                       │
│  https://你的用户名.github.io/tarot-pvp/pvp5.html     │
│              ↓ WebSocket (wss://)                    │
├─────────────────────────────────────────────────────┤
│              Koyeb / Render 云服务器                  │
│         server.js (Node.js + ws 库)                  │
│             监听端口 8080 / $PORT                     │
│        管理房间、玩家、回合、游戏动作                    │
└─────────────────────────────────────────────────────┘
```

---

## 常见问题排查

### Q: WebSocket 连接失败（ERR_CONNECTION_REFUSED）
- **原因**: 服务器未启动或端口不对
- **解决**: 确认 server.js 已成功部署且正在运行；检查 Koyeb/Render 日志

### Q: WebSocket 连接被拒绝（403/404）
- **原因**: 协议不匹配（ws:// vs wss://）
- **解决**: GitHub Pages 使用 HTTPS，服务器必须用 `wss://`

### Q: 连接超时
- **原因**: Render 免费实例休眠
- **解决**: 访问 Render 控制台手动唤醒，或换用 Koyeb

### Q: 页面白屏或脚本错误
- **原因**: 浏览器控制台查看具体错误（F12 → Console）
- **解决**: 确认 pvp5.html 中 `PVP_SERVER_URL` 的端口号（Koyeb 不需要端口号）

---

## 测试部署

部署完成后，你可以：
1. 打开两个浏览器窗口访问 GitHub Pages 地址
2. 在 PvP 大厅分别输入名字和英雄
3. 一方创建房间，另一方加入
4. 双方准备就绪后开始对战

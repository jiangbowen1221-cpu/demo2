# 私有化部署技术指南 (Private Deployment Guide)

本档专门为技术负责人和运维团队编写，详细说明“智能演示 Demo 生成系统”在私有化环境下的部署架构、依赖项及配置要求。

---

## 1. 系统架构概览 (Architecture Overview)

本系统采用轻量化的前后端分离架构，旨在实现低成本部署和高效率维护。

- **前端 (Frontend)**: 基于 React + Vite 构建的 SPA 应用，编译后为纯静态文件。
- **后端 (Backend)**: 基于 Python FastAPI 的异步服务，处理业务逻辑、文件管理及 AI 接口转发。
- **数据库 (Database)**: 默认使用 SQLite，支持通过环境变量扩展至 MySQL/PostgreSQL。
- **存储 (Storage)**: 采用本地磁盘存储，用于存放用户上传的素材和生成的项目数据。

---

## 2. 依赖清单 (Dependency List)

### 2.1 中间件 (Middleware)
| 组件 | 要求 | 说明 |
| :--- | :--- | :--- |
| **Python** | 3.10+ | 后端运行环境，建议使用 `venv` 或 `conda` 隔离环境。 |
| **Node.js** | 18+ | 前端构建环境（仅编译时需要）。 |
| **Nginx** | 任意稳定版 | 用于托管前端静态资源并进行 API 反向代理。 |
| **SQLite** | 内置 | 默认数据库，产生一个本地 `database.db` 文件。 |

### 2.2 外部服务接口 (External API)
系统核心 AI 能力依赖于兼容 OpenAI 协议的大模型接口。

- **默认接口**: `https://api.omnimaas.com/v1`
- **协议标准**: 标准 OpenAI API V1 协议。
- **网络要求**: 
  - **外网模式**: 服务器需放行对 `api.omnimaas.com` 的 HTTPS (443端口) 访问。
  - **纯内网模式**: 需提供一个内网可达的 API 地址（如企业内部的大模型网关或本地部署的开源模型接口）。

---

## 3. 部署步骤 (Deployment Steps)

### 步骤 A：后端部署
1. **安装环境**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. **配置环境变量**:
   在 `backend` 目录下创建 `.env` 文件：
   ```env
   OPENAI_API_KEY=your_key_here
   OPENAI_BASE_URL=https://api.omnimaas.com/v1
   # 如果有内网代理，请在此配置
   ```
3. **启动服务**:
   建议生产环境使用 `gunicorn` 或 `uvicorn` 多进程模式：
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

### 步骤 B：前端构建与托管
1. **编译打包**:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
2. **Nginx 配置示例**:
   ```nginx
   server {
       listen 80;
       server_name your_domain.com;

       # 前端静态文件
       location / {
           root /path/to/frontend/dist;
           index index.html;
           try_files $uri $uri/ /index.html;
       }

       # 后端 API 转发
       location /api/v1/ {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           # 必须配置，否则流式输出会被缓存
           proxy_set_header Connection "";
           proxy_http_version 1.1;
           proxy_buffering off;
           proxy_cache off;
       }
   }
   ```

---

## 4. 关键注意事项 (Critical Notes for Tech Lead)

### 4.1 数据持久化
- 后端 `uploads/` 目录存放所有用户上传文件，**必须持久化存储**，防止容器重启丢失数据。
- `database.db` 文件包含用户信息及项目元数据，需定期备份。

### 4.2 AI 接口适配
如果需要对接企业内部模型（如私有化 DeepSeek, Llama3 等）：
- 只要接口符合 OpenAI 格式，仅需在 `.env` 中修改 `OPENAI_BASE_URL` 即可无缝切换。
- **Streaming 支持**: 必须确保内部接口支持流式输出 (Stream: true)，否则前端进度条和打字机效果将失效。

### 4.3 浏览器端外部资源
生成的 Demo 会在用户浏览器中加载以下 CDN：
- `https://cdn.tailwindcss.com`
- `https://unpkg.com/lucide@latest`
**内网建议**: 如果用户终端无法上网，请修改后端 `app/core/prompts.py` 中的 `DEMO_PROMPT`，将这些 CDN 地址替换为公司内部的静态资源镜像地址。

---

## 5. 常见问题排查 (Troubleshooting)

- **Q: 为什么生成的文档一直是空白或加载中？**
  - A: 检查后端日志。通常是 API Key 无效或服务器无法连接到 `OPENAI_BASE_URL`。
- **Q: 部署后流式输出（逐字显示）失效？**
  - A: 检查 Nginx 是否开启了 `proxy_buffering`。必须将其设置为 `off`。
- **Q: 数据库连接失败？**
  - A: 确保对 `backend` 目录有写入权限，SQLite 需要在目录下创建日志和临时文件。

---
*文档版本：v1.0.0*
*编写日期：2026-01-21*

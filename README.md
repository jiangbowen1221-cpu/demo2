# 智能演示Demo生成系统 (Intelligent Demo Generator System)

这是一个基于微服务架构（Modular Monolith）的智能Demo生成系统，旨在通过AI自动化从需求到代码生成的全流程。

## 🚀 快速开始 (Quick Start)

### 1. 环境准备 (Prerequisites)
- Python 3.9+
- Node.js 18+

### 2. 后端启动 (Backend Setup)
后端基于 FastAPI 开发，负责处理业务逻辑和 LLM 交互。

```bash
# 进入后端目录
cd backend

# 安装依赖
pip install -r requirements.txt

# 创建 .env 文件并配置 API Key
# (参考 backend/app/core/config.py)
# export OPENAI_API_KEY=your_key_here

# 启动服务
uvicorn app.main:app --reload
```
后端服务地址: `http://localhost:8000`
API 文档地址: `http://localhost:8000/docs`

### 3. 前端启动 (Frontend Setup)
前端基于 React + Vite + Ant Design 开发。

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```
前端访问地址: `http://localhost:5173`

## 🏗️ 系统架构 (Architecture)

### 目录结构
- `backend/`: 后端服务
  - `app/api/`: API 路由定义
  - `app/services/`: 核心业务逻辑（LLM 服务等）
  - `app/core/`: 核心配置
- `frontend/`: 前端应用
  - `src/components/`: UI 组件
  - `src/pages/`: 页面逻辑

### 核心功能模块
1. **需求输入**: 用户提供文本或文件需求。
2. **文档生成**:
   - 需求文档 (Requirements Doc)
   - 产品需求文档 (PRD)
   - 技术方案文档 (Tech Spec)
3. **Demo 生成**: 基于技术文档自动生成代码。

## 🔧 技术栈 (Tech Stack)
- **Backend**: FastAPI, OpenAI SDK, Pydantic
- **Frontend**: React, Vite, Ant Design, React Markdown
- **AI**: OpenAI GPT / Zhipu GLM

## 📝 待办事项 (Todo)
- [x] 项目初始化
- [x] 基础 LLM 服务集成
- [ ] 完善文档生成 Prompt 链
---

## 📄 版权信息 (License & Copyright)

本系统所有权归属于 **行至智能**。
© 2026 行至智能. All rights reserved.

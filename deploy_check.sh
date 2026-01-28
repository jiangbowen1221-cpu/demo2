#!/bin/bash
# 自动部署自检脚本 - 小白友好版

echo "--- 🚀 开始部署自检 ---"

# 1. 检查环境
echo "检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    exit 1
fi

echo "检查 Python 环境..."
if ! command -v python &> /dev/null; then
    echo "❌ 错误: 未安装 Python"
    exit 1
fi

# 2. 前端打包
echo "--- 📦 正在打包前端界面 ---"
cd frontend
npm install
npm run build
cd ..

# 3. 准备静态目录
echo "--- 📂 正在同步静态文件 ---"
mkdir -p backend/static
cp -r frontend/dist/* backend/static/

# 4. 提示
echo ""
echo "--- ✅ 自检完成 ---"
echo "前端已成功打包并整合到后端！"
echo "现在你可以尝试以下操作："
echo "1. 进入 backend 目录: cd backend"
echo "2. 启动服务: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo "3. 访问 http://localhost:8000 即可看到生产环境版本的系统。"
echo ""
echo "提示：正式上线建议使用 Docker 方案，更稳定。"

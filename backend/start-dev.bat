@echo off
REM 账单管理系统启动脚本 (Windows)

REM 设置加密密钥 (生产环境请使用更安全的方式管理)
set ENCRYPTION_KEY=your-secure-key-at-least-32-characters-long
set JWT_SECRET=your-jwt-secret-at-least-32-characters
set NODE_ENV=development

REM 启动服务
npm start

pause

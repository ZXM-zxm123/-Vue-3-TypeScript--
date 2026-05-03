# 账单管理系统启动脚本

# ========================
# 开发环境启动
# ========================

# 设置加密密钥 (生产环境请使用更安全的方式管理)
export ENCRYPTION_KEY="your-secure-key-at-least-32-characters-long"
export JWT_SECRET="your-jwt-secret-at-least-32-characters"
export NODE_ENV=development

# 启动服务
npm start

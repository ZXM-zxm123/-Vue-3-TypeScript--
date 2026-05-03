<template>
  <div class="budgets-container">
    <el-container>
      <el-header>
        <div class="header-content">
          <h2>账单管理系统</h2>
          <div class="header-actions">
            <span>欢迎，{{ username }}</span>
            <el-button @click="handleLogout" size="small">退出</el-button>
          </div>
        </div>
      </el-header>
      <el-container>
        <el-aside width="200px">
          <el-menu :default-active="activeMenu" router>
            <el-menu-item index="/">
              <el-icon><HomeFilled /></el-icon>
              <span>仪表盘</span>
            </el-menu-item>
            <el-menu-item index="/bills">
              <el-icon><Money /></el-icon>
              <span>账单</span>
            </el-menu-item>
            <el-menu-item index="/accounts">
              <el-icon><Wallet /></el-icon>
              <span>账户</span>
            </el-menu-item>
            <el-menu-item index="/budgets">
              <el-icon><DataLine /></el-icon>
              <span>预算</span>
            </el-menu-item>
            <el-menu-item index="/rules">
              <el-icon><Setting /></el-icon>
              <span>规则</span>
            </el-menu-item>
          </el-menu>
        </el-aside>
        <el-main>
          <div class="budgets-content">
            <el-row :gutter="20" class="toolbar">
              <el-col :span="24">
                <el-button type="primary" @click="showAddDialog = true">设置预算</el-button>
              </el-col>
            </el-row>

            <el-card class="budget-card" v-for="status in budgetStatus" :key="status.category">
              <template #header>
                <div class="budget-header">
                  <span>{{ status.category }}</span>
                  <el-tag :type="status.exceeded ? 'danger' : 'success'">
                    {{ status.exceeded ? '已超限' : '正常' }}
                  </el-tag>
                </div>
              </template>
              <div class="budget-info">
                <div class="budget-item">
                  <span class="label">预算额度:</span>
                  <span class="value">¥{{ status.budget.toFixed(2) }}</span>
                </div>
                <div class="budget-item">
                  <span class="label">已花费:</span>
                  <span class="value expense">¥{{ status.spent.toFixed(2) }}</span>
                </div>
                <div class="budget-item">
                  <span class="label">剩余:</span>
                  <span class="value" :class="{ exceeded: status.exceeded }">
                    ¥{{ status.remaining.toFixed(2) }}
                  </span>
                </div>
              </div>
              <el-progress
                :percentage="Math.min((status.spent / status.budget) * 100, 100)"
                :color="status.exceeded ? '#ff4949' : '#67c23a'"
                style="margin-top: 15px;"
              />
              <div v-if="status.exceeded" class="alert-message">
                <el-alert
                  title="预算已超限！请注意控制支出"
                  type="error"
                  :closable="false"
                  show-icon
                />
              </div>
            </el-card>

            <el-empty v-if="budgetStatus.length === 0" description="暂无预算设置，点击上方按钮添加" />
          </div>
        </el-main>
      </el-container>
    </el-container>

    <el-dialog v-model="showAddDialog" title="设置预算" width="500px">
      <el-form :model="budgetForm" label-width="100px">
        <el-form-item label="类别">
          <el-select v-model="budgetForm.category" placeholder="选择类别">
            <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </el-form-item>
        <el-form-item label="预算金额">
          <el-input-number v-model="budgetForm.amount" :precision="2" :min="0" :step="100" />
        </el-form-item>
        <el-form-item label="周期">
          <el-select v-model="budgetForm.period" placeholder="选择周期">
            <el-option label="每月" value="monthly" />
            <el-option label="每周" value="weekly" />
            <el-option label="每年" value="yearly" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddBudget">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { BudgetStatus } from '../types';
import { budgetAPI } from '../utils/api';
import { HomeFilled, Money, Wallet, DataLine, Setting } from '@element-plus/icons-vue';

const router = useRouter();
const username = localStorage.getItem('username') || '用户';
const activeMenu = ref('/budgets');

const budgetStatus = ref<BudgetStatus[]>([]);
const showAddDialog = ref(false);

const categories = ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他'];

const budgetForm = reactive({
  category: '',
  amount: 0,
  period: 'monthly'
});

onMounted(async () => {
  await loadBudgetStatus();
});

const loadBudgetStatus = async () => {
  try {
    const { data } = await budgetAPI.getStatus();
    budgetStatus.value = data;
  } catch (error) {
    ElMessage.error('加载预算状态失败');
  }
};

const handleAddBudget = async () => {
  try {
    await budgetAPI.create({
      category: budgetForm.category,
      amount: budgetForm.amount,
      period: budgetForm.period
    });
    ElMessage.success('预算设置成功');
    showAddDialog.value = false;
    await loadBudgetStatus();
  } catch (error) {
    ElMessage.error('设置失败');
  }
};

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  router.push('/login');
};
</script>

<style scoped>
.budgets-container {
  min-height: 100vh;
}

.el-header {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.header-content h2 {
  margin: 0;
  color: #667eea;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.el-aside {
  background: white;
  min-height: calc(100vh - 60px);
}

.budgets-content {
  padding: 20px;
}

.toolbar {
  margin-bottom: 20px;
}

.budget-card {
  margin-bottom: 20px;
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.budget-info {
  display: flex;
  justify-content: space-around;
  padding: 20px 0;
}

.budget-item {
  text-align: center;
}

.budget-item .label {
  display: block;
  font-size: 14px;
  color: #909399;
  margin-bottom: 5px;
}

.budget-item .value {
  font-size: 24px;
  font-weight: bold;
  color: #667eea;
}

.budget-item .value.expense {
  color: #ff4949;
}

.budget-item .value.exceeded {
  color: #ff4949;
}

.alert-message {
  margin-top: 15px;
}
</style>

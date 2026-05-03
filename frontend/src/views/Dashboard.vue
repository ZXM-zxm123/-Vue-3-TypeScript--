<template>
  <div class="dashboard-container">
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
          <div class="dashboard-content">
            <el-row :gutter="20">
              <el-col :span="24">
                <h3>{{ currentMonth }} 月账单概况</h3>
              </el-col>
            </el-row>

            <el-row :gutter="20" class="chart-row">
              <el-col :span="12">
                <el-card>
                  <template #header>
                    <span>支出分类（饼图）</span>
                  </template>
                  <div ref="pieChartRef" style="width: 100%; height: 300px;"></div>
                </el-card>
              </el-col>
              <el-col :span="12">
                <el-card>
                  <template #header>
                    <span>每日支出趋势（折线图）</span>
                  </template>
                  <div ref="lineChartRef" style="width: 100%; height: 300px;"></div>
                </el-card>
              </el-col>
            </el-row>

            <el-row :gutter="20" class="chart-row">
              <el-col :span="24">
                <el-card>
                  <template #header>
                    <span>预算状态</span>
                    <el-button size="small" @click="$router.push('/budgets')" style="float: right;">
                      管理预算
                    </el-button>
                  </template>
                  <el-table :data="budgetStatus" style="width: 100%">
                    <el-table-column prop="category" label="类别" width="120" />
                    <el-table-column label="预算" width="120">
                      <template #default="{ row }">
                        ¥{{ row.budget.toFixed(2) }}
                      </template>
                    </el-table-column>
                    <el-table-column label="已花费" width="120">
                      <template #default="{ row }">
                        ¥{{ row.spent.toFixed(2) }}
                      </template>
                    </el-table-column>
                    <el-table-column label="剩余" width="120">
                      <template #default="{ row }">
                        <span :style="{ color: row.remaining < 0 ? '#ff4949' : '#67c23a' }">
                          ¥{{ row.remaining.toFixed(2) }}
                        </span>
                      </template>
                    </el-table-column>
                    <el-table-column label="状态" width="100">
                      <template #default="{ row }">
                        <el-tag :type="row.exceeded ? 'danger' : 'success'">
                          {{ row.exceeded ? '超限' : '正常' }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="进度">
                      <template #default="{ row }">
                        <el-progress
                          :percentage="Math.min((row.spent / row.budget) * 100, 100)"
                          :color="row.exceeded ? '#ff4949' : '#67c23a'"
                        />
                      </template>
                    </el-table-column>
                  </el-table>
                  <el-empty v-if="budgetStatus.length === 0" description="暂无预算设置" />
                </el-card>
              </el-col>
            </el-row>

            <el-row :gutter="20" class="chart-row">
              <el-col :span="24">
                <el-card>
                  <template #header>
                    <span>账户余额</span>
                    <el-button size="small" @click="$router.push('/accounts')" style="float: right;">
                      管理账户
                    </el-button>
                  </template>
                  <el-row :gutter="20">
                    <el-col :span="8" v-for="account in accounts" :key="account.id">
                      <el-card shadow="hover">
                        <template #header>
                          <span>{{ account.name }}</span>
                          <el-tag size="small" :type="account.type === 'cash' ? 'success' : 'warning'">
                            {{ account.type === 'cash' ? '现金' : '信用卡' }}
                          </el-tag>
                        </template>
                        <div class="account-balance">
                          ¥{{ account.balance.toFixed(2) }}
                        </div>
                      </el-card>
                    </el-col>
                  </el-row>
                </el-card>
              </el-col>
            </el-row>
          </div>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import type { DashboardData, BudgetStatus, Account } from '../types';
import { dashboardAPI, budgetAPI, accountAPI } from '../utils/api';
import { HomeFilled, Money, Wallet, DataLine, Setting } from '@element-plus/icons-vue';

const router = useRouter();
const pieChartRef = ref<HTMLElement>();
const lineChartRef = ref<HTMLElement>();

const username = localStorage.getItem('username') || '用户';
const activeMenu = ref('/');

const dashboardData = ref<DashboardData | null>(null);
const budgetStatus = ref<BudgetStatus[]>([]);
const accounts = ref<Account[]>([]);

const currentMonth = computed(() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
});

onMounted(async () => {
  await loadDashboard();
  await loadBudgetStatus();
  await loadAccounts();
});

const loadDashboard = async () => {
  try {
    const { data } = await dashboardAPI.getData();
    dashboardData.value = data;
    setTimeout(() => {
      renderPieChart();
      renderLineChart();
    }, 100);
  } catch (error) {
    ElMessage.error('加载仪表盘数据失败');
  }
};

const loadBudgetStatus = async () => {
  try {
    const { data } = await budgetAPI.getStatus();
    budgetStatus.value = data;
  } catch (error) {
    console.error('加载预算状态失败', error);
  }
};

const loadAccounts = async () => {
  try {
    const { data } = await accountAPI.getAll();
    accounts.value = data;
  } catch (error) {
    console.error('加载账户失败', error);
  }
};

const renderPieChart = () => {
  if (!pieChartRef.value || !dashboardData.value) return;

  const chart = echarts.init(pieChartRef.value);
  const expenseData = dashboardData.value.categoryData.filter(d => d.total < 0);

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ¥{c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '支出分类',
        type: 'pie',
        radius: '70%',
        data: expenseData.map(d => ({
          name: d.category,
          value: Math.abs(d.total).toFixed(2)
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };

  chart.setOption(option);
};

const renderLineChart = () => {
  if (!lineChartRef.value || !dashboardData.value) return;

  const chart = echarts.init(lineChartRef.value);

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: '{b}: ¥{c}'
    },
    xAxis: {
      type: 'category',
      data: dashboardData.value.dailyData.map(d => d.date.slice(5))
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '¥{value}'
      }
    },
    series: [
      {
        name: '每日支出',
        type: 'line',
        data: dashboardData.value.dailyData.map(d => d.total.toFixed(2)),
        smooth: true,
        areaStyle: {
          opacity: 0.3
        }
      }
    ]
  };

  chart.setOption(option);
};

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  router.push('/login');
};
</script>

<style scoped>
.dashboard-container {
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

.dashboard-content {
  padding: 20px;
}

.dashboard-content h3 {
  margin-bottom: 20px;
  color: white;
}

.chart-row {
  margin-bottom: 20px;
}

.account-balance {
  font-size: 24px;
  font-weight: bold;
  color: #667eea;
  text-align: center;
  padding: 20px 0;
}
</style>

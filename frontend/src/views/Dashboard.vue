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
            <!-- 顶部月份/年份选择 -->
            <el-row :gutter="20" style="margin-bottom: 20px;">
              <el-col :span="12">
                <div class="period-selector">
                  <span>选择月份：</span>
                  <el-select
                    v-model="selectedMonth"
                    placeholder="请选择"
                    @change="loadMonthData"
                    style="width: 150px; margin-left: 10px;"
                  >
                    <el-option
                      v-for="m in availableMonths"
                      :key="m"
                      :label="m"
                      :value="m"
                    />
                  </el-select>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="period-selector">
                  <span>选择年份（趋势图）：</span>
                  <el-select
                    v-model="selectedYear"
                    placeholder="请选择"
                    @change="loadYearTrend"
                    style="width: 120px; margin-left: 10px;"
                  >
                    <el-option
                      v-for="y in availableYears"
                      :key="y"
                      :label="y"
                      :value="y"
                    />
                  </el-select>
                </div>
              </el-col>
            </el-row>

            <!-- 快速统计卡片 -->
            <el-row :gutter="20" style="margin-bottom: 20px;">
              <el-col :span="6">
                <el-card class="stat-card income">
                  <div class="stat-icon">💰</div>
                  <div class="stat-content">
                    <div class="stat-label">本月收入</div>
                    <div class="stat-value">¥{{ totalIncome.toFixed(2) }}</div>
                  </div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card class="stat-card expense">
                  <div class="stat-icon">💸</div>
                  <div class="stat-content">
                    <div class="stat-label">本月支出</div>
                    <div class="stat-value">¥{{ totalExpense.toFixed(2) }}</div>
                  </div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card class="stat-card balance">
                  <div class="stat-icon">📊</div>
                  <div class="stat-content">
                    <div class="stat-label">本月结余</div>
                    <div class="stat-value">¥{{ (totalIncome + totalExpense).toFixed(2) }}</div>
                  </div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card class="stat-card count">
                  <div class="stat-icon">📝</div>
                  <div class="stat-content">
                    <div class="stat-label">账单数</div>
                    <div class="stat-value">{{ totalBillsCount }}</div>
                  </div>
                </el-card>
              </el-col>
            </el-row>

            <!-- 图表区域 -->
            <el-row :gutter="20" class="chart-row">
              <el-col :span="12">
                <el-card>
                  <template #header>
                    <span>支出分类（饼图）</span>
                  </template>
                  <div v-loading="categoryLoading" ref="pieChartRef" style="width: 100%; height: 350px;"></div>
                </el-card>
              </el-col>
              <el-col :span="12">
                <el-card>
                  <template #header>
                    <span>每日收支趋势（折线图）</span>
                  </template>
                  <div v-loading="dailyLoading" ref="lineChartRef" style="width: 100%; height: 350px;"></div>
                </el-card>
              </el-col>
            </el-row>

            <!-- 年度趋势图 -->
            <el-row :gutter="20" class="chart-row">
              <el-col :span="24">
                <el-card>
                  <template #header>
                    <span>{{ selectedYear }}年度收支趋势</span>
                  </template>
                  <div v-loading="trendLoading" ref="trendChartRef" style="width: 100%; height: 300px;"></div>
                </el-card>
              </el-col>
            </el-row>

            <!-- 预算状态 -->
            <el-row :gutter="20" class="chart-row">
              <el-col :span="24">
                <el-card>
                  <template #header>
                    <span>本月预算状态</span>
                    <el-button size="small" @click="$router.push('/budgets')" style="float: right;">
                      管理预算
                    </el-button>
                  </template>
                  <el-table :data="budgetStatus" style="width: 100%;">
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

            <!-- 账户余额 -->
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
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import { HomeFilled, Money, Wallet, DataLine, Setting } from '@element-plus/icons-vue';
import { dashboardAPI, budgetAPI, accountAPI, statsAPI } from '../utils/api';
import type { DashboardData, BudgetStatus, Account, CategorySummaryResponse, DailySummaryResponse, MonthlyTrendResponse } from '../types';

const router = useRouter();
const pieChartRef = ref<HTMLElement>();
const lineChartRef = ref<HTMLElement>();
const trendChartRef = ref<HTMLElement>();

const username = localStorage.getItem('username') || '用户';
const activeMenu = ref('/');

const dashboardData = ref<DashboardData | null>(null);
const budgetStatus = ref<BudgetStatus[]>([]);
const accounts = ref<Account[]>([]);

const loading = ref(false);
const categoryLoading = ref(false);
const dailyLoading = ref(false);
const trendLoading = ref(false);

const availableMonths = ref<string[]>([]);
const selectedMonth = ref<string>('');
const availableYears = ref<number[]>([]);
const selectedYear = ref<number>(new Date().getFullYear());

const categorySummary = ref<CategorySummaryResponse | null>(null);
const dailySummary = ref<DailySummaryResponse | null>(null);
const monthlyTrend = ref<MonthlyTrendResponse | null>(null);

// 计算属性：快速统计
const totalIncome = computed(() => {
  if (!categorySummary.value) return 0;
  return categorySummary.value.data.reduce((sum, item) => sum + item.income, 0);
});

const totalExpense = computed(() => {
  if (!categorySummary.value) return 0;
  return categorySummary.value.data.reduce((sum, item) => sum + Math.abs(item.expense), 0);
});

const totalBillsCount = computed(() => {
  if (!categorySummary.value) return 0;
  return categorySummary.value.data.reduce((sum, item) => sum + item.count, 0);
});

// 初始化年份列表
const initYears = () => {
  const currentYear = new Date().getFullYear();
  availableYears.value = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    availableYears.value.push(y);
  }
};

// 加载月份列表
const loadMonths = async () => {
  try {
    const { data } = await statsAPI.getMonths();
    availableMonths.value = data;
    if (data.length > 0 && !selectedMonth.value) {
      selectedMonth.value = data[0];
    }
  } catch (error) {
    ElMessage.error('加载月份列表失败');
  }
};

// 加载月份数据
const loadMonthData = async () => {
  await Promise.all([loadCategorySummary(), loadDailySummary()]);
  renderPieChart();
  renderLineChart();
};

// 加载分类汇总
const loadCategorySummary = async () => {
  categoryLoading.value = true;
  try {
    const { data } = await statsAPI.getCategorySummary(selectedMonth.value);
    categorySummary.value = data;
  } catch (error) {
    ElMessage.error('加载分类汇总失败');
  } finally {
    categoryLoading.value = false;
  }
};

// 加载每日汇总
const loadDailySummary = async () => {
  dailyLoading.value = true;
  try {
    const { data } = await statsAPI.getDailySummary(selectedMonth.value);
    dailySummary.value = data;
  } catch (error) {
    ElMessage.error('加载每日汇总失败');
  } finally {
    dailyLoading.value = false;
  }
};

// 加载年度趋势
const loadYearTrend = async () => {
  trendLoading.value = true;
  try {
    const { data } = await statsAPI.getMonthlyTrend(selectedYear.value);
    monthlyTrend.value = data;
    renderTrendChart();
  } catch (error) {
    ElMessage.error('加载年度趋势失败');
  } finally {
    trendLoading.value = false;
  }
};

// 渲染饼图
const renderPieChart = () => {
  if (!pieChartRef.value || !categorySummary.value) return;

  const chart = echarts.init(pieChartRef.value);
  const expenseData = categorySummary.value.data
    .filter(d => d.expense < 0)
    .map(d => ({
      name: d.category,
      value: Math.abs(d.expense).toFixed(2)
    }));

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ¥{c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle'
    },
    series: [
      {
        name: '支出分类',
        type: 'pie',
        radius: '70%',
        center: ['60%', '50%'],
        data: expenseData,
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

// 渲染折线图
const renderLineChart = () => {
  if (!lineChartRef.value || !dailySummary.value) return;

  const chart = echarts.init(lineChartRef.value);

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = params[0].axisValue + '<br/>';
        params.forEach((param: any) => {
          result += `${param.seriesName}: ¥${Math.abs(param.value).toFixed(2)}<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: ['支出', '收入']
    },
    xAxis: {
      type: 'category',
      data: dailySummary.value.data.map(d => d.date.slice(8)),
      axisLabel: {
        formatter: '{value}日'
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '¥{value}'
      }
    },
    series: [
      {
        name: '支出',
        type: 'line',
        data: dailySummary.value.data.map(d => Math.abs(d.expense)),
        smooth: true,
        itemStyle: { color: '#ff4949' },
        areaStyle: {
          opacity: 0.2,
          color: '#ff4949'
        }
      },
      {
        name: '收入',
        type: 'line',
        data: dailySummary.value.data.map(d => d.income),
        smooth: true,
        itemStyle: { color: '#67c23a' },
        areaStyle: {
          opacity: 0.2,
          color: '#67c23a'
        }
      }
    ]
  };

  chart.setOption(option);
};

// 渲染年度趋势图
const renderTrendChart = () => {
  if (!trendChartRef.value || !monthlyTrend.value) return;

  const chart = echarts.init(trendChartRef.value);

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = params[0].axisValue + '<br/>';
        params.forEach((param: any) => {
          result += `${param.seriesName}: ¥${Math.abs(param.value).toFixed(2)}<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: ['支出', '收入']
    },
    xAxis: {
      type: 'category',
      data: monthlyTrend.value.data.map(d => d.month.slice(5) + '月'),
      axisLabel: {
        interval: 0,
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '¥{value}'
      }
    },
    series: [
      {
        name: '支出',
        type: 'line',
        data: monthlyTrend.value.data.map(d => Math.abs(d.expense)),
        smooth: true,
        itemStyle: { color: '#ff4949' },
        areaStyle: {
          opacity: 0.2,
          color: '#ff4949'
        }
      },
      {
        name: '收入',
        type: 'line',
        data: monthlyTrend.value.data.map(d => d.income),
        smooth: true,
        itemStyle: { color: '#67c23a' },
        areaStyle: {
          opacity: 0.2,
          color: '#67c23a'
        }
      }
    ]
  };

  chart.setOption(option);
};

// 加载基础数据
const loadBasicData = async () => {
  loading.value = true;
  try {
    const [budgetRes, accountRes] = await Promise.all([
      budgetAPI.getStatus(),
      accountAPI.getAll()
    ]);
    budgetStatus.value = budgetRes.data;
    accounts.value = accountRes.data;
  } catch (error) {
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  initYears();
  await loadMonths();
  await loadMonthData();
  await loadYearTrend();
  await loadBasicData();
});

// 监听窗口大小，调整图表
window.addEventListener('resize', () => {
  if (pieChartRef.value) {
    echarts.getInstanceByDom(pieChartRef.value)?.resize();
  }
  if (lineChartRef.value) {
    echarts.getInstanceByDom(lineChartRef.value)?.resize();
  }
  if (trendChartRef.value) {
    echarts.getInstanceByDom(trendChartRef.value)?.resize();
  }
});

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

.period-selector {
  background: white;
  padding: 12px 20px;
  border-radius: 6px;
  display: flex;
  align-items: center;
}

.chart-row {
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  font-size: 36px;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255,255,255,0.3);
}

.stat-card.income {
  background: linear-gradient(135deg, #67c23a, #85ce61);
  color: white;
}

.stat-card.expense {
  background: linear-gradient(135deg, #ff4949, #ff7875);
  color: white;
}

.stat-card.balance {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.stat-card.count {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: white;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
}

.account-balance {
  font-size: 24px;
  font-weight: bold;
  color: #667eea;
  text-align: center;
  padding: 20px 0;
}
</style>

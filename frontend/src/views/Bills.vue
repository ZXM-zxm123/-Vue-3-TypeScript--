<template>
  <div class="bills-container">
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
          <div class="bills-content">
            <el-row :gutter="20" class="toolbar">
              <el-col :span="20">
                <el-button type="primary" @click="showAddDialog = true">添加账单</el-button>
                <el-button @click="showUploadDialog = true">CSV导入</el-button>
                <el-date-picker
                  v-model="dateRange"
                  type="daterange"
                  range-separator="至"
                  start-placeholder="开始日期"
                  end-placeholder="结束日期"
                  @change="loadBills"
                  style="margin-left: 10px;"
                />
                <el-select v-model="filterCategory" placeholder="选择类别" clearable @change="loadBills" style="margin-left: 10px; width: 150px;">
                  <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
                </el-select>
              </el-col>
              <el-col :span="4" style="text-align: right;">
                <el-button type="success" @click="handleExport">导出PDF</el-button>
              </el-col>
            </el-row>

            <el-table :data="bills" style="width: 100%; margin-top: 20px;" stripe>
              <el-table-column prop="date" label="日期" width="120" />
              <el-table-column prop="category" label="类别" width="100">
                <template #default="{ row }">
                  <el-tag size="small">{{ row.category }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="描述" />
              <el-table-column label="金额" width="120">
                <template #default="{ row }">
                  <span :style="{ color: row.amount < 0 ? '#ff4949' : '#67c23a' }">
                    {{ row.amount < 0 ? '-' : '+' }}¥{{ Math.abs(row.amount).toFixed(2) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="账户" width="120">
                <template #default="{ row }">
                  {{ getAccountName(row.account_id) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="100">
                <template #default="{ row }">
                  <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>

            <el-empty v-if="bills.length === 0" description="暂无账单" />
          </div>
        </el-main>
      </el-container>
    </el-container>

    <el-dialog v-model="showAddDialog" title="添加账单" width="500px">
      <el-form :model="billForm" label-width="100px">
        <el-form-item label="金额">
          <el-input-number v-model="billForm.amount" :precision="2" :step="100" />
          <el-radio-group v-model="billForm.type" style="margin-left: 10px;">
            <el-radio label="expense">支出</el-radio>
            <el-radio label="income">收入</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="billForm.description" placeholder="输入交易描述" />
        </el-form-item>
        <el-form-item label="类别">
          <el-select v-model="billForm.category" placeholder="选择类别">
            <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="billForm.date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="账户">
          <el-select v-model="billForm.accountId" placeholder="选择账户">
            <el-option v-for="acc in accounts" :key="acc.id" :label="acc.name" :value="acc.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddBill">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showUploadDialog" title="CSV导入" width="500px">
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :limit="1"
        accept=".csv"
        :on-change="handleFileChange"
      >
        <el-button>选择CSV文件</el-button>
        <template #tip>
          <div class="el-upload__tip">
            CSV格式：amount,description,date,accountId,category(可选)
          </div>
        </template>
      </el-upload>
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpload" :disabled="!uploadFile">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadFile } from 'element-plus';
import type { Bill, Account } from '../types';
import { billAPI, accountAPI, exportAPI } from '../utils/api';
import { HomeFilled, Money, Wallet, DataLine, Setting } from '@element-plus/icons-vue';

const router = useRouter();
const username = localStorage.getItem('username') || '用户';
const activeMenu = ref('/bills');

const bills = ref<Bill[]>([]);
const accounts = ref<Account[]>([]);
const dateRange = ref<[string, string] | null>(null);
const filterCategory = ref('');

const showAddDialog = ref(false);
const showUploadDialog = ref(false);
const uploadFile = ref<UploadFile | null>(null);

const categories = ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他', '工资', '投资', '其他收入'];

const billForm = reactive({
  amount: 0,
  type: 'expense' as 'expense' | 'income',
  description: '',
  category: '其他',
  date: new Date().toISOString().split('T')[0],
  accountId: 1
});

onMounted(async () => {
  await loadAccounts();
  await loadBills();
});

const loadBills = async () => {
  try {
    const params: any = {};
    if (dateRange.value) {
      params.startDate = dateRange.value[0];
      params.endDate = dateRange.value[1];
    }
    if (filterCategory.value) {
      params.category = filterCategory.value;
    }
    const { data } = await billAPI.getAll(params);
    bills.value = data;
  } catch (error) {
    ElMessage.error('加载账单失败');
  }
};

const loadAccounts = async () => {
  try {
    const { data } = await accountAPI.getAll();
    accounts.value = data;
    if (data.length > 0) {
      billForm.accountId = data[0].id;
    }
  } catch (error) {
    ElMessage.error('加载账户失败');
  }
};

const getAccountName = (accountId: number) => {
  const account = accounts.value.find(a => a.id === accountId);
  return account?.name || '未知账户';
};

const handleAddBill = async () => {
  try {
    const amount = billForm.type === 'expense' ? -Math.abs(billForm.amount) : Math.abs(billForm.amount);
    await billAPI.create({
      amount,
      description: billForm.description,
      category: billForm.category,
      date: billForm.date,
      accountId: billForm.accountId
    });
    ElMessage.success('添加成功');
    showAddDialog.value = false;
    await loadBills();
    await loadAccounts();
  } catch (error) {
    ElMessage.error('添加失败');
  }
};

const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定删除这条账单吗？', '提示', {
      type: 'warning'
    });
    await billAPI.delete(id);
    ElMessage.success('删除成功');
    await loadBills();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const handleFileChange = (file: UploadFile) => {
  uploadFile.value = file;
};

const handleUpload = async () => {
  if (!uploadFile.value) return;

  const formData = new FormData();
  formData.append('file', uploadFile.value.raw!);

  try {
    const { data } = await billAPI.upload(formData);
    ElMessage.success(`成功导入 ${data.uploaded} 条账单`);
    showUploadDialog.value = false;
    uploadFile.value = null;
    await loadBills();
    await loadAccounts();
  } catch (error) {
    ElMessage.error('导入失败');
  }
};

const handleExport = async () => {
  try {
    const { data } = await exportAPI.exportPDF();
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `账单报告-${new Date().toISOString().slice(0, 7)}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch (error) {
    ElMessage.error('导出失败');
  }
};

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  router.push('/login');
};
</script>

<style scoped>
.bills-container {
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

.bills-content {
  padding: 20px;
}

.toolbar {
  margin-bottom: 10px;
}
</style>

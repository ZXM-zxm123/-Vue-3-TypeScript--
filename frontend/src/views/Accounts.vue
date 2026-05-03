<template>
  <div class="accounts-container">
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
          <div class="accounts-content">
            <el-row :gutter="20" class="toolbar">
              <el-col :span="24">
                <el-button type="primary" @click="showAddDialog = true">添加账户</el-button>
              </el-col>
            </el-row>

            <el-row :gutter="20">
              <el-col :span="8" v-for="account in accounts" :key="account.id">
                <el-card class="account-card" shadow="hover">
                  <template #header>
                    <div class="account-header">
                      <span class="account-name">{{ account.name }}</span>
                      <el-tag :type="account.type === 'cash' ? 'success' : 'warning'" size="small">
                        {{ account.type === 'cash' ? '现金' : '信用卡' }}
                      </el-tag>
                    </div>
                  </template>
                  <div class="account-balance">
                    <span class="label">余额</span>
                    <span class="value" :class="{ negative: account.balance < 0 }">
                      ¥{{ account.balance.toFixed(2) }}
                    </span>
                  </div>
                  <div class="account-actions">
                    <el-button size="small" @click="showEditDialog(account)">编辑</el-button>
                    <el-button size="small" type="danger" @click="handleDelete(account.id)">删除</el-button>
                  </div>
                </el-card>
              </el-col>
            </el-row>

            <el-empty v-if="accounts.length === 0" description="暂无账户，点击上方按钮添加" />

            <el-divider />

            <el-row :gutter="20">
              <el-col :span="24">
                <h3>账户类型说明</h3>
                <el-descriptions :column="2" border>
                  <el-descriptions-item label="现金账户">
                    <el-tag type="success">现金</el-tag>
                    用于管理现金收支，适合日常现金消费
                  </el-descriptions-item>
                  <el-descriptions-item label="信用卡">
                    <el-tag type="warning">信用卡</el-tag>
                    用于管理信用卡消费，需注意还款日期
                  </el-descriptions-item>
                </el-descriptions>
              </el-col>
            </el-row>

            <el-row :gutter="20" style="margin-top: 30px;">
              <el-col :span="24">
                <h3>CSV导入模板</h3>
                <el-alert
                  title="CSV文件格式说明"
                  description="上传CSV文件时，请确保包含以下列：amount（金额），description（描述），date（日期），accountId（账户ID），category（类别，可选）"
                  type="info"
                  show-icon
                  :closable="false"
                />
                <div style="margin-top: 15px;">
                  <el-button @click="downloadTemplate">下载CSV模板</el-button>
                </div>
              </el-col>
            </el-row>
          </div>
        </el-main>
      </el-container>
    </el-container>

    <el-dialog v-model="showAddDialog" :title="isEdit ? '编辑账户' : '添加账户'" width="500px">
      <el-form :model="accountForm" label-width="100px">
        <el-form-item label="账户名称">
          <el-input v-model="accountForm.name" placeholder="输入账户名称" />
        </el-form-item>
        <el-form-item label="账户类型">
          <el-select v-model="accountForm.type" placeholder="选择类型">
            <el-option label="现金" value="cash" />
            <el-option label="信用卡" value="credit_card" />
          </el-select>
        </el-form-item>
        <el-form-item label="初始余额">
          <el-input-number v-model="accountForm.balance" :precision="2" :step="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false; isEdit = false">取消</el-button>
        <el-button type="primary" @click="handleSave">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { Account } from '../types';
import { accountAPI } from '../utils/api';
import { HomeFilled, Money, Wallet, DataLine, Setting } from '@element-plus/icons-vue';

const router = useRouter();
const username = localStorage.getItem('username') || '用户';
const activeMenu = ref('/accounts');

const accounts = ref<Account[]>([]);
const showAddDialog = ref(false);
const isEdit = ref(false);
const editingId = ref<number | null>(null);

const accountForm = reactive({
  name: '',
  type: 'cash' as 'cash' | 'credit_card',
  balance: 0
});

onMounted(async () => {
  await loadAccounts();
});

const loadAccounts = async () => {
  try {
    const { data } = await accountAPI.getAll();
    accounts.value = data;
  } catch (error) {
    ElMessage.error('加载账户失败');
  }
};

const showEditDialog = (account: Account) => {
  isEdit.value = true;
  editingId.value = account.id;
  accountForm.name = account.name;
  accountForm.type = account.type;
  accountForm.balance = account.balance;
  showAddDialog.value = true;
};

const handleSave = async () => {
  if (!accountForm.name) {
    ElMessage.warning('请输入账户名称');
    return;
  }

  try {
    if (isEdit.value && editingId.value) {
      await accountAPI.update(editingId.value, {
        name: accountForm.name,
        type: accountForm.type,
        balance: accountForm.balance
      });
      ElMessage.success('更新成功');
    } else {
      await accountAPI.create({
        name: accountForm.name,
        type: accountForm.type,
        balance: accountForm.balance
      });
      ElMessage.success('添加成功');
    }
    showAddDialog.value = false;
    isEdit.value = false;
    editingId.value = null;
    accountForm.name = '';
    accountForm.type = 'cash';
    accountForm.balance = 0;
    await loadAccounts();
  } catch (error) {
    ElMessage.error('操作失败');
  }
};

const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定删除这个账户吗？', '提示', {
      type: 'warning'
    });
    await accountAPI.delete(id);
    ElMessage.success('删除成功');
    await loadAccounts();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const downloadTemplate = () => {
  const template = 'amount,description,date,accountId,category\n-50.00,麦当劳,2024-01-15,1,餐饮\n-30.00,地铁,2024-01-16,1,交通';
  const blob = new Blob([template], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '账单导入模板.csv';
  link.click();
  window.URL.revokeObjectURL(url);
};

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  router.push('/login');
};
</script>

<style scoped>
.accounts-container {
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

.accounts-content {
  padding: 20px;
}

.toolbar {
  margin-bottom: 20px;
}

.account-card {
  margin-bottom: 20px;
}

.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.account-name {
  font-weight: bold;
  font-size: 16px;
}

.account-balance {
  text-align: center;
  padding: 30px 0;
}

.account-balance .label {
  display: block;
  font-size: 14px;
  color: #909399;
  margin-bottom: 10px;
}

.account-balance .value {
  font-size: 32px;
  font-weight: bold;
  color: #667eea;
}

.account-balance .value.negative {
  color: #ff4949;
}

.account-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding-top: 15px;
  border-top: 1px solid #f0f0f0;
}

h3 {
  margin-bottom: 15px;
  color: white;
}
</style>

<template>
  <div class="rules-container">
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
          <div class="rules-content">
            <el-row :gutter="20">
              <el-col :span="24">
                <el-alert
                  title="自定义分类规则"
                  description="添加关键词规则，当账单描述中包含关键词时，将自动分类到对应类别"
                  type="info"
                  show-icon
                  :closable="false"
                  style="margin-bottom: 20px;"
                />
              </el-col>
            </el-row>

            <el-row :gutter="20" class="toolbar">
              <el-col :span="24">
                <el-button type="primary" @click="showAddDialog = true">添加规则</el-button>
              </el-col>
            </el-row>

            <el-table :data="rules" style="width: 100%;" stripe>
              <el-table-column prop="keyword" label="关键词" width="200" />
              <el-table-column prop="category" label="对应类别" width="150">
                <template #default="{ row }">
                  <el-tag size="small">{{ row.category }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>

            <el-empty v-if="rules.length === 0" description="暂无规则，点击上方按钮添加" />

            <el-divider />

            <el-row :gutter="20">
              <el-col :span="24">
                <h3>系统预设类别</h3>
                <el-tag
                  v-for="cat in systemCategories"
                  :key="cat"
                  :type="randomType()"
                  style="margin: 5px;"
                >
                  {{ cat }}
                </el-tag>
              </el-col>
            </el-row>

            <el-row :gutter="20" style="margin-top: 30px;">
              <el-col :span="24">
                <h3>常见关键词示例</h3>
                <el-descriptions :column="2" border>
                  <el-descriptions-item label="餐饮">麦当劳、肯德基、星巴克、奶茶、火锅、外卖</el-descriptions-item>
                  <el-descriptions-item label="交通">地铁、公交、滴滴、加油、停车、火车票</el-descriptions-item>
                  <el-descriptions-item label="购物">淘宝、京东、天猫、超市、便利店</el-descriptions-item>
                  <el-descriptions-item label="娱乐">电影、KTV、健身、游泳、旅游、酒店</el-descriptions-item>
                </el-descriptions>
              </el-col>
            </el-row>
          </div>
        </el-main>
      </el-container>
    </el-container>

    <el-dialog v-model="showAddDialog" title="添加规则" width="500px">
      <el-form :model="ruleForm" label-width="100px">
        <el-form-item label="关键词">
          <el-input v-model="ruleForm.keyword" placeholder="输入关键词（如：麦当劳）" />
        </el-form-item>
        <el-form-item label="对应类别">
          <el-select v-model="ruleForm.category" placeholder="选择类别">
            <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-alert
            title="提示：当账单描述中包含该关键词时，将自动分类到对应类别"
            type="info"
            :closable="false"
            show-icon
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddRule">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { Rule } from '../types';
import { ruleAPI } from '../utils/api';
import { HomeFilled, Money, Wallet, DataLine, Setting } from '@element-plus/icons-vue';

const router = useRouter();
const username = localStorage.getItem('username') || '用户';
const activeMenu = ref('/rules');

const rules = ref<Rule[]>([]);
const showAddDialog = ref(false);

const categories = ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他'];
const systemCategories = ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他'];

const ruleForm = reactive({
  keyword: '',
  category: ''
});

const typeOptions = ['success', 'warning', 'info', 'danger'];
const randomType = () => typeOptions[Math.floor(Math.random() * typeOptions.length)];

onMounted(async () => {
  await loadRules();
});

const loadRules = async () => {
  try {
    const { data } = await ruleAPI.getAll();
    rules.value = data;
  } catch (error) {
    ElMessage.error('加载规则失败');
  }
};

const handleAddRule = async () => {
  if (!ruleForm.keyword || !ruleForm.category) {
    ElMessage.warning('请填写完整的规则信息');
    return;
  }

  try {
    await ruleAPI.create({
      keyword: ruleForm.keyword,
      category: ruleForm.category
    });
    ElMessage.success('规则添加成功');
    showAddDialog.value = false;
    ruleForm.keyword = '';
    ruleForm.category = '';
    await loadRules();
  } catch (error) {
    ElMessage.error('添加失败');
  }
};

const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定删除这条规则吗？', '提示', {
      type: 'warning'
    });
    await ruleAPI.delete(id);
    ElMessage.success('删除成功');
    await loadRules();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  router.push('/login');
};
</script>

<style scoped>
.rules-container {
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

.rules-content {
  padding: 20px;
}

.toolbar {
  margin-bottom: 20px;
}

h3 {
  margin-bottom: 15px;
  color: white;
}
</style>

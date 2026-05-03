export interface User {
  id: number;
  username: string;
}

export interface Account {
  id: number;
  user_id: number;
  name: string;
  type: 'cash' | 'credit_card';
  balance: number;
}

export interface Bill {
  id: number;
  user_id: number;
  account_id: number;
  amount: number;
  description: string;
  category: string;
  date: string;
}

export interface Budget {
  id: number;
  user_id: number;
  category: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
}

export interface BudgetStatus {
  category: string;
  budget: number;
  spent: number;
  remaining: number;
  exceeded: boolean;
}

export interface Rule {
  id: number;
  user_id: number;
  keyword: string;
  category: string;
}

export interface CategoryData {
  category: string;
  total: number;
  count: number;
}

export interface DailyData {
  date: string;
  total: number;
}

export interface DashboardData {
  categoryData: CategoryData[];
  dailyData: DailyData[];
  accounts: Account[];
  budgetStatus: BudgetStatus[];
  currentMonth: string;
}

// ===== 新增的统计类型 =====

export interface CategorySummaryItem {
  category: string;
  expense: number;
  income: number;
  count: number;
}

export interface CategorySummaryResponse {
  month: string;
  data: CategorySummaryItem[];
}

export interface DailySummaryItem {
  date: string;
  expense: number;
  income: number;
  count: number;
}

export interface DailySummaryResponse {
  month: string;
  data: DailySummaryItem[];
}

export interface MonthlyTrendItem {
  month: string;
  expense: number;
  income: number;
}

export interface MonthlyTrendResponse {
  year: number;
  data: MonthlyTrendItem[];
}

// ===== 分页类型 =====

export interface PaginatedBillsResponse {
  bills: Bill[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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
  currentMonth: string;
}

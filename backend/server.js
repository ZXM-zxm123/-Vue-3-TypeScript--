import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initEncryption, isEncryptionReady, encrypt, decrypt, encryptObject, decryptObject } from './utils/crypto.js';

// 加载环境变量
try {
  const { config } = await import('dotenv');
  config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') });
} catch (e) {
  // dotenv optional
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'bill-manager-secret-key-2024';
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

app.use(cors());
app.use(express.json());

if (!ENCRYPTION_KEY) {
  console.warn('WARNING: ENCRYPTION_KEY not set. Using default key for development only!');
  console.warn('Set ENCRYPTION_KEY environment variable for production!');
  initEncryption('development-default-key-please-change-in-production');
} else {
  initEncryption(ENCRYPTION_KEY);
  console.log('Encryption initialized successfully');
}

const db = new Database(path.join(__dirname, 'bills.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    encryption_key_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    period TEXT DEFAULT 'monthly',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);
  CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date);
  CREATE INDEX IF NOT EXISTS idx_bills_category ON bills(category);
  CREATE INDEX IF NOT EXISTS idx_bills_user_date ON bills(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_bills_user_category ON bills(user_id, category);
  CREATE INDEX IF NOT EXISTS idx_bills_user_date_category ON bills(user_id, date, category);
  CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
  CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
  CREATE INDEX IF NOT EXISTS idx_rules_user ON rules(user_id);
`);

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const storage = multer.memoryStorage();
const upload = multer({ storage });

const fetchPythonClassify = async (description) => {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    });
    if (response.ok) {
      const data = await response.json();
      return data.category;
    }
  } catch (err) {
    console.error('Python service error:', err);
  }
  return '其他';
};

const SENSITIVE_BILL_FIELDS = ['description', 'category'];
const SENSITIVE_ACCOUNT_FIELDS = ['name'];
const SENSITIVE_RULE_FIELDS = ['keyword', 'category'];

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    const result = stmt.run(username, hashedPassword);

    const userStmt = db.prepare('INSERT INTO accounts (user_id, name, type, balance) VALUES (?, ?, ?, ?)');
    userStmt.run(result.lastInsertRowid, encrypt('现金账户'), 'cash', 0);
    userStmt.run(result.lastInsertRowid, encrypt('信用卡'), 'credit_card', 0);

    res.json({ id: result.lastInsertRowid, username });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const user = stmt.get(username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, userId: user.id, username: user.username });
});

app.get('/api/accounts', authMiddleware, (req, res) => {
  const stmt = db.prepare('SELECT * FROM accounts WHERE user_id = ?');
  const accounts = stmt.all(req.userId);

  const decryptedAccounts = accounts.map(account => {
    if (account.name && account.name.includes(':')) {
      try {
        account.name = decrypt(account.name);
      } catch (e) {
        // Already decrypted or not encrypted
      }
    }
    return account;
  });

  res.json(decryptedAccounts);
});

app.post('/api/accounts', authMiddleware, (req, res) => {
  const { name, type, balance } = req.body;
  const encryptedName = encrypt(name);
  const stmt = db.prepare('INSERT INTO accounts (user_id, name, type, balance) VALUES (?, ?, ?, ?)');
  const result = stmt.run(req.userId, encryptedName, type, balance || 0);
  res.json({ id: result.lastInsertRowid, name, type, balance: balance || 0 });
});

app.put('/api/accounts/:id', authMiddleware, (req, res) => {
  const { name, type, balance } = req.body;
  const encryptedName = encrypt(name);
  const stmt = db.prepare('UPDATE accounts SET name = ?, type = ?, balance = ? WHERE id = ? AND user_id = ?');
  stmt.run(encryptedName, type, balance, req.params.id, req.userId);
  res.json({ id: parseInt(req.params.id), name, type, balance });
});

app.delete('/api/accounts/:id', authMiddleware, (req, res) => {
  const stmt = db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?');
  stmt.run(req.params.id, req.userId);
  res.json({ success: true });
});

app.get('/api/bills', authMiddleware, (req, res) => {
  const { startDate, endDate, category, accountId, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = 'SELECT * FROM bills WHERE user_id = ?';
  const params = [req.userId];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (accountId) {
    query += ' AND account_id = ?';
    params.push(accountId);
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countStmt = db.prepare(countQuery);
  const { total } = countStmt.get(...params);

  query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const stmt = db.prepare(query);
  const bills = stmt.all(...params);

  const decryptedBills = bills.map(bill => {
    return decryptObject(bill, SENSITIVE_BILL_FIELDS);
  });

  res.json({
    bills: decryptedBills,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  });
});

app.post('/api/bills', authMiddleware, async (req, res) => {
  const { amount, description, category, date, accountId } = req.body;

  let finalCategory = category;
  if (!finalCategory || finalCategory === '待分类') {
    const ruleStmt = db.prepare('SELECT category FROM rules WHERE user_id = ? AND ? LIKE "%" || keyword || "%"');
    const rule = ruleStmt.get(req.userId, description);
    if (rule) {
      finalCategory = decrypt(rule.category);
    } else {
      finalCategory = await fetchPythonClassify(description);
    }
  }

  const encryptedDescription = encrypt(description);
  const encryptedCategory = encrypt(finalCategory);

  const stmt = db.prepare('INSERT INTO bills (user_id, account_id, amount, description, category, date) VALUES (?, ?, ?, ?, ?, ?)');
  const result = stmt.run(req.userId, accountId, amount, encryptedDescription, encryptedCategory, date);

  const accountStmt = db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?');
  accountStmt.run(amount, accountId);

  res.json({ id: result.lastInsertRowid, amount, description, category: finalCategory, date, accountId });
});

app.post('/api/bills/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const text = req.file.buffer.toString('utf-8');
  let records;

  try {
    records = parse(text, { columns: true, skip_empty_lines: true });
  } catch (err) {
    return res.status(400).json({ error: 'Invalid CSV format' });
  }

  const insertStmt = db.prepare('INSERT INTO bills (user_id, account_id, amount, description, category, date) VALUES (?, ?, ?, ?, ?, ?)');
  const accountStmt = db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?');

  const results = [];
  for (const record of records) {
    const amount = parseFloat(record.amount) || 0;
    const description = record.description || record.desc || record.memo || '';
    const date = record.date || record.time || new Date().toISOString().split('T')[0];
    const accountId = parseInt(record.accountId) || 1;

    let category = record.category || '待分类';
    if (category === '待分类') {
      const ruleStmt = db.prepare('SELECT category FROM rules WHERE user_id = ? AND ? LIKE "%" || keyword || "%"');
      const rule = ruleStmt.get(req.userId, description);
      if (rule) {
        category = decrypt(rule.category);
      } else {
        category = await fetchPythonClassify(description);
      }
    }

    const encryptedDescription = encrypt(description);
    const encryptedCategory = encrypt(category);

    const result = insertStmt.run(req.userId, accountId, amount, encryptedDescription, encryptedCategory, date);
    accountStmt.run(amount, accountId);
    results.push({ id: result.lastInsertRowid, amount, description, category, date, accountId });
  }

  res.json({ uploaded: results.length, bills: results });
});

app.delete('/api/bills/:id', authMiddleware, (req, res) => {
  const stmt = db.prepare('DELETE FROM bills WHERE id = ? AND user_id = ?');
  stmt.run(req.params.id, req.userId);
  res.json({ success: true });
});

app.get('/api/stats/months', authMiddleware, (req, res) => {
  const stmt = db.prepare(`
    SELECT DISTINCT SUBSTR(date, 1, 7) as month
    FROM bills
    WHERE user_id = ?
    ORDER BY month DESC
    LIMIT 24
  `);
  const months = stmt.all(req.userId);
  res.json(months.map(m => m.month));
});

app.get('/api/stats/category-summary', authMiddleware, (req, res) => {
  const { month } = req.query;
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const startDate = targetMonth + '-01';
  const endDate = targetMonth + '-31';

  const stmt = db.prepare(`
    SELECT 
      category,
      SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense,
      SUM(CASE WHEN amount >= 0 THEN amount ELSE 0 END) as income,
      COUNT(*) as count
    FROM bills
    WHERE user_id = ? AND date >= ? AND date <= ?
    GROUP BY category
    ORDER BY expense ASC
  `);

  const summary = stmt.all(req.userId, startDate, endDate);

  const decryptedSummary = summary.map(item => ({
    ...item,
    category: decrypt(item.category)
  }));

  res.json({ month: targetMonth, data: decryptedSummary });
});

app.get('/api/stats/daily-summary', authMiddleware, (req, res) => {
  const { month } = req.query;
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const startDate = targetMonth + '-01';
  const endDate = targetMonth + '-31';

  const stmt = db.prepare(`
    SELECT 
      date,
      SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense,
      SUM(CASE WHEN amount >= 0 THEN amount ELSE 0 END) as income,
      COUNT(*) as count
    FROM bills
    WHERE user_id = ? AND date >= ? AND date <= ?
    GROUP BY date
    ORDER BY date
  `);

  const daily = stmt.all(req.userId, startDate, endDate);
  res.json({ month: targetMonth, data: daily });
});

app.get('/api/stats/monthly-trend', authMiddleware, (req, res) => {
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();

  const stmt = db.prepare(`
    SELECT 
      SUBSTR(date, 1, 7) as month,
      SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense,
      SUM(CASE WHEN amount >= 0 THEN amount ELSE 0 END) as income
    FROM bills
    WHERE user_id = ? AND SUBSTR(date, 1, 4) = ?
    GROUP BY SUBSTR(date, 1, 7)
    ORDER BY month
  `);

  const trend = stmt.all(req.userId, targetYear.toString());
  res.json({ year: targetYear, data: trend });
});

app.get('/api/dashboard', authMiddleware, (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const startDate = currentMonth + '-01';
  const endDate = currentMonth + '-31';

  const categoryStmt = db.prepare(`
    SELECT
      category,
      SUM(amount) as total,
      COUNT(*) as count
    FROM bills
    WHERE user_id = ? AND date >= ? AND date <= ?
    GROUP BY category
  `);
  const categoryData = categoryStmt.all(req.userId, startDate, endDate);

  const decryptedCategoryData = categoryData.map(item => ({
    ...item,
    category: decrypt(item.category)
  }));

  const dailyStmt = db.prepare(`
    SELECT date, SUM(amount) as total
    FROM bills
    WHERE user_id = ? AND date >= ? AND date <= ?
    GROUP BY date
    ORDER BY date
  `);
  const dailyData = dailyStmt.all(req.userId, startDate, endDate);

  const accountStmt = db.prepare('SELECT name, type, balance FROM accounts WHERE user_id = ?');
  const accounts = accountStmt.all(req.userId);

  const decryptedAccounts = accounts.map(account => {
    if (account.name && account.name.includes(':')) {
      try {
        account.name = decrypt(account.name);
      } catch (e) {
        // Already decrypted or not encrypted
      }
    }
    return account;
  });

  const budgetStmt = db.prepare('SELECT * FROM budgets WHERE user_id = ?');
  const budgets = budgetStmt.all(req.userId);

  const spentStmt = db.prepare(`
    SELECT category, SUM(amount) as spent
    FROM bills
    WHERE user_id = ? AND date >= ? AND date <= ? AND amount < 0
    GROUP BY category
  `);
  const spentList = spentStmt.all(req.userId, startDate, endDate);

  const spentMap = {};
  spentList.forEach(s => {
    const decryptedCategory = decrypt(s.category);
    spentMap[decryptedCategory] = Math.abs(s.spent);
  });

  const budgetStatus = budgets.map(b => ({
    category: b.category,
    budget: b.amount,
    spent: spentMap[b.category] || 0,
    remaining: b.amount - (spentMap[b.category] || 0),
    exceeded: (spentMap[b.category] || 0) > b.amount
  }));

  res.json({
    categoryData: decryptedCategoryData,
    dailyData,
    accounts: decryptedAccounts,
    budgetStatus,
    currentMonth
  });
});

app.get('/api/budgets', authMiddleware, (req, res) => {
  const stmt = db.prepare('SELECT * FROM budgets WHERE user_id = ?');
  const budgets = stmt.all(req.userId);
  res.json(budgets);
});

app.post('/api/budgets', authMiddleware, (req, res) => {
  const { category, amount, period } = req.body;
  const encryptedCategory = encrypt(category);
  const stmt = db.prepare('INSERT INTO budgets (user_id, category, amount, period) VALUES (?, ?, ?, ?)');
  const result = stmt.run(req.userId, encryptedCategory, amount, period || 'monthly');
  res.json({ id: result.lastInsertRowid, category, amount, period: period || 'monthly' });
});

app.get('/api/budgets/status', authMiddleware, (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const startDate = currentMonth + '-01';
  const endDate = currentMonth + '-31';

  const budgetStmt = db.prepare('SELECT * FROM budgets WHERE user_id = ?');
  const budgets = budgetStmt.all(req.userId);

  const billStmt = db.prepare(`
    SELECT category, SUM(amount) as spent
    FROM bills
    WHERE user_id = ? AND date >= ? AND date <= ? AND amount < 0
    GROUP BY category
  `);
  const spent = billStmt.all(req.userId, startDate, endDate);
  const spentMap = {};
  spent.forEach(s => {
    const decryptedCategory = decrypt(s.category);
    spentMap[decryptedCategory] = Math.abs(s.spent);
  });

  const status = budgets.map(b => ({
    category: b.category,
    budget: b.amount,
    spent: spentMap[b.category] || 0,
    remaining: b.amount - (spentMap[b.category] || 0),
    exceeded: (spentMap[b.category] || 0) > b.amount
  }));

  res.json(status);
});

app.get('/api/rules', authMiddleware, (req, res) => {
  const stmt = db.prepare('SELECT * FROM rules WHERE user_id = ?');
  const rules = stmt.all(req.userId);

  const decryptedRules = rules.map(rule => {
    return decryptObject(rule, SENSITIVE_RULE_FIELDS);
  });

  res.json(decryptedRules);
});

app.post('/api/rules', authMiddleware, (req, res) => {
  const { keyword, category } = req.body;
  const encryptedKeyword = encrypt(keyword);
  const encryptedCategory = encrypt(category);
  const stmt = db.prepare('INSERT INTO rules (user_id, keyword, category) VALUES (?, ?, ?, ?)');
  const result = stmt.run(req.userId, encryptedKeyword, encryptedCategory);
  res.json({ id: result.lastInsertRowid, keyword, category });
});

app.delete('/api/rules/:id', authMiddleware, (req, res) => {
  const stmt = db.prepare('DELETE FROM rules WHERE id = ? AND user_id = ?');
  stmt.run(req.params.id, req.userId);
  res.json({ success: true });
});

app.get('/api/export/pdf', authMiddleware, async (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const startDate = currentMonth + '-01';
  const endDate = currentMonth + '-31';

  const billStmt = db.prepare(`
    SELECT b.*, a.name as account_name
    FROM bills b
    JOIN accounts a ON b.account_id = a.id
    WHERE b.user_id = ? AND b.date >= ? AND b.date <= ?
    ORDER BY b.date DESC
  `);
  const bills = billStmt.all(req.userId, startDate, endDate);

  const decryptedBills = bills.map(bill => {
    const decrypted = decryptObject(bill, SENSITIVE_BILL_FIELDS);
    if (decrypted.account_name) {
      try {
        decrypted.account_name = decrypt(decrypted.account_name);
      } catch (e) {
        // Already decrypted or not encrypted
      }
    }
    return decrypted;
  });

  const budgetStmt = db.prepare('SELECT * FROM budgets WHERE user_id = ?');
  const budgets = budgetStmt.all(req.userId);

  const billSpentStmt = db.prepare(`
    SELECT category, SUM(ABS(amount)) as spent
    FROM bills
    WHERE user_id = ? AND date >= ? AND date <= ? AND amount < 0
    GROUP BY category
  `);
  const spent = billSpentStmt.all(req.userId, startDate, endDate);

  const pdfContent = generatePDFContent(decryptedBills, budgets, spent, currentMonth);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=bill-report-${currentMonth}.pdf`);
  res.send(pdfContent);
});

function generatePDFContent(bills, budgets, spent, month) {
  let content = `账单报告 - ${month}\n`;
  content += '='.repeat(50) + '\n\n';

  const spentMap = {};
  spent.forEach(s => spentMap[s.category] = s.spent);

  content += '预算状态:\n';
  content += '-'.repeat(30) + '\n';
  budgets.forEach(b => {
    const s = spentMap[b.category] || 0;
    const status = s > b.amount ? '超限!' : '正常';
    content += `${b.category}: 已花费 ${s.toFixed(2)} / ${b.amount.toFixed(2)} [${status}]\n`;
  });

  content += '\n\n账单明细:\n';
  content += '-'.repeat(30) + '\n';
  bills.forEach(b => {
    content += `${b.date} | ${b.category} | ${b.amount.toFixed(2)} | ${b.description}\n`;
  });

  return content;
}

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

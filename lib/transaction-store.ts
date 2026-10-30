import fs from 'fs';
import path from 'path';

export interface TransactionModel {
  id: string;
  prospek_id: string;
  klien: string;
  paket: 'Paket Esensial' | 'Paket Bisnis Juara' | 'Paket VIP Sultan' | string;
  total_nilai: number;
  dp_masuk: number;
  sisa_piutang: number;
  status_pembayaran: 'DP 50%' | 'Lunas';
  tanggal: string;
  catatan?: string;
}

export interface ExpenseModel {
  id: string;
  judul: string;
  kategori: 'Domain & Server' | 'WhatsApp Gateway' | 'Operasional' | 'Alat Kerja';
  nominal: number;
  tanggal: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions_v4.json');
const EXPENSES_FILE = path.join(DATA_DIR, 'expenses_v4.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getTransactions(): TransactionModel[] {
  ensureDataDir();
  if (!fs.existsSync(TRANSACTIONS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(TRANSACTIONS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTransactions(txs: TransactionModel[]): void {
  ensureDataDir();
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(txs, null, 2), 'utf-8');
}

export function addTransaction(tx: Omit<TransactionModel, 'id' | 'tanggal'> & { tanggal?: string }): TransactionModel {
  const current = getTransactions();
  const newTx: TransactionModel = {
    ...tx,
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tanggal: tx.tanggal || new Date().toISOString(),
  };
  current.unshift(newTx);
  saveTransactions(current);
  return newTx;
}

export function getExpenses(): ExpenseModel[] {
  ensureDataDir();
  if (!fs.existsSync(EXPENSES_FILE)) {
    const defaultExpenses: ExpenseModel[] = [
      {
        id: 'exp-1',
        judul: 'Langganan Fonnte WhatsApp Gateway',
        kategori: 'WhatsApp Gateway',
        nominal: 85000,
        tanggal: new Date().toISOString(),
      },
      {
        id: 'exp-2',
        judul: 'Domain .my.id & Server Cloudflare',
        kategori: 'Domain & Server',
        nominal: 55000,
        tanggal: new Date().toISOString(),
      },
    ];
    saveExpenses(defaultExpenses);
    return defaultExpenses;
  }
  try {
    const raw = fs.readFileSync(EXPENSES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveExpenses(exps: ExpenseModel[]): void {
  ensureDataDir();
  fs.writeFileSync(EXPENSES_FILE, JSON.stringify(exps, null, 2), 'utf-8');
}

export function addExpense(exp: Omit<ExpenseModel, 'id' | 'tanggal'> & { tanggal?: string }): ExpenseModel {
  const current = getExpenses();
  const newExp: ExpenseModel = {
    ...exp,
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tanggal: exp.tanggal || new Date().toISOString(),
  };
  current.unshift(newExp);
  saveExpenses(current);
  return newExp;
}


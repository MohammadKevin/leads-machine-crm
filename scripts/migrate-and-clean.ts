import fs from 'fs';
import path from 'path';
import { normalizeAndDedupLeads, saveLeads, saveSettings, DEFAULT_SETTINGS } from '../lib/leads-store';

function runMigration() {
  const backupFile = path.join(process.cwd(), 'backups', 'leads_backup_2026-10-30.json');
  if (!fs.existsSync(backupFile)) {
    console.error('Backup file not found:', backupFile);
    process.exit(1);
  }

  console.log('Loading raw backup data...');
  const rawData = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));

  console.log(`Running normalization, dedup & cleansing on ${rawData.length} records...`);
  const { leads, stats } = normalizeAndDedupLeads(rawData);

  saveLeads(leads);
  saveSettings(DEFAULT_SETTINGS);

  console.log('\n=============================================');
  console.log('LAPORAN MIGRASI & PEMBERSIHAN DATA (FASE 2)');
  console.log('=============================================');
  console.log(`Total data mentah sebelum migrasi : ${stats.total}`);
  console.log(`Total prospek unik ternormalisasi : ${stats.unique}`);
  console.log(`Duplikat nomor digabungkan        : ${stats.merged}`);
  console.log(`Nama bisnis kotor dibersihkan     : ${stats.cleanedNames}`);
  console.log('=============================================\n');

  // Sample cleaned leads
  console.log('Contoh sampel data bersih:');
  leads.slice(0, 5).forEach((l, i) => {
    console.log(`${i + 1}. [${l.status}] ${l.nama_bisnis} (${l.kota}) - WA: ${l.nomor_wa}`);
  });
}

runMigration();


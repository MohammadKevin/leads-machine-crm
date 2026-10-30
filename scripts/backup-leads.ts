import fs from 'fs';
import path from 'path';

async function backupLeads() {
  const sheetUrl =
    process.env.GOOGLE_SHEETS_WEBAPP_URL ||
    'https://script.google.com/macros/s/AKfycbygBBXTpKSSF6SFzG740NK5BrA9_4YDmGvSGZcj5PvYAxb25OPuS7jWLdWEnukzzUCYWw/exec';

  console.log('Fetching leads from Sheets for backup...');
  const res = await fetch(sheetUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch from sheets: HTTP ${res.status}`);
  }

  const raw = await res.text();
  const json = JSON.parse(raw);

  if (!json || !Array.isArray(json.data)) {
    throw new Error('Invalid data format from Sheets');
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const backupDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const jsonPath = path.join(backupDir, `leads_backup_${dateStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(json.data, null, 2), 'utf-8');
  console.log(`JSON backup saved (${json.data.length} records): ${jsonPath}`);

  // Convert to CSV
  if (json.data.length > 0) {
    const keys = Object.keys(json.data[0]);
    const csvRows = [
      keys.join(','),
      ...json.data.map((row: Record<string, any>) =>
        keys
          .map((k) => `"${String(row[k] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const csvPath = path.join(backupDir, `leads_backup_${dateStr}.csv`);
    fs.writeFileSync(csvPath, '\uFEFF' + csvRows.join('\n'), 'utf-8');
    console.log(`CSV backup saved: ${csvPath}`);
  }
}

backupLeads().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});

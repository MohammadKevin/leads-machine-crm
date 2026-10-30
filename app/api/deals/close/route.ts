import { NextRequest, NextResponse } from 'next/server';
import { addTransaction, getTransactions } from '@/lib/transaction-store';
import { getLeads, saveLeads } from '@/lib/leads-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const txs = getTransactions();
    return NextResponse.json({ success: true, transactions: txs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil transaksi';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      prospek_id,
      klien,
      paket = 'Paket Bisnis Juara',
      total_nilai = 3500000,
      status_pembayaran = 'DP 50%',
      catatan,
    } = body;

    if (!klien) {
      return NextResponse.json({ success: false, error: 'Nama klien wajib diisi.' }, { status: 400 });
    }

    const total = Number(total_nilai) || 3500000;
    const dp = status_pembayaran === 'Lunas' ? total : Math.round(total / 2);
    const sisa = status_pembayaran === 'Lunas' ? 0 : total - dp;

    const tx = addTransaction({
      prospek_id: prospek_id || `lead-${Date.now()}`,
      klien,
      paket,
      total_nilai: total,
      dp_masuk: dp,
      sisa_piutang: sisa,
      status_pembayaran: status_pembayaran as 'DP 50%' | 'Lunas',
      catatan,
    });

    // Update lead status in leads store if exists
    if (prospek_id) {
      const leads = getLeads();
      const idx = leads.findIndex((l) => l.id === prospek_id);
      if (idx !== -1) {
        leads[idx].status = 'Closing';
        leads[idx].estimasi_nilai = total;
        leads[idx].diubah_at = new Date().toISOString();
        saveLeads(leads);
      }
    }

    return NextResponse.json({ success: true, transaction: tx });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mencatat closing deal.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getExpenses, addExpense } from '@/lib/transaction-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const expenses = getExpenses();
    return NextResponse.json({ success: true, expenses });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil pengeluaran';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { judul, kategori = 'Operasional', nominal } = body;

    if (!judul || !nominal) {
      return NextResponse.json({ success: false, error: 'Judul dan nominal wajib diisi.' }, { status: 400 });
    }

    const exp = addExpense({
      judul,
      kategori,
      nominal: Number(nominal),
    });

    return NextResponse.json({ success: true, expense: exp });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mencatat pengeluaran.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getPrototypeBySlug, savePrototype, deletePrototypeBySlug } from '@/lib/prototype-storage';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const item = await getPrototypeBySlug(slug);

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Prototype tidak ditemukan.' },
        { status: 404 }
      );
    }

    item.viewCount = (item.viewCount || 0) + 1;
    await savePrototype(item);

    return NextResponse.json({ success: true, prototype: item });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error server.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const item = await getPrototypeBySlug(slug);

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Prototype tidak ditemukan.' },
        { status: 404 }
      );
    }

    await deletePrototypeBySlug(slug);
    return NextResponse.json({ success: true, message: 'Prototype berhasil dihapus.' });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error server.' },
      { status: 500 }
    );
  }
}

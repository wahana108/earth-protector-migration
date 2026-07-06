import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.RECALC_SECRET;
  if (!secret || req.headers.get('x-recalc-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Tulis flag ke recalculate_requests/flag.
    // Firestore rules mengizinkan write dengan docId='flag' dan hanya field requested_at.
    // maybeAutoRecalculate() di client akan membaca flag ini dan menjalankan recalculate
    // saat user berikutnya membuka /top-developers (by design — lazy evaluation).
    await setDoc(doc(db, 'recalculate_requests', 'flag'), {
      requested_at: serverTimestamp(),
    });

    return NextResponse.json({ ok: true, mode: 'flag-set' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

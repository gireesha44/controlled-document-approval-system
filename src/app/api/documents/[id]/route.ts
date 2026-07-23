import { NextRequest, NextResponse } from 'next/server';
import { getDocumentById, DomainError } from '@/lib/domain';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = req.headers.get('x-user-id') || req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User session required' }, { status: 401 });
    }

    const doc = getDocumentById(userId, params.id);
    return NextResponse.json({ document: doc });
  } catch (err: any) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

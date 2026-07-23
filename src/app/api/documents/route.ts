import { NextRequest, NextResponse } from 'next/server';
import { getDocumentsForUser, createDocument, DomainError } from '@/lib/domain';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User session required' }, { status: 401 });
    }
    const docs = getDocumentsForUser(userId);
    return NextResponse.json({ documents: docs });
  } catch (err: any) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User session required' }, { status: 401 });
    }

    const body = await req.json();
    const { title, body: docBody } = body;

    const doc = createDocument(userId, title, docBody);
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err: any) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

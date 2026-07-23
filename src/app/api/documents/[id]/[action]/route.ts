import { NextRequest, NextResponse } from 'next/server';
import {
  updateDraft,
  submitDocument,
  reviewDocument,
  publishDocument,
  archiveDocument,
  DomainError,
} from '@/lib/domain';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  try {
    const userId = req.headers.get('x-user-id') || req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User session required' }, { status: 401 });
    }

    const { id, action } = params;
    const payload = await req.json();
    const { title, body, decision, comment, expectedVersion } = payload;

    if (expectedVersion === undefined || expectedVersion === null) {
      return NextResponse.json({ error: 'expectedVersion is required for concurrency control' }, { status: 400 });
    }

    let updatedDoc;

    switch (action) {
      case 'edit':
        updatedDoc = updateDraft(userId, id, title, body, expectedVersion);
        break;
      case 'submit':
        updatedDoc = submitDocument(userId, id, expectedVersion);
        break;
      case 'review':
        updatedDoc = reviewDocument(userId, id, decision, comment, expectedVersion);
        break;
      case 'publish':
        updatedDoc = publishDocument(userId, id, expectedVersion);
        break;
      case 'archive':
        updatedDoc = archiveDocument(userId, id, expectedVersion);
        break;
      default:
        return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 404 });
    }

    return NextResponse.json({ document: updatedDoc });
  } catch (err: any) {
    if (err instanceof DomainError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

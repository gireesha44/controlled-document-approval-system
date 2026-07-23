import { NextResponse } from 'next/server';
import { seed } from '@/db/seed';

export async function POST() {
  try {
    seed();
    return NextResponse.json({ message: 'Database reset and seeded successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

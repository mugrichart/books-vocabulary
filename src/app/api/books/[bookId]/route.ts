import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

type RouteContext = {
  params: Promise<{ bookId: string }>;
};

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId } = await params;
    const { currentPage } = await req.json();

    if (currentPage === undefined) {
      return NextResponse.json({ error: 'currentPage is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const book = await db.collection('books').findOne({
      _id: new ObjectId(bookId),
      userId: session.userId,
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 444 });
    }

    const totalPages = book.totalPages || 1;
    const pages = Math.min(Number(currentPage), totalPages);
    const progress = Math.round((pages / totalPages) * 100);

    await db.collection('books').updateOne(
      { _id: new ObjectId(bookId) },
      { $set: { currentPage: pages, progress } }
    );

    return NextResponse.json({ success: true, progress, currentPage: pages });
  } catch (error) {
    console.error('Failed to update book progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = getSession(_req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId } = await params;
    const { db } = await connectToDatabase();

    // Verify ownership
    const book = await db.collection('books').findOne({
      _id: new ObjectId(bookId),
      userId: session.userId,
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 444 });
    }

    // Delete book
    await db.collection('books').deleteOne({ _id: new ObjectId(bookId) });
    // Delete associated captures
    await db.collection('captures').deleteMany({ bookId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

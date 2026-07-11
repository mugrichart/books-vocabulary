import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const books = await db
      .collection('books')
      .find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Map _id to id for client compatibility
    const mappedBooks = books.map((b) => ({
      id: b._id.toString(),
      title: b.title,
      author: b.author,
      coverColor: b.coverColor || 'from-violet-600 to-purple-800',
      progress: b.progress || 0,
      totalPages: b.totalPages || 0,
      currentPage: b.currentPage || 0,
      wordCount: b.wordCount || 0,
      pdfUrl: b.pdfUrl,
      coverUrl: b.coverUrl,
    }));

    return NextResponse.json({ books: mappedBooks });
  } catch (error) {
    console.error('Failed to fetch books:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, author, totalPages, pdfUrl, coverUrl } = await req.json();

    if (!title || !author) {
      return NextResponse.json({ error: 'Title and author are required' }, { status: 400 });
    }

    const coverColors = [
      'from-violet-600 to-purple-800',
      'from-teal-600 to-emerald-800',
      'from-rose-600 to-red-800',
      'from-blue-600 to-indigo-800',
      'from-amber-600 to-orange-800',
      'from-fuchsia-600 to-pink-800',
    ];
    const randomColor = coverColors[Math.floor(Math.random() * coverColors.length)];

    const { db } = await connectToDatabase();
    const result = await db.collection('books').insertOne({
      userId: session.userId,
      title,
      author,
      coverColor: randomColor,
      progress: 0,
      totalPages: Number(totalPages) || 0,
      currentPage: 0,
      wordCount: 0,
      pdfUrl,
      coverUrl,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      book: {
        id: result.insertedId.toString(),
        title,
        author,
        coverColor: randomColor,
        progress: 0,
        totalPages,
        currentPage: 0,
        wordCount: 0,
        pdfUrl,
        coverUrl,
      },
    });
  } catch (error) {
    console.error('Failed to create book:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

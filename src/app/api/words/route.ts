import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// GET /api/words: Retrieve all vocabulary captures for the authenticated user
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const words = await db
      .collection('captures')
      .find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .toArray();

    const mappedWords = words.map((w) => ({
      id: w._id.toString(),
      word: w.word,
      definition: w.explanation || w.definition || 'No explanation generated yet.',
      translation: w.translation || '',
      contextSentence: w.sentence || '',
      bookId: w.bookId,
      masteryLevel: w.checked ? 'mastered' : 'learning',
      createdAt: w.createdAt,
    }));

    return NextResponse.json({ words: mappedWords });
  } catch (error) {
    console.error('Failed to get vocabulary words:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/words: Add a manual vocabulary word
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { word, definition, translation, contextSentence, bookId } = await req.json();

    if (!word || !definition || !bookId) {
      return NextResponse.json({ error: 'Word, definition, and bookId are required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('captures').insertOne({
      userId: session.userId,
      bookId,
      word,
      sentence: contextSentence || '',
      checked: false,
      definition,
      translation: translation || '',
      explanation: `General meaning: ${definition}\n\nIn context: Used in the sentence: ${contextSentence || ''}`,
      options: [word, 'Option A', 'Option B', 'Option C'].sort(() => Math.random() - 0.5),
      createdAt: new Date(),
    });

    // Increment word count for this book
    await db.collection('books').updateOne(
      { _id: new ObjectId(bookId), userId: session.userId },
      { $inc: { wordCount: 1 } }
    );

    return NextResponse.json({
      success: true,
      word: {
        id: result.insertedId.toString(),
        word,
        definition,
        translation,
        contextSentence,
        bookId,
        masteryLevel: 'learning',
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Failed to save manual word:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

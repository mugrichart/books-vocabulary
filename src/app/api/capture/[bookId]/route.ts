import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { generateQuizOptions } from '@/lib/openai';

type RouteContext = {
  params: Promise<{ bookId: string }>;
};

// GET: Retrieve captures for a specific book
// Query params:
// - mode: 'practice' (only unchecked, small limit) or 'highlight' (all captures for the page or paginated)
// - pageIndex: number (filter by specific PDF page)
// - limit: number (default 50)
// - skip: number (default 0)
export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId } = await params;
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode');
    const pageIndexStr = url.searchParams.get('pageIndex');
    const limit = Math.min(100, Number(url.searchParams.get('limit')) || 50);
    const skip = Number(url.searchParams.get('skip')) || 0;

    const { db } = await connectToDatabase();

    const query: any = {
      userId: session.userId,
      bookId: bookId,
    };

    if (mode === 'practice') {
      query.checked = false;
    }

    if (pageIndexStr !== null && pageIndexStr !== undefined && pageIndexStr !== '') {
      query.pageIndex = Number(pageIndexStr);
    }

    const sort = url.searchParams.get('sort'); // 'recent' → newest first, default → page order

    const captures = await db
      .collection('captures')
      .find(query)
      .sort(sort === 'recent' ? { createdAt: -1 } : { pageIndex: 1, createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('captures').countDocuments({
      userId: session.userId,
      bookId: bookId,
    });

    const mappedCaptures = captures.map((c) => ({
      id: c._id.toString(),
      pageIndex: c.pageIndex,
      word: c.word,
      sentence: c.sentence,
      coordinates: c.coordinates,
      checked: c.checked || false,
      options: c.options || [],
      explanation: c.explanation || '',
    }));

    return NextResponse.json({ captures: mappedCaptures, total });
  } catch (error) {
    console.error('Failed to get captures:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Add a single new capture and generate options/explanation
export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId } = await params;
    const { word, sentence, pageIndex, coordinates } = await req.json();

    if (!word || !sentence || pageIndex === undefined || !coordinates) {
      return NextResponse.json({ error: 'Missing required capture fields' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 1. Generate options & explanation using OpenAI
    const quizData = await generateQuizOptions(word, sentence);

    // 2. Save capture in MongoDB
    const result = await db.collection('captures').insertOne({
      userId: session.userId,
      bookId,
      word,
      sentence,
      pageIndex: Number(pageIndex),
      coordinates,
      checked: false,
      options: quizData.options,
      explanation: quizData.explanation,
      createdAt: new Date(),
    });

    // 3. Update book's word count
    await db.collection('books').updateOne(
      { _id: new ObjectId(bookId), userId: session.userId },
      { $inc: { wordCount: 1 } }
    );

    const total = await db.collection('captures').countDocuments({
      userId: session.userId,
      bookId,
    });

    return NextResponse.json({
      success: true,
      total,
      capture: {
        id: result.insertedId.toString(),
        word,
        sentence,
        pageIndex,
        coordinates,
        checked: false,
        options: quizData.options,
        explanation: quizData.explanation,
      },
    });
  } catch (error) {
    console.error('Failed to save capture:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Perform single updates (check, delete) or bulk operations (reset)
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId } = await params;
    const { action, id, checked } = await req.json();
    const { db } = await connectToDatabase();

    if (action === 'check') {
      if (!id) return NextResponse.json({ error: 'Missing capture ID' }, { status: 400 });
      await db.collection('captures').updateOne(
        { _id: new ObjectId(id), userId: session.userId, bookId },
        { $set: { checked: !!checked } }
      );
      const total = await db.collection('captures').countDocuments({
        userId: session.userId,
        bookId,
      });
      return NextResponse.json({ success: true, total });
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Missing capture ID' }, { status: 400 });
      const deleteResult = await db.collection('captures').deleteOne({
        _id: new ObjectId(id),
        userId: session.userId,
        bookId,
      });

      if (deleteResult.deletedCount > 0) {
        await db.collection('books').updateOne(
          { _id: new ObjectId(bookId), userId: session.userId },
          { $inc: { wordCount: -1 } }
        );
      }
      const total = await db.collection('captures').countDocuments({
        userId: session.userId,
        bookId,
      });
      return NextResponse.json({ success: true, total });
    }

    if (action === 'reset') {
      await db.collection('captures').updateMany(
        { userId: session.userId, bookId },
        { $set: { checked: false } }
      );
      const total = await db.collection('captures').countDocuments({
        userId: session.userId,
        bookId,
      });
      return NextResponse.json({ success: true, total });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to patch capture:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

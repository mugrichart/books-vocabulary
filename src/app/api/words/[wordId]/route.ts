import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

type RouteContext = {
  params: Promise<{ wordId: string }>;
};

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { wordId } = await params;
    const { masteryLevel } = await req.json();

    const { db } = await connectToDatabase();
    
    // Map masteryLevel to checked status: mastered -> checked = true
    const checked = masteryLevel === 'mastered';

    await db.collection('captures').updateOne(
      { _id: new ObjectId(wordId), userId: session.userId },
      { $set: { checked } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update word mastery:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { wordId } = await params;
    const { db } = await connectToDatabase();

    const word = await db.collection('captures').findOne({
      _id: new ObjectId(wordId),
      userId: session.userId,
    });

    if (!word) {
      return NextResponse.json({ error: 'Word not found' }, { status: 444 });
    }

    const deleteResult = await db.collection('captures').deleteOne({
      _id: new ObjectId(wordId),
      userId: session.userId,
    });

    if (deleteResult.deletedCount > 0 && word.bookId) {
      await db.collection('books').updateOne(
        { _id: new ObjectId(word.bookId), userId: session.userId },
        { $inc: { wordCount: -1 } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete word:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

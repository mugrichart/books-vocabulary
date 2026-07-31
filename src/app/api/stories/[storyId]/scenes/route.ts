import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';

type RouteContext = {
  params: Promise<{ storyId: string }>;
};

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { storyId } = await params;
    const { chapterId, title } = await req.json();

    if (!chapterId || !title) {
      return NextResponse.json({ error: 'chapterId and title are required' }, { status: 400 });
    }

    const storyObjectId = new ObjectId(storyId);
    const chapterObjectId = new ObjectId(chapterId);
    const { db } = await connectToDatabase();

    const chapter = await db.collection('storyChapters').findOne({
      _id: chapterObjectId,
      storyId: storyObjectId,
      userId: session.userId,
    });

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    const order = await db.collection('storyScenes').countDocuments({ chapterId: chapterObjectId, userId: session.userId });
    const now = new Date();
    const result = await db.collection('storyScenes').insertOne({
      userId: session.userId,
      storyId: storyObjectId,
      chapterId: chapterObjectId,
      title,
      outline: '',
      content: '',
      order,
      captureCursor: 0,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('stories').updateOne({ _id: storyObjectId, userId: session.userId }, { $set: { updatedAt: now } });

    return NextResponse.json({
      success: true,
      scene: {
        id: result.insertedId.toString(),
        storyId,
        chapterId,
        title,
        outline: '',
        content: '',
        order,
        captureCursor: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to create scene:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
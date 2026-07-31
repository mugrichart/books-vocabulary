import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';

type RouteContext = {
  params: Promise<{ storyId: string; chapterId: string }>;
};

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { storyId, chapterId } = await params;
    const { title, outline } = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof title === 'string') {
      updates.title = title.trim();
    }
    if (typeof outline === 'string') {
      updates.outline = outline;
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('storyChapters').findOneAndUpdate(
      {
        _id: new ObjectId(chapterId),
        storyId: new ObjectId(storyId),
        userId: session.userId,
      },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    await db.collection('stories').updateOne(
      { _id: new ObjectId(storyId), userId: session.userId },
      { $set: { updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update chapter:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { storyId, chapterId } = await params;
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

    await Promise.all([
      db.collection('storyChapters').deleteOne({ _id: chapterObjectId, storyId: storyObjectId, userId: session.userId }),
      db.collection('storyScenes').deleteMany({ chapterId: chapterObjectId, storyId: storyObjectId, userId: session.userId }),
      db.collection('stories').updateOne(
        { _id: storyObjectId, userId: session.userId },
        { $set: { updatedAt: new Date() } }
      ),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete chapter:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
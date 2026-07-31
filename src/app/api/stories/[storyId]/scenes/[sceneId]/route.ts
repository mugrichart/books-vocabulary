import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';

type RouteContext = {
  params: Promise<{ storyId: string; sceneId: string }>;
};

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { storyId, sceneId } = await params;
    const { title, outline, content, captureCursor } = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof title === 'string') {
      updates.title = title.trim();
    }
    if (typeof outline === 'string') {
      updates.outline = outline;
    }
    if (typeof content === 'string') {
      updates.content = content;
    }
    if (typeof captureCursor === 'number' && Number.isFinite(captureCursor)) {
      updates.captureCursor = Math.max(0, Math.floor(captureCursor));
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('storyScenes').findOneAndUpdate(
      {
        _id: new ObjectId(sceneId),
        storyId: new ObjectId(storyId),
        userId: session.userId,
      },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    await db.collection('stories').updateOne(
      { _id: new ObjectId(storyId), userId: session.userId },
      { $set: { updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update scene:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { storyId, sceneId } = await params;
    const storyObjectId = new ObjectId(storyId);
    const sceneObjectId = new ObjectId(sceneId);
    const { db } = await connectToDatabase();

    const scene = await db.collection('storyScenes').findOne({
      _id: sceneObjectId,
      storyId: storyObjectId,
      userId: session.userId,
    });

    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    await Promise.all([
      db.collection('storyScenes').deleteOne({ _id: sceneObjectId, storyId: storyObjectId, userId: session.userId }),
      db.collection('stories').updateOne(
        { _id: storyObjectId, userId: session.userId },
        { $set: { updatedAt: new Date() } }
      ),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete scene:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
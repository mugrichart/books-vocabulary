import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';

type RouteContext = {
  params: Promise<{ storyId: string }>;
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { storyId } = await params;
    const objectId = new ObjectId(storyId);
    const { db } = await connectToDatabase();

    const story = await db.collection('stories').findOne({
      _id: objectId,
      userId: session.userId,
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    const [chapters, scenes] = await Promise.all([
      db.collection('storyChapters').find({ storyId: objectId, userId: session.userId }).sort({ order: 1, createdAt: 1 }).toArray(),
      db.collection('storyScenes').find({ storyId: objectId, userId: session.userId }).sort({ order: 1, createdAt: 1 }).toArray(),
    ]);

    return NextResponse.json({
      story: {
        id: story._id.toString(),
        title: story.title,
        bookId: story.bookId,
        bookTitle: story.bookTitle,
        outline: story.outline || '',
        captureCursor: typeof story.captureCursor === 'number' ? Math.max(0, Math.floor(story.captureCursor)) : 0,
        chapterCount: chapters.length,
        sceneCount: scenes.length,
        createdAt: story.createdAt instanceof Date ? story.createdAt.toISOString() : new Date(story.createdAt).toISOString(),
        updatedAt: story.updatedAt instanceof Date ? story.updatedAt.toISOString() : new Date(story.updatedAt).toISOString(),
        chapters: chapters.map((chapter) => ({
          id: chapter._id.toString(),
          storyId: storyId,
          title: chapter.title,
          outline: chapter.outline || '',
          order: chapter.order || 0,
          createdAt: chapter.createdAt instanceof Date ? chapter.createdAt.toISOString() : new Date(chapter.createdAt).toISOString(),
          updatedAt: chapter.updatedAt instanceof Date ? chapter.updatedAt.toISOString() : new Date(chapter.updatedAt).toISOString(),
        })),
        scenes: scenes.map((scene) => ({
          id: scene._id.toString(),
          storyId: storyId,
          chapterId: scene.chapterId instanceof ObjectId ? scene.chapterId.toString() : String(scene.chapterId),
          title: scene.title,
          outline: scene.outline || '',
          content: scene.content || '',
          order: scene.order || 0,
          captureCursor: scene.captureCursor || 0,
          createdAt: scene.createdAt instanceof Date ? scene.createdAt.toISOString() : new Date(scene.createdAt).toISOString(),
          updatedAt: scene.updatedAt instanceof Date ? scene.updatedAt.toISOString() : new Date(scene.updatedAt).toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Failed to fetch story:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { storyId } = await params;
    const { title, outline, captureCursor } = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof title === 'string') {
      updates.title = title.trim();
    }
    if (typeof outline === 'string') {
      updates.outline = outline;
    }
    if (typeof captureCursor === 'number' && Number.isFinite(captureCursor)) {
      updates.captureCursor = Math.max(0, Math.floor(captureCursor));
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('stories').findOneAndUpdate(
      { _id: new ObjectId(storyId), userId: session.userId },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update story:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { storyId } = await params;
    const storyObjectId = new ObjectId(storyId);
    const { db } = await connectToDatabase();

    const story = await db.collection('stories').findOne({
      _id: storyObjectId,
      userId: session.userId,
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    await Promise.all([
      db.collection('stories').deleteOne({ _id: storyObjectId, userId: session.userId }),
      db.collection('storyChapters').deleteMany({ storyId: storyObjectId, userId: session.userId }),
      db.collection('storyScenes').deleteMany({ storyId: storyObjectId, userId: session.userId }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete story:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
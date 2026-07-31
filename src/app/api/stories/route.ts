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
    const stories = await db
      .collection('stories')
      .aggregate([
        { $match: { userId: session.userId } },
        {
          $lookup: {
            from: 'storyChapters',
            localField: '_id',
            foreignField: 'storyId',
            as: 'chapters',
          },
        },
        {
          $lookup: {
            from: 'storyScenes',
            localField: '_id',
            foreignField: 'storyId',
            as: 'scenes',
          },
        },
        { $sort: { updatedAt: -1, createdAt: -1 } },
      ])
      .toArray();

    const mappedStories = stories.map((story) => ({
      id: story._id.toString(),
      title: story.title,
      bookId: story.bookId,
      bookTitle: story.bookTitle,
      outline: story.outline || '',
      captureCursor: typeof story.captureCursor === 'number' ? Math.max(0, Math.floor(story.captureCursor)) : 0,
      chapterCount: Array.isArray(story.chapters) ? story.chapters.length : 0,
      sceneCount: Array.isArray(story.scenes) ? story.scenes.length : 0,
      createdAt: story.createdAt instanceof Date ? story.createdAt.toISOString() : new Date(story.createdAt).toISOString(),
      updatedAt: story.updatedAt instanceof Date ? story.updatedAt.toISOString() : new Date(story.updatedAt).toISOString(),
    }));

    return NextResponse.json({ stories: mappedStories });
  } catch (error) {
    console.error('Failed to fetch stories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, bookId, bookTitle } = await req.json();

    if (!title || !bookId || !bookTitle) {
      return NextResponse.json({ error: 'Title, bookId, and bookTitle are required' }, { status: 400 });
    }

    const now = new Date();
    const { db } = await connectToDatabase();
    const result = await db.collection('stories').insertOne({
      userId: session.userId,
      title,
      bookId,
      bookTitle,
      outline: '',
      captureCursor: 0,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      story: {
        id: result.insertedId.toString(),
        title,
        bookId,
        bookTitle,
        outline: '',
        captureCursor: 0,
        chapterCount: 0,
        sceneCount: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to create story:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
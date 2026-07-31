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
    const { title } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const storyObjectId = new ObjectId(storyId);
    const { db } = await connectToDatabase();

    const story = await db.collection('stories').findOne({ _id: storyObjectId, userId: session.userId });
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    const order = await db.collection('storyChapters').countDocuments({ storyId: storyObjectId, userId: session.userId });
    const now = new Date();
    const result = await db.collection('storyChapters').insertOne({
      userId: session.userId,
      storyId: storyObjectId,
      title,
      outline: '',
      order,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('stories').updateOne({ _id: storyObjectId }, { $set: { updatedAt: now } });

    return NextResponse.json({
      success: true,
      chapter: {
        id: result.insertedId.toString(),
        storyId,
        title,
        outline: '',
        order,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to create chapter:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
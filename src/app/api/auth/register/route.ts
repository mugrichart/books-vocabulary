import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    const hashedPassword = hashPassword(password);
    const result = await db.collection('users').insertOne({
      email: email.toLowerCase(),
      username: email.toLowerCase(), // satisfy unique index username_1 constraint
      name: name || email.split('@')[0],
      password: hashedPassword,
      createdAt: new Date(),
    });

    const token = generateToken({
      userId: result.insertedId.toString(),
      email: email.toLowerCase(),
    });

    const response = NextResponse.json({
      success: true,
      user: { id: result.insertedId.toString(), email: email.toLowerCase() },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

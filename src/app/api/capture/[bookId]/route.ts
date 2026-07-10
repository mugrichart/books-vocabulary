import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

type CaptureRouteContext = {
  params: Promise<{ bookId: string }>;
};

const EMPTY_CAPTURE_FILE = { captures: [] };

export async function GET(_request: Request, { params }: CaptureRouteContext) {
  const { bookId } = await params;
  const filePath = path.join(process.cwd(), 'public', 'uploads', 'capture', `${bookId}.json`);

  try {
    const fileContents = await fs.readFile(filePath, 'utf8');
    const trimmedContents = fileContents.trim();

    if (!trimmedContents) {
      await fs.writeFile(filePath, JSON.stringify(EMPTY_CAPTURE_FILE, null, 2), 'utf8');
      return NextResponse.json(EMPTY_CAPTURE_FILE);
    }

    const parsed = JSON.parse(trimmedContents);
    const captures = Array.isArray(parsed?.captures) ? parsed.captures : [];
    return NextResponse.json({ captures });
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(EMPTY_CAPTURE_FILE, null, 2), 'utf8');
    return NextResponse.json(EMPTY_CAPTURE_FILE);
  }
}

export async function POST(request: Request, { params }: CaptureRouteContext) {
  try {
    const { bookId } = await params;
    const body = await request.json();
    const directory = path.join(process.cwd(), 'public', 'uploads', 'capture');
    
    // Ensure the directory exists
    await fs.mkdir(directory, { recursive: true });
    
    const filePath = path.join(directory, `${bookId}.json`);
    await fs.writeFile(filePath, JSON.stringify(body, null, 2), 'utf8');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error writing capture file:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

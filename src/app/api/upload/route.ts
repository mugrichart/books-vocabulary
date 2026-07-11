import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSession } from "@/lib/auth";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'flashhub';

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const pdfFile = formData.get("pdf") as File | null;
    const coverFile = formData.get("cover") as File | null;

    if (!pdfFile) {
      return NextResponse.json({ error: "Missing PDF file" }, { status: 400 });
    }

    const timestamp = Date.now();
    const region = process.env.AWS_REGION || 'eu-north-1';

    // 1. Upload PDF to S3
    const cleanPdfName = `${session.userId}/${timestamp}-${pdfFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `books/${cleanPdfName}`,
        Body: pdfBuffer,
        ContentType: "application/pdf",
      })
    );

    const pdfUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/books/${cleanPdfName}`;

    // 2. Upload Cover Image to S3 (if exists)
    let coverUrl = "";
    if (coverFile) {
      const cleanCoverName = `${session.userId}/${timestamp}-cover.png`;
      const coverBuffer = Buffer.from(await coverFile.arrayBuffer());

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `covers/${cleanCoverName}`,
          Body: coverBuffer,
          ContentType: "image/png",
        })
      );

      coverUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/covers/${cleanCoverName}`;
    }

    return NextResponse.json({
      success: true,
      pdfUrl,
      coverUrl,
    });
  } catch (error) {
    console.error("S3 Upload API Error:", error);
    return NextResponse.json(
      { error: "Internal server error during upload to S3" },
      { status: 500 }
    );
  }
}

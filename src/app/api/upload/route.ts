import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pdfFile = formData.get("pdf") as File | null;
    const coverFile = formData.get("cover") as File | null;

    if (!pdfFile) {
      return NextResponse.json({ error: "Missing PDF file" }, { status: 400 });
    }

    // Ensure upload directories exist
    const baseUploadDir = path.join(process.cwd(), "public", "uploads");
    const booksDir = path.join(baseUploadDir, "books");
    const coversDir = path.join(baseUploadDir, "covers");

    await fs.mkdir(booksDir, { recursive: true });
    await fs.mkdir(coversDir, { recursive: true });

    // Generate unique file names
    const timestamp = Date.now();
    const cleanPdfName = `${timestamp}-${pdfFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const pdfPath = path.join(booksDir, cleanPdfName);

    // Save PDF
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    await fs.writeFile(pdfPath, pdfBuffer);
    const pdfUrl = `/uploads/books/${cleanPdfName}`;

    let coverUrl = "";
    if (coverFile) {
      const cleanCoverName = `${timestamp}-cover.png`;
      const coverPath = path.join(coversDir, cleanCoverName);
      
      // Save Cover Image
      const coverBuffer = Buffer.from(await coverFile.arrayBuffer());
      await fs.writeFile(coverPath, coverBuffer);
      coverUrl = `/uploads/covers/${cleanCoverName}`;
    }

    return NextResponse.json({
      success: true,
      pdfUrl,
      coverUrl,
    });
  } catch (error) {
    console.error("Upload API Error:", error);
    return NextResponse.json(
      { error: "Internal server error during upload" },
      { status: 500 }
    );
  }
}

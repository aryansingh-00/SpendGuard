import { NextResponse } from "next/server";
import { extractReceiptMetadata } from "@/lib/ai/receiptOcr";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileData, fileName, mimeType } = body;

    if (!fileName) {
      return NextResponse.json({ error: "File name is required." }, { status: 400 });
    }

    const extraction = await extractReceiptMetadata(
      fileData || "",
      fileName,
      mimeType || "application/pdf"
    );

    return NextResponse.json({
      success: true,
      data: extraction,
    });
  } catch (error) {
    console.error("Receipt OCR API Error:", error);
    return NextResponse.json(
      { error: "Failed to process receipt image/PDF." },
      { status: 500 }
    );
  }
}

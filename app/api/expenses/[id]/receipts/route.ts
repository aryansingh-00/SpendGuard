import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { fileStorage } from "@/lib/storage/file-storage";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const { id } = await params;

    // 1. Verify Expense & Tenancy
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { employeeProfile: true },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    }

    if (expense.companyId !== user.companyId) {
      return NextResponse.json({ error: "Unauthorized access to expense." }, { status: 403 });
    }

    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let mimeType = "application/pdf";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json({ error: "No file provided in form data." }, { status: 400 });
      }

      fileName = file.name;
      mimeType = file.type || "application/pdf";
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else {
      // JSON base64 upload
      const body = await request.json().catch(() => ({}));
      fileName = body.fileName || `receipt_${Date.now()}.pdf`;
      mimeType = body.mimeType || "application/pdf";

      if (body.fileData) {
        const base64Clean = body.fileData.includes("base64,")
          ? body.fileData.split("base64,")[1]
          : body.fileData;
        fileBuffer = Buffer.from(base64Clean, "base64");
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ error: "File data is required." }, { status: 400 });
    }

    // 2. Validate and Store File via Storage Layer
    const validation = fileStorage.validateFile(fileBuffer, fileName, mimeType);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const stored = await fileStorage.uploadFile({
      buffer: fileBuffer,
      fileName,
      mimeType,
      companyId: user.companyId,
    });

    // 3. Persist ExpenseReceipt Record
    const receipt = await prisma.expenseReceipt.create({
      data: {
        companyId: user.companyId,
        expenseId: expense.id,
        fileName: stored.fileName,
        fileType: stored.mimeType,
        fileSize: stored.fileSize,
        fileHash: stored.fileHash,
        storageKey: stored.storageKey,
        status: "UPLOADED",
        uploadedById: user.id,
      },
    });

    // 4. Log Audit Event
    await logAuditEvent({
      companyId: user.companyId,
      actorId: user.id,
      action: "RECEIPT_UPLOADED",
      entityType: "EXPENSE",
      entityId: expense.id,
      metadata: {
        receiptId: receipt.id,
        fileName: stored.fileName,
        fileSize: stored.fileSize,
        fileHash: stored.fileHash,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Receipt uploaded successfully.",
      receipt,
    });
  } catch (error: any) {
    console.error("Upload Receipt Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload receipt." },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const { id } = await params;

    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense || expense.companyId !== user.companyId) {
      return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    }

    const receipts = await prisma.expenseReceipt.findMany({
      where: {
        expenseId: id,
        companyId: user.companyId,
      },
      include: {
        receiptAnalyses: {
          orderBy: { createdAt: "desc" },
          include: { expenseVerifications: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      count: receipts.length,
      receipts,
    });
  } catch (error: any) {
    console.error("Get Receipts Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve expense receipts." },
      { status: 500 }
    );
  }
}

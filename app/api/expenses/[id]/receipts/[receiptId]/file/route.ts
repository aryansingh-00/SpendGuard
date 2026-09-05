import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { fileStorage } from "@/lib/storage/file-storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; receiptId: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const { id, receiptId } = await params;

    const receipt = await prisma.expenseReceipt.findUnique({
      where: { id: receiptId },
      include: { expense: true },
    });

    if (!receipt || receipt.companyId !== user.companyId || receipt.expenseId !== id) {
      return NextResponse.json({ error: "Receipt document not found." }, { status: 404 });
    }

    // Role-based check: Employee can only view own expenses' receipts
    if (user.role === "EMPLOYEE") {
      const profile = await prisma.employeeProfile.findUnique({
        where: { userId: user.id },
      });
      if (receipt.expense.employeeProfileId !== profile?.id) {
        return NextResponse.json({ error: "Unauthorized access to document." }, { status: 403 });
      }
    }

    const retrieved = await fileStorage.retrieveFile(receipt.storageKey, user.companyId);
    if (!retrieved) {
      return NextResponse.json({ error: "Receipt file not found in storage." }, { status: 404 });
    }

    return new Response(new Uint8Array(retrieved.buffer), {
      headers: {
        "Content-Type": retrieved.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(retrieved.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("Receipt Download Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve receipt document." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

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

    const verification = await prisma.expenseVerification.findFirst({
      where: {
        expenseId: id,
        companyId: user.companyId,
      },
      include: {
        receiptAnalysis: {
          include: { receipt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      hasVerification: Boolean(verification),
      verification,
    });
  } catch (error: any) {
    console.error("Get Verification Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve verification details." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;

    const insight = await prisma.aIInsight.findUnique({
      where: { id },
    });

    if (!insight || insight.companyId !== user.companyId) {
      return NextResponse.json({ error: "Insight not found." }, { status: 404 });
    }

    if (user.role === "EMPLOYEE") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const updated = await prisma.aIInsight.update({
      where: { id },
      data: { status: "RESOLVED" },
    });

    await prisma.auditLog.create({
      data: {
        companyId: user.companyId!,
        actorId: user.id,
        action: "AI_INSIGHT_RESOLVED",
        entityType: "INSIGHT",
        entityId: id,
        metadata: JSON.stringify({ title: insight.title, severity: insight.severity }),
      },
    });

    return NextResponse.json({ success: true, insight: updated });
  } catch (error) {
    console.error("Resolve Insight API Error:", error);
    return NextResponse.json({ error: "Failed to resolve insight." }, { status: 500 });
  }
}

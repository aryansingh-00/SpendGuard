import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    // Role-based filtering
    if (user.role === "EMPLOYEE") {
      // Employees do not view executive company financial insights
      return NextResponse.json({ insights: [] });
    }

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get("severity") || undefined;
    const status = searchParams.get("status") || "ACTIVE";
    let departmentId = searchParams.get("departmentId") || undefined;

    if (user.role === "MANAGER") {
      const managedDepts = await prisma.department.findMany({
        where: { companyId: user.companyId, managerId: user.id },
      });
      const managedDeptIds = managedDepts.map((d) => d.id);
      if (departmentId && !managedDeptIds.includes(departmentId)) {
        return NextResponse.json({ error: "Unauthorized department access." }, { status: 403 });
      }
      if (!departmentId && managedDeptIds.length > 0) {
        departmentId = managedDeptIds[0];
      }
    }

    const insights = await prisma.aIInsight.findMany({
      where: {
        companyId: user.companyId,
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(departmentId ? { OR: [{ departmentId }, { departmentId: null }] } : {}),
      },
      orderBy: [{ severity: "asc" }, { generatedAt: "desc" }],
      take: 20,
    });

    const parsedInsights = insights.map((insight) => ({
      ...insight,
      evidence: JSON.parse(insight.evidence || "[]"),
    }));

    return NextResponse.json({ insights: parsedInsights });
  } catch (error) {
    console.error("Finance Insights GET API Error:", error);
    return NextResponse.json(
      { error: "Failed to load financial insights." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getFinanceAnalytics, TimePeriodKey } from "@/lib/finance/analytics";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") as TimePeriodKey) || "last_30_days";
    let departmentId = searchParams.get("departmentId") || undefined;
    let employeeProfileId = searchParams.get("employeeProfileId") || undefined;

    // Role-based authorization & scoping
    if (user.role === "EMPLOYEE") {
      const empProfile = await prisma.employeeProfile.findUnique({
        where: { userId: user.id },
      });
      if (!empProfile) {
        return NextResponse.json({ error: "Employee profile not found." }, { status: 404 });
      }
      employeeProfileId = empProfile.id;
      departmentId = empProfile.departmentId || undefined;
    } else if (user.role === "MANAGER") {
      const managedDepts = await prisma.department.findMany({
        where: { companyId: user.companyId, managerId: user.id },
      });
      const managedDeptIds = managedDepts.map((d) => d.id);

      // If manager specifies a dept, verify they manage it
      if (departmentId && !managedDeptIds.includes(departmentId)) {
        return NextResponse.json(
          { error: "Unauthorized. You can only view analytics for departments you manage." },
          { status: 403 }
        );
      }
      if (!departmentId && managedDeptIds.length > 0) {
        departmentId = managedDeptIds[0];
      }
    }

    const analytics = await getFinanceAnalytics({
      companyId: user.companyId,
      departmentId,
      employeeProfileId,
      period,
    });

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Finance Analytics API Error:", error);
    return NextResponse.json(
      { error: "Failed to compute financial analytics. Please try again." },
      { status: 500 }
    );
  }
}

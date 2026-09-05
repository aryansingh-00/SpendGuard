import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status"); // PENDING, APPROVED, REJECTED, ALL
    const departmentId = searchParams.get("departmentId");
    const employeeId = searchParams.get("employeeId");
    const riskLevel = searchParams.get("riskLevel"); // LOW, MEDIUM, HIGH
    const search = searchParams.get("search")?.trim().toLowerCase();

    // Base query scoped to company
    const where: any = {
      companyId: user.companyId,
    };

    // Status filter
    if (statusParam && statusParam.toUpperCase() !== "ALL") {
      where.status = statusParam.toUpperCase();
    }

    // Role-based visibility scoping
    if (user.role === "EMPLOYEE") {
      where.expense = {
        employeeProfile: {
          userId: user.id,
        },
      };
    } else if (user.role === "MANAGER") {
      const managedDepts = await prisma.department.findMany({
        where: { companyId: user.companyId, managerId: user.id },
      });
      const managedDeptIds = managedDepts.map((d) => d.id);
      if (departmentId && departmentId !== "all") {
        where.expense = {
          ...where.expense,
          departmentId,
        };
      } else if (managedDeptIds.length > 0) {
        where.expense = {
          ...where.expense,
          departmentId: { in: managedDeptIds },
        };
      }
    } else {
      if (departmentId && departmentId !== "all") {
        where.expense = {
          ...where.expense,
          departmentId,
        };
      }
    }

    if (employeeId && employeeId !== "all") {
      where.expense = {
        ...where.expense,
        employeeProfileId: employeeId,
      };
    }

    const rawApprovals = await prisma.approval.findMany({
      where,
      include: {
        expense: {
          include: {
            employeeProfile: {
              include: {
                user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
              },
            },
            department: true,
            aiAnalysis: true,
            verifications: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            expenseReceipts: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
        approver: {
          select: { id: true, name: true, email: true, role: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let filtered = rawApprovals;

    if (riskLevel && riskLevel.toUpperCase() !== "ALL") {
      filtered = filtered.filter(
        (a) => a.expense.aiAnalysis?.riskLevel?.toUpperCase() === riskLevel.toUpperCase()
      );
    }

    if (search) {
      filtered = filtered.filter((a) => {
        const merchant = a.expense.merchantName.toLowerCase();
        const expNumber = a.expense.expenseNumber.toLowerCase();
        const empName = a.expense.employeeProfile?.user?.name.toLowerCase() || "";
        const purpose = (a.expense.purpose || "").toLowerCase();
        const category = a.expense.category.toLowerCase();
        return (
          merchant.includes(search) ||
          expNumber.includes(search) ||
          empName.includes(search) ||
          purpose.includes(search) ||
          category.includes(search)
        );
      });
    }

    const statsWhere: any = { companyId: user.companyId };
    if (user.role === "EMPLOYEE") {
      statsWhere.expense = { employeeProfile: { userId: user.id } };
    }

    const allScopeApprovals = await prisma.approval.findMany({
      where: statsWhere,
      include: {
        expense: { select: { amount: true } },
      },
    });

    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingAmount = 0;

    for (const item of allScopeApprovals) {
      if (item.status === "PENDING") {
        pendingCount++;
        pendingAmount += item.expense.amount;
      } else if (item.status === "APPROVED") {
        approvedCount++;
      } else if (item.status === "REJECTED") {
        rejectedCount++;
      }
    }

    const formatted = filtered.map((a) => {
      let policyReasons: string[] = [];
      try {
        policyReasons = JSON.parse(a.expense.policyReasons || "[]");
      } catch {
        policyReasons = [];
      }

      let signals: any[] = [];
      try {
        if (a.expense.aiAnalysis?.signals) {
          signals =
            typeof a.expense.aiAnalysis.signals === "string"
              ? JSON.parse(a.expense.aiAnalysis.signals)
              : a.expense.aiAnalysis.signals;
        }
      } catch {
        signals = [];
      }

      const latestVerification = a.expense.verifications?.[0] || null;
      const hasReceipt = a.expense.expenseReceipts?.length > 0;

      return {
        id: a.id,
        status: a.status,
        decision: a.decision,
        comment: a.comment,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        decidedAt: a.decidedAt,
        approver: a.approver,
        expense: {
          id: a.expense.id,
          expenseNumber: a.expense.expenseNumber,
          merchantName: a.expense.merchantName,
          amount: a.expense.amount,
          currency: a.expense.currency,
          category: a.expense.category,
          purpose: a.expense.purpose,
          expenseDate: a.expense.expenseDate,
          status: a.expense.status,
          paymentStatus: a.expense.paymentStatus,
          policyDecision: a.expense.policyDecision,
          policyReasons,
          decisionReason: a.expense.decisionReason,
          hasReceipt,
          verification: latestVerification,
          employee: {
            id: a.expense.employeeProfile.id,
            name: a.expense.employeeProfile.user.name,
            email: a.expense.employeeProfile.user.email,
            role: a.expense.employeeProfile.user.role,
            monthlyBudget: a.expense.employeeProfile.monthlyBudget,
            userId: a.expense.employeeProfile.userId,
          },
          department: a.expense.department,
          aiAnalysis: a.expense.aiAnalysis
            ? {
                ...a.expense.aiAnalysis,
                signals,
              }
            : null,
        },
      };
    });

    return NextResponse.json({
      approvals: formatted,
      stats: {
        pendingCount,
        approvedCount,
        rejectedCount,
        pendingAmount,
      },
    });
  } catch (error) {
    console.error("GET Approvals Error:", error);
    return NextResponse.json({ error: "Failed to fetch approvals." }, { status: 500 });
  }
}

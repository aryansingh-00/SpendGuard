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

    const policies = await prisma.policy.findMany({
      where: { companyId: user.companyId },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
        employeeProfile: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const parsed = policies.map((p) => {
      let allowedCategories: string[] = [];
      let blockedCategories: string[] = [];
      let allowedMerchants: string[] = [];
      let blockedMerchants: string[] = [];

      try {
        allowedCategories = JSON.parse(p.allowedCategories || "[]");
      } catch {
        allowedCategories = [];
      }
      try {
        blockedCategories = JSON.parse(p.blockedCategories || "[]");
      } catch {
        blockedCategories = [];
      }
      try {
        allowedMerchants = JSON.parse(p.allowedMerchants || "[]");
      } catch {
        allowedMerchants = [];
      }
      try {
        blockedMerchants = JSON.parse(p.blockedMerchants || "[]");
      } catch {
        blockedMerchants = [];
      }

      return {
        ...p,
        allowedCategories,
        blockedCategories,
        allowedMerchants,
        blockedMerchants,
      };
    });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("GET Policies Error:", error);
    return NextResponse.json({ error: "Failed to fetch policies." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Only FINANCE_ADMIN can create policies
    const { user, errorResponse } = await requireAuth(request, ["FINANCE_ADMIN"]);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      description,
      scopeType = "COMPANY",
      departmentId,
      employeeProfileId,
      monthlyLimit,
      maxTransactionAmount = 50000,
      approvalThreshold = 10000,
      allowedCategories = [],
      blockedCategories = [],
      allowedMerchants = [],
      blockedMerchants = [],
      requireReceiptAbove = 1000,
      isActive = true,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Policy name is required." }, { status: 400 });
    }

    const validScopes = ["COMPANY", "DEPARTMENT", "EMPLOYEE"];
    if (!validScopes.includes(scopeType)) {
      return NextResponse.json({ error: "Invalid scope type. Must be COMPANY, DEPARTMENT, or EMPLOYEE." }, { status: 400 });
    }

    const parsedMaxTx = parseFloat(maxTransactionAmount);
    const parsedThreshold = parseFloat(approvalThreshold);
    const parsedMonthly = monthlyLimit !== undefined && monthlyLimit !== null && monthlyLimit !== "" ? parseFloat(monthlyLimit) : null;
    const parsedReceiptAbove = parseFloat(requireReceiptAbove);

    if (isNaN(parsedMaxTx) || parsedMaxTx < 0) {
      return NextResponse.json({ error: "Maximum transaction amount cannot be negative." }, { status: 400 });
    }
    if (isNaN(parsedThreshold) || parsedThreshold < 0) {
      return NextResponse.json({ error: "Approval threshold cannot be negative." }, { status: 400 });
    }
    if (parsedMonthly !== null && (isNaN(parsedMonthly) || parsedMonthly < 0)) {
      return NextResponse.json({ error: "Monthly limit cannot be negative." }, { status: 400 });
    }
    if (parsedThreshold > parsedMaxTx && parsedMaxTx > 0) {
      return NextResponse.json({ error: "Approval threshold should not exceed maximum single transaction amount." }, { status: 400 });
    }

    // Verify department belongs to current company if scoped
    let verifiedDeptId: string | null = null;
    if (scopeType === "DEPARTMENT" && departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!dept || dept.companyId !== user.companyId) {
        return NextResponse.json({ error: "Target department does not exist in your company." }, { status: 400 });
      }
      verifiedDeptId = dept.id;
    }

    // Verify employee belongs to current company if scoped
    let verifiedEmpId: string | null = null;
    if (scopeType === "EMPLOYEE" && employeeProfileId) {
      const emp = await prisma.employeeProfile.findUnique({
        where: { id: employeeProfileId },
      });
      if (!emp || emp.companyId !== user.companyId) {
        return NextResponse.json({ error: "Target employee does not exist in your company." }, { status: 400 });
      }
      verifiedEmpId = emp.id;
    }

    const cleanCategories = (arr: any) =>
      Array.isArray(arr)
        ? arr.map((item) => String(item).trim()).filter(Boolean)
        : [];

    const cleanMerchants = (arr: any) =>
      Array.isArray(arr)
        ? arr.map((item) => String(item).trim()).filter(Boolean)
        : [];

    const policy = await prisma.policy.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        scopeType,
        departmentId: verifiedDeptId,
        employeeProfileId: verifiedEmpId,
        monthlyLimit: parsedMonthly,
        maxTransactionAmount: parsedMaxTx,
        approvalThreshold: parsedThreshold,
        allowedCategories: JSON.stringify(cleanCategories(allowedCategories)),
        blockedCategories: JSON.stringify(cleanCategories(blockedCategories)),
        allowedMerchants: JSON.stringify(cleanMerchants(allowedMerchants)),
        blockedMerchants: JSON.stringify(cleanMerchants(blockedMerchants)),
        requireReceiptAbove: isNaN(parsedReceiptAbove) ? 1000.0 : Math.max(0, parsedReceiptAbove),
        isActive: Boolean(isActive),
        companyId: user.companyId,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        employeeProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    return NextResponse.json(
      {
        ...policy,
        allowedCategories: JSON.parse(policy.allowedCategories),
        blockedCategories: JSON.parse(policy.blockedCategories),
        allowedMerchants: JSON.parse(policy.allowedMerchants),
        blockedMerchants: JSON.parse(policy.blockedMerchants),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST Policy Error:", error);
    return NextResponse.json({ error: "Failed to create policy." }, { status: 500 });
  }
}

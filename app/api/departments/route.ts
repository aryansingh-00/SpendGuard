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

    const [departments, approvedExpenses] = await Promise.all([
      prisma.department.findMany({
        where: { companyId: user.companyId },
        include: {
          manager: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          employeeProfiles: {
            include: {
              user: {
                select: { id: true, name: true, email: true, role: true, avatarUrl: true },
              },
            },
          },
          _count: {
            select: {
              employeeProfiles: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.expense.findMany({
        where: {
          companyId: user.companyId,
          status: { in: ["APPROVED", "PAID"] },
        },
        select: {
          amount: true,
          departmentId: true,
        },
      }),
    ]);

    const formatted = departments.map((dept) => {
      const budget = dept.monthlyBudget || 0;
      const deptExpenses = approvedExpenses.filter((e) => e.departmentId === dept.id);
      const spent = deptExpenses.reduce((sum, e) => sum + e.amount, 0);
      const remaining = Math.max(0, budget - spent);
      const utilization = budget > 0 ? (spent / budget) * 100 : 0;

      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        monthlyBudget: budget,
        spentThisMonth: spent,
        remainingBudget: remaining,
        utilizationRate: utilization,
        manager: dept.manager,
        employeeCount: dept._count.employeeProfiles,
        employeeProfiles: dept.employeeProfiles,
        companyId: dept.companyId,
        createdAt: dept.createdAt,
        updatedAt: dept.updatedAt,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET departments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch departments." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Only FINANCE_ADMIN can create departments
    const { user, errorResponse } = await requireAuth(request, ["FINANCE_ADMIN"]);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, monthlyBudget, code, managerId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Department name is required." }, { status: 400 });
    }

    const parsedBudget = parseFloat(monthlyBudget);
    if (isNaN(parsedBudget) || parsedBudget < 0) {
      return NextResponse.json(
        { error: "Monthly budget cannot be negative." },
        { status: 400 }
      );
    }

    // Generate department code if not provided
    const deptCode = code
      ? code.trim().toUpperCase()
      : name
          .trim()
          .slice(0, 3)
          .toUpperCase();

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        code: deptCode,
        description: description?.trim() || null,
        monthlyBudget: parsedBudget,
        managerId: managerId || null,
        companyId: user.companyId,
      },
      include: {
        manager: true,
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error("POST department error:", error);
    return NextResponse.json(
      { error: "Unable to create department. Please try again." },
      { status: 500 }
    );
  }
}

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

    const companyId = user.companyId;

    // Fetch Company, Departments, Employees, and Expense spending aggregations
    const [company, departments, employeeProfiles, approvedExpenses] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
      }),
      prisma.department.findMany({
        where: { companyId },
        include: {
          employeeProfiles: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.employeeProfile.findMany({
        where: { companyId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          department: { select: { id: true, name: true, code: true } },
        },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.expense.findMany({
        where: {
          companyId,
          status: { in: ["APPROVED", "PAID"] },
        },
        select: {
          id: true,
          amount: true,
          departmentId: true,
          employeeProfileId: true,
        },
      }),
    ]);

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    // 1. Calculate Department Spent & Utilization
    const departmentSpending = departments.map((dept) => {
      const deptExpenses = approvedExpenses.filter((e) => e.departmentId === dept.id);
      const spent = deptExpenses.reduce((acc, e) => acc + e.amount, 0);
      const budget = dept.monthlyBudget || 0;
      const remaining = Math.max(0, budget - spent);
      const utilization = budget > 0 ? (spent / budget) * 100 : 0;

      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        monthlyBudget: budget,
        spent,
        remaining,
        utilization,
        employeeCount: dept.employeeProfiles.length,
      };
    });

    // 2. Calculate Employee Spent & Utilization
    const employeeSpending = employeeProfiles.map((emp) => {
      const empExpenses = approvedExpenses.filter((e) => e.employeeProfileId === emp.id);
      const spent = empExpenses.reduce((acc, e) => acc + e.amount, 0);
      const budget = emp.monthlyBudget || 0;
      const remaining = Math.max(0, budget - spent);
      const utilization = budget > 0 ? (spent / budget) * 100 : 0;

      return {
        id: emp.id,
        userId: emp.userId,
        name: emp.user?.name || "Unknown",
        email: emp.user?.email || "",
        avatarUrl: emp.user?.avatarUrl,
        jobTitle: emp.jobTitle,
        departmentId: emp.departmentId,
        departmentName: emp.department?.name || "Unassigned",
        monthlyBudget: budget,
        spent,
        remaining,
        utilization,
        status: emp.status,
      };
    });

    // 3. Calculate Company Overall Budget & Spent
    const totalDeptBudget = departments.reduce((acc, d) => acc + (d.monthlyBudget || 0), 0);
    const companyBudget = company.monthlyBudget > 0 ? company.monthlyBudget : totalDeptBudget;
    const companySpent = approvedExpenses.reduce((acc, e) => acc + e.amount, 0);
    const companyRemaining = Math.max(0, companyBudget - companySpent);
    const companyUtilization = companyBudget > 0 ? (companySpent / companyBudget) * 100 : 0;

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        currency: company.currency,
        monthlyBudget: companyBudget,
        spent: companySpent,
        remaining: companyRemaining,
        utilization: companyUtilization,
      },
      departments: departmentSpending,
      employees: employeeSpending,
    });
  } catch (error) {
    console.error("GET Budgets Error:", error);
    return NextResponse.json({ error: "Failed to fetch budget hierarchy." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Only FINANCE_ADMIN can update budget allocations
    const { user, errorResponse } = await requireAuth(request, ["FINANCE_ADMIN"]);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const body = await request.json();
    const { entityType, entityId, amount } = body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ error: "Budget amount cannot be negative." }, { status: 400 });
    }

    if (entityType === "COMPANY") {
      const updatedCompany = await prisma.company.update({
        where: { id: user.companyId },
        data: { monthlyBudget: parsedAmount },
      });
      return NextResponse.json({
        success: true,
        message: "Company monthly budget updated successfully.",
        entity: updatedCompany,
      });
    }

    if (entityType === "DEPARTMENT") {
      if (!entityId) {
        return NextResponse.json({ error: "Department ID is required." }, { status: 400 });
      }
      const dept = await prisma.department.findUnique({ where: { id: entityId } });
      if (!dept || dept.companyId !== user.companyId) {
        return NextResponse.json({ error: "Department not found." }, { status: 404 });
      }
      const updatedDept = await prisma.department.update({
        where: { id: entityId },
        data: { monthlyBudget: parsedAmount },
      });
      return NextResponse.json({
        success: true,
        message: "Department monthly budget updated successfully.",
        entity: updatedDept,
      });
    }

    if (entityType === "EMPLOYEE") {
      if (!entityId) {
        return NextResponse.json({ error: "Employee Profile ID is required." }, { status: 400 });
      }
      const emp = await prisma.employeeProfile.findUnique({ where: { id: entityId } });
      if (!emp || emp.companyId !== user.companyId) {
        return NextResponse.json({ error: "Employee profile not found." }, { status: 404 });
      }
      const updatedEmp = await prisma.employeeProfile.update({
        where: { id: entityId },
        data: { monthlyBudget: parsedAmount },
      });
      return NextResponse.json({
        success: true,
        message: "Employee monthly budget updated successfully.",
        entity: updatedEmp,
      });
    }

    return NextResponse.json({ error: "Invalid entityType. Must be COMPANY, DEPARTMENT, or EMPLOYEE." }, { status: 400 });
  } catch (error) {
    console.error("POST Budget Error:", error);
    return NextResponse.json({ error: "Failed to update budget." }, { status: 500 });
  }
}

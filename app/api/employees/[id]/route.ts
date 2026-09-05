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

    const { id } = await params;

    const profile = await prisma.employeeProfile.findFirst({
      where: {
        id,
        companyId: user.companyId!,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
        department: true,
        company: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    // Role-based scope: EMPLOYEE can only view their own profile
    if (user.role === "EMPLOYEE" && profile.userId !== user.id) {
      return NextResponse.json(
        { error: "You do not have permission to view this employee." },
        { status: 403 }
      );
    }

    // Aggregate actual spent from approved and paid expenses
    const spentAgg = await prisma.expense.aggregate({
      where: {
        employeeProfileId: profile.id,
        companyId: user.companyId!,
        status: { in: ["APPROVED", "PAID"] },
      },
      _sum: { amount: true },
    });

    const spentThisMonth = spentAgg._sum.amount || 0;
    const monthlyBudget = profile.monthlyBudget || 0;
    const remainingBudget = Math.max(0, monthlyBudget - spentThisMonth);
    const utilizationRate = monthlyBudget > 0 ? (spentThisMonth / monthlyBudget) * 100 : 0;

    return NextResponse.json({
      id: profile.id,
      userId: profile.userId,
      name: profile.user.name,
      email: profile.user.email,
      role: profile.user.role,
      jobTitle: profile.jobTitle || "Employee",
      departmentId: profile.departmentId,
      department: profile.department,
      company: profile.company,
      monthlyBudget,
      spentThisMonth,
      remainingBudget,
      utilizationRate,
      status: profile.status,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
  } catch (error) {
    console.error("GET employee detail error:", error);
    return NextResponse.json({ error: "Failed to fetch employee details." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(request, ["FINANCE_ADMIN"]);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const body = await request.json();
    const { name, jobTitle, departmentId, role, monthlyBudget, status } = body;

    const profile = await prisma.employeeProfile.findFirst({
      where: { id, companyId: user.companyId! },
      include: { user: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    if (monthlyBudget !== undefined) {
      const parsedBudget = parseFloat(monthlyBudget);
      if (isNaN(parsedBudget) || parsedBudget < 0) {
        return NextResponse.json(
          { error: "Monthly budget cannot be negative." },
          { status: 400 }
        );
      }
    }

    // Update User and EmployeeProfile in transaction
    const updated = await prisma.$transaction(async (tx) => {
      if (name || role) {
        await tx.user.update({
          where: { id: profile.userId },
          data: {
            ...(name && { name: name.trim() }),
            ...(role && { role }),
          },
        });
      }

      return tx.employeeProfile.update({
        where: { id },
        data: {
          ...(jobTitle !== undefined && { jobTitle: jobTitle?.trim() || null }),
          ...(departmentId !== undefined && { departmentId: departmentId || null }),
          ...(monthlyBudget !== undefined && { monthlyBudget: parseFloat(monthlyBudget) }),
          ...(status && { status }),
        },
        include: {
          user: true,
          department: true,
        },
      });
    });

    return NextResponse.json({
      id: updated.id,
      userId: updated.userId,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.user.role,
      jobTitle: updated.jobTitle,
      department: updated.department,
      monthlyBudget: updated.monthlyBudget,
      status: updated.status,
    });
  } catch (error) {
    console.error("PATCH employee error:", error);
    return NextResponse.json({ error: "Failed to update employee." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAuth(request, ["FINANCE_ADMIN"]);
    if (errorResponse) return errorResponse;

    const { id } = await params;

    const profile = await prisma.employeeProfile.findFirst({
      where: { id, companyId: user.companyId! },
    });

    if (!profile) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    // Safe toggle to INACTIVE
    await prisma.employeeProfile.update({
      where: { id },
      data: { status: "INACTIVE" },
    });

    return NextResponse.json({ success: true, message: "Employee marked as inactive." });
  } catch (error) {
    console.error("DELETE employee error:", error);
    return NextResponse.json({ error: "Failed to deactivate employee." }, { status: 500 });
  }
}

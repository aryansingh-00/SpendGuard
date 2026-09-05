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

    const department = await prisma.department.findFirst({
      where: {
        id,
        companyId: user.companyId!,
      },
      include: {
        manager: true,
        employeeProfiles: {
          include: { user: true },
        },
      },
    });

    if (!department) {
      return NextResponse.json({ error: "Department not found." }, { status: 404 });
    }

    return NextResponse.json(department);
  } catch (error) {
    console.error("GET department detail error:", error);
    return NextResponse.json({ error: "Failed to fetch department." }, { status: 500 });
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
    const { name, description, monthlyBudget, code, managerId } = body;

    // Check ownership
    const existing = await prisma.department.findFirst({
      where: { id, companyId: user.companyId! },
    });

    if (!existing) {
      return NextResponse.json({ error: "Department not found." }, { status: 404 });
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

    const updated = await prisma.department.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(monthlyBudget !== undefined && { monthlyBudget: parseFloat(monthlyBudget) }),
        ...(code && { code: code.trim().toUpperCase() }),
        ...(managerId !== undefined && { managerId: managerId || null }),
      },
      include: { manager: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH department error:", error);
    return NextResponse.json({ error: "Failed to update department." }, { status: 500 });
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

    const existing = await prisma.department.findFirst({
      where: { id, companyId: user.companyId! },
      include: {
        _count: {
          select: { employeeProfiles: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Department not found." }, { status: 404 });
    }

    if (existing._count.employeeProfiles > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete department "${existing.name}" because it has ${existing._count.employeeProfiles} active employee(s) assigned. Please reassign them first.`,
        },
        { status: 400 }
      );
    }

    await prisma.department.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Department deleted successfully." });
  } catch (error) {
    console.error("DELETE department error:", error);
    return NextResponse.json({ error: "Failed to delete department." }, { status: 500 });
  }
}

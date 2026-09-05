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

    const policy = await prisma.policy.findUnique({
      where: { id },
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
    });

    if (!policy || policy.companyId !== user.companyId) {
      return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    }

    return NextResponse.json({
      ...policy,
      allowedCategories: JSON.parse(policy.allowedCategories || "[]"),
      blockedCategories: JSON.parse(policy.blockedCategories || "[]"),
      allowedMerchants: JSON.parse(policy.allowedMerchants || "[]"),
      blockedMerchants: JSON.parse(policy.blockedMerchants || "[]"),
    });
  } catch (error) {
    console.error("GET Policy Detail Error:", error);
    return NextResponse.json({ error: "Failed to fetch policy." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only FINANCE_ADMIN can update policies
    const { user, errorResponse } = await requireAuth(request, ["FINANCE_ADMIN"]);
    if (errorResponse) return errorResponse;

    const { id } = await params;

    const existingPolicy = await prisma.policy.findUnique({
      where: { id },
    });

    if (!existingPolicy || existingPolicy.companyId !== user.companyId) {
      return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      description,
      scopeType,
      departmentId,
      employeeProfileId,
      monthlyLimit,
      maxTransactionAmount,
      approvalThreshold,
      allowedCategories,
      blockedCategories,
      allowedMerchants,
      blockedMerchants,
      requireReceiptAbove,
      isActive,
    } = body;

    const updateData: any = {};

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: "Policy name cannot be empty." }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (scopeType !== undefined) {
      const validScopes = ["COMPANY", "DEPARTMENT", "EMPLOYEE"];
      if (!validScopes.includes(scopeType)) {
        return NextResponse.json({ error: "Invalid scope type." }, { status: 400 });
      }
      updateData.scopeType = scopeType;
    }

    if (departmentId !== undefined) {
      if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!dept || dept.companyId !== user.companyId) {
          return NextResponse.json({ error: "Invalid target department." }, { status: 400 });
        }
        updateData.departmentId = dept.id;
      } else {
        updateData.departmentId = null;
      }
    }

    if (employeeProfileId !== undefined) {
      if (employeeProfileId) {
        const emp = await prisma.employeeProfile.findUnique({ where: { id: employeeProfileId } });
        if (!emp || emp.companyId !== user.companyId) {
          return NextResponse.json({ error: "Invalid target employee." }, { status: 400 });
        }
        updateData.employeeProfileId = emp.id;
      } else {
        updateData.employeeProfileId = null;
      }
    }

    if (maxTransactionAmount !== undefined) {
      const parsed = parseFloat(maxTransactionAmount);
      if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json({ error: "Max transaction amount cannot be negative." }, { status: 400 });
      }
      updateData.maxTransactionAmount = parsed;
    }

    if (approvalThreshold !== undefined) {
      const parsed = parseFloat(approvalThreshold);
      if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json({ error: "Approval threshold cannot be negative." }, { status: 400 });
      }
      updateData.approvalThreshold = parsed;
    }

    if (monthlyLimit !== undefined) {
      if (monthlyLimit === null || monthlyLimit === "") {
        updateData.monthlyLimit = null;
      } else {
        const parsed = parseFloat(monthlyLimit);
        if (isNaN(parsed) || parsed < 0) {
          return NextResponse.json({ error: "Monthly limit cannot be negative." }, { status: 400 });
        }
        updateData.monthlyLimit = parsed;
      }
    }

    if (requireReceiptAbove !== undefined) {
      const parsed = parseFloat(requireReceiptAbove);
      updateData.requireReceiptAbove = isNaN(parsed) ? 1000.0 : Math.max(0, parsed);
    }

    if (allowedCategories !== undefined) {
      updateData.allowedCategories = JSON.stringify(
        Array.isArray(allowedCategories) ? allowedCategories.map(String).filter(Boolean) : []
      );
    }

    if (blockedCategories !== undefined) {
      updateData.blockedCategories = JSON.stringify(
        Array.isArray(blockedCategories) ? blockedCategories.map(String).filter(Boolean) : []
      );
    }

    if (allowedMerchants !== undefined) {
      updateData.allowedMerchants = JSON.stringify(
        Array.isArray(allowedMerchants) ? allowedMerchants.map(String).filter(Boolean) : []
      );
    }

    if (blockedMerchants !== undefined) {
      updateData.blockedMerchants = JSON.stringify(
        Array.isArray(blockedMerchants) ? blockedMerchants.map(String).filter(Boolean) : []
      );
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    const updated = await prisma.policy.update({
      where: { id },
      data: updateData,
      include: {
        department: { select: { id: true, name: true, code: true } },
        employeeProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    return NextResponse.json({
      ...updated,
      allowedCategories: JSON.parse(updated.allowedCategories || "[]"),
      blockedCategories: JSON.parse(updated.blockedCategories || "[]"),
      allowedMerchants: JSON.parse(updated.allowedMerchants || "[]"),
      blockedMerchants: JSON.parse(updated.blockedMerchants || "[]"),
    });
  } catch (error) {
    console.error("PATCH Policy Error:", error);
    return NextResponse.json({ error: "Failed to update policy." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only FINANCE_ADMIN can delete policies
    const { user, errorResponse } = await requireAuth(request, ["FINANCE_ADMIN"]);
    if (errorResponse) return errorResponse;

    const { id } = await params;

    const existingPolicy = await prisma.policy.findUnique({
      where: { id },
    });

    if (!existingPolicy || existingPolicy.companyId !== user.companyId) {
      return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    }

    await prisma.policy.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Policy deleted successfully." });
  } catch (error) {
    console.error("DELETE Policy Error:", error);
    return NextResponse.json({ error: "Failed to delete policy." }, { status: 500 });
  }
}

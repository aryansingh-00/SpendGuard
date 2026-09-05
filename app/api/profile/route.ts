import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        company: true,
        employeeProfile: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!fullUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: fullUser.id,
      name: fullUser.name,
      email: fullUser.email,
      role: fullUser.role,
      avatarUrl: fullUser.avatarUrl,
      company: fullUser.company,
      jobTitle: fullUser.employeeProfile?.jobTitle || (fullUser.role === "FINANCE_ADMIN" ? "Finance Controller" : "Team Member"),
      department: fullUser.employeeProfile?.department,
      monthlyBudget: fullUser.employeeProfile?.monthlyBudget || 0,
      status: fullUser.employeeProfile?.status || "ACTIVE",
      createdAt: fullUser.createdAt,
    });
  } catch (error) {
    console.error("GET profile error:", error);
    return NextResponse.json({ error: "Failed to fetch profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { name, jobTitle, avatarUrl, role } = body;

    // Security: strictly prevent users from changing their own role!
    if (role && role !== user.role) {
      return NextResponse.json(
        { error: "You cannot modify your own assigned security role." },
        { status: 403 }
      );
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: user.id },
        data: {
          ...(name && { name: name.trim() }),
          ...(avatarUrl !== undefined && { avatarUrl }),
        },
      });

      if (jobTitle && user.employeeProfile) {
        await tx.employeeProfile.update({
          where: { userId: user.id },
          data: { jobTitle: jobTitle.trim() },
        });
      }

      return u;
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("PATCH profile error:", error);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}

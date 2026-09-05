import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, signToken, COOKIE_NAME } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user?.companyId) {
      return NextResponse.json({ company: null, needsSetup: true });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      include: {
        _count: {
          select: {
            departments: true,
            employeeProfiles: true,
          },
        },
      },
    });

    return NextResponse.json({ company, needsSetup: false });
  } catch (error) {
    console.error("GET company error:", error);
    return NextResponse.json({ error: "Failed to fetch company details." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { name, industry, size, currency } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }

    // 1. Create Company
    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        industry: industry || "Technology",
        size: size || "11-50",
        currency: currency || "INR",
      },
    });

    // 2. Link User as FINANCE_ADMIN to this company
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        companyId: company.id,
        role: "FINANCE_ADMIN",
      },
    });

    // 3. Re-sign JWT Token with companyId
    const token = await signToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role as any,
      companyId: company.id,
    });

    const response = NextResponse.json({
      success: true,
      company,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        companyId: updatedUser.companyId,
      },
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("POST company error:", error);
    return NextResponse.json(
      { error: "Failed to setup company. Please try again." },
      { status: 500 }
    );
  }
}

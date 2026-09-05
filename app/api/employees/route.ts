import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    // Role-based scope:
    // FINANCE_ADMIN & MANAGER see all company employees
    // EMPLOYEE sees only their own employee profile
    const whereClause: Record<string, any> = {
      companyId: user.companyId,
    };

    if (user.role === "EMPLOYEE") {
      whereClause.userId = user.id;
    }

    const profiles = await prisma.employeeProfile.findMany({
      where: whereClause,
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
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user?.name || "",
      email: p.user?.email || "",
      role: p.user?.role || "EMPLOYEE",
      jobTitle: p.jobTitle || "Employee",
      departmentId: p.departmentId,
      department: p.department,
      monthlyBudget: p.monthlyBudget || 0,
      spentThisMonth: 0,
      status: p.status,
      companyId: p.companyId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET employees error:", error);
    return NextResponse.json({ error: "Failed to fetch employees." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request, ["FINANCE_ADMIN"]);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const body = await request.json();
    const { name, email, jobTitle, departmentId, role, monthlyBudget, password } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Employee name is required." }, { status: 400 });
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check duplicate email
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This email is already registered." },
        { status: 409 }
      );
    }

    const parsedBudget = parseFloat(monthlyBudget);
    if (isNaN(parsedBudget) || parsedBudget < 0) {
      return NextResponse.json(
        { error: "Monthly budget cannot be negative." },
        { status: 400 }
      );
    }

    // Verify department belongs to this company if specified
    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, companyId: user.companyId },
      });
      if (!dept) {
        return NextResponse.json({ error: "Selected department not found." }, { status: 400 });
      }
    }

    const validRoles = ["EMPLOYEE", "MANAGER", "FINANCE_ADMIN"];
    const targetRole = validRoles.includes(role) ? role : "EMPLOYEE";

    // Hash default or provided password
    const defaultPassword = password || "Welcome@123";
    const passwordHash = await hashPassword(defaultPassword);

    // Create User & EmployeeProfile in transaction
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          role: targetRole,
          companyId: user.companyId!,
        },
      });

      const profile = await tx.employeeProfile.create({
        data: {
          userId: newUser.id,
          companyId: user.companyId!,
          departmentId: departmentId || null,
          monthlyBudget: parsedBudget,
          jobTitle: jobTitle?.trim() || "Employee",
          status: "ACTIVE",
        },
        include: {
          department: true,
          user: true,
        },
      });

      return profile;
    });

    return NextResponse.json(
      {
        id: result.id,
        userId: result.userId,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        jobTitle: result.jobTitle,
        department: result.department,
        monthlyBudget: result.monthlyBudget,
        spentThisMonth: 0,
        status: result.status,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST employee error:", error);
    return NextResponse.json(
      { error: "Failed to create employee. Please try again." },
      { status: 500 }
    );
  }
}

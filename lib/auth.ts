import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Role } from "@/types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "spendguard_super_secure_jwt_secret_key_2026_finance_controller"
);

const COOKIE_NAME = "spendguard_token";

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: {
  userId: string;
  email: string;
  role: Role;
  companyId?: string | null;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{
  userId: string;
  email: string;
  role: Role;
  companyId?: string | null;
} | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as {
      userId: string;
      email: string;
      role: Role;
      companyId?: string | null;
    };
  } catch (err) {
    console.error("JWT verification error details:", err);
    return null;
  }
}

export async function getSessionUser(request?: Request) {
  let token: string | undefined;

  // 1. Try Authorization header
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  // 2. Try cookie
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    } catch {
      // ignore
    }
  }

  if (!token) return null;

  const verified = await verifyToken(token);
  if (!verified) return null;

  const user = await prisma.user.findUnique({
    where: { id: verified.userId },
    include: {
      company: true,
      employeeProfile: {
        include: {
          department: true,
        },
      },
    },
  });

  return user;
}

export async function requireAuth(
  request?: Request,
  allowedRoles?: Role[]
) {
  const user = await getSessionUser(request);

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Authentication required. Please log in." },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role as Role)) {
      return {
        user: null,
        errorResponse: NextResponse.json(
          { error: "You do not have permission to perform this action." },
          { status: 403 }
        ),
      };
    }
  }

  return { user, errorResponse: null };
}

export { COOKIE_NAME };

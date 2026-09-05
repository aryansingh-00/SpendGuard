import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { evaluateSpendingPolicyFromDB } from "@/lib/policy-engine";

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAuth(request);
    if (errorResponse) return errorResponse;

    if (!user.companyId) {
      return NextResponse.json({ error: "Company setup required." }, { status: 400 });
    }

    const body = await request.json();
    const {
      amount,
      category,
      merchantName,
      purpose,
      employeeProfileId,
      departmentId,
    } = body;

    if (amount === undefined || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "A valid positive transaction amount is required." },
        { status: 400 }
      );
    }

    if (!category || !category.trim()) {
      return NextResponse.json({ error: "Category is required." }, { status: 400 });
    }

    if (!merchantName || !merchantName.trim()) {
      return NextResponse.json({ error: "Merchant name is required." }, { status: 400 });
    }

    const result = await evaluateSpendingPolicyFromDB({
      companyId: user.companyId,
      amount: parseFloat(amount),
      category: category.trim(),
      merchantName: merchantName.trim(),
      purpose: purpose?.trim() || "",
      employeeProfileId: employeeProfileId || undefined,
      departmentId: departmentId || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Policy Evaluation Error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate policy against transaction." },
      { status: 500 }
    );
  }
}

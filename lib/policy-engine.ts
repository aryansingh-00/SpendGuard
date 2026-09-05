import prisma from "@/lib/prisma";

export type DecisionType = "APPROVED" | "APPROVAL_REQUIRED" | "BLOCKED";

export interface PolicyEvaluationRequest {
  companyId: string;
  employeeProfileId?: string;
  departmentId?: string;
  merchantName: string;
  amount: number;
  category: string;
  purpose?: string;
}

export interface RuleCheckResult {
  status: "PASS" | "FAIL" | "TRIGGERED" | "BLOCKED" | "NA";
  details?: string;
}

export interface PolicyEvaluationResult {
  decision: DecisionType;
  reasons: string[];
  summary: string;
  checks: {
    employeeBudget: "PASS" | "FAIL" | "BLOCKED" | "NA";
    departmentBudget: "PASS" | "FAIL" | "BLOCKED" | "NA";
    companyBudget: "PASS" | "FAIL" | "BLOCKED" | "NA";
    transactionLimit: "PASS" | "FAIL" | "TRIGGERED" | "NA";
    category: "PASS" | "TRIGGERED" | "BLOCKED" | "NA";
    merchant: "PASS" | "TRIGGERED" | "BLOCKED" | "NA";
    approvalThreshold: "PASS" | "TRIGGERED" | "NA";
  };
  budgets: {
    company: { budget: number; spent: number; remaining: number };
    department: { budget: number; spent: number; remaining: number };
    employee: { budget: number; spent: number; remaining: number };
  };
  applicablePolicies: Array<{
    id: string;
    name: string;
    scopeType: string;
  }>;
}

export interface PureEvaluationContext {
  amount: number;
  category: string;
  merchantName: string;
  companyBudget: number;
  companySpent: number;
  departmentBudget: number;
  departmentSpent: number;
  employeeBudget: number;
  employeeSpent: number;
  policies: Array<{
    id: string;
    name: string;
    scopeType: string;
    monthlyLimit?: number | null;
    maxTransactionAmount: number;
    approvalThreshold: number;
    allowedCategories: string[];
    blockedCategories: string[];
    allowedMerchants: string[];
    blockedMerchants: string[];
    requireReceiptAbove?: number;
    isActive: boolean;
  }>;
}

/**
 * Pure deterministic evaluation logic.
 * Given amounts, budgets, and parsed policies, calculates exact decision and human-readable explanation.
 */
export function evaluateRulesDeterministically(ctx: PureEvaluationContext): PolicyEvaluationResult {
  const reasons: string[] = [];
  let isBlocked = false;
  let isApprovalRequired = false;

  const checks: PolicyEvaluationResult["checks"] = {
    employeeBudget: "NA",
    departmentBudget: "NA",
    companyBudget: "NA",
    transactionLimit: "PASS",
    category: "PASS",
    merchant: "PASS",
    approvalThreshold: "PASS",
  };

  const remainingEmp = Math.max(0, ctx.employeeBudget - ctx.employeeSpent);
  const remainingDept = Math.max(0, ctx.departmentBudget - ctx.departmentSpent);
  const remainingComp = Math.max(0, ctx.companyBudget - ctx.companySpent);

  // 1. RULE A — Employee Budget Overrun (HARD BLOCK)
  if (ctx.employeeBudget > 0) {
    if (ctx.amount > remainingEmp) {
      isBlocked = true;
      checks.employeeBudget = "BLOCKED";
      reasons.push(
        `✖ Employee monthly budget would be exceeded (Available: ₹${remainingEmp.toLocaleString("en-IN")}, Requested: ₹${ctx.amount.toLocaleString("en-IN")}).`
      );
    } else {
      checks.employeeBudget = "PASS";
      reasons.push(`✓ Employee budget available: ₹${remainingEmp.toLocaleString("en-IN")}`);
    }
  }

  // 2. RULE B — Department Budget Overrun (HARD BLOCK)
  if (ctx.departmentBudget > 0) {
    if (ctx.amount > remainingDept) {
      isBlocked = true;
      checks.departmentBudget = "BLOCKED";
      reasons.push(
        `✖ Department monthly budget would be exceeded (Available: ₹${remainingDept.toLocaleString("en-IN")}, Requested: ₹${ctx.amount.toLocaleString("en-IN")}).`
      );
    } else {
      checks.departmentBudget = "PASS";
      reasons.push(`✓ Department budget available: ₹${remainingDept.toLocaleString("en-IN")}`);
    }
  }

  // 3. RULE C — Company Budget Overrun (HARD BLOCK)
  if (ctx.companyBudget > 0) {
    if (ctx.amount > remainingComp) {
      isBlocked = true;
      checks.companyBudget = "BLOCKED";
      reasons.push(
        `✖ Company monthly budget would be exceeded (Available: ₹${remainingComp.toLocaleString("en-IN")}, Requested: ₹${ctx.amount.toLocaleString("en-IN")}).`
      );
    } else {
      checks.companyBudget = "PASS";
      reasons.push(`✓ Company budget available: ₹${remainingComp.toLocaleString("en-IN")}`);
    }
  }

  // Filter only active policies
  const activePolicies = ctx.policies.filter((p) => p.isActive);
  const applicablePoliciesSummary = activePolicies.map((p) => ({
    id: p.id,
    name: p.name,
    scopeType: p.scopeType,
  }));

  const normCat = ctx.category.trim().toLowerCase();
  const normMerchant = ctx.merchantName.trim().toLowerCase();

  for (const policy of activePolicies) {
    // 4. RULE F — Blocked Category Check (HARD BLOCK)
    const isCatBlocked = policy.blockedCategories.some(
      (c) => c.trim().toLowerCase() === normCat
    );
    if (isCatBlocked) {
      isBlocked = true;
      checks.category = "BLOCKED";
      reasons.push(`✖ Category "${ctx.category}" is strictly blocked by policy "${policy.name}".`);
    }

    // 5. RULE H — Blocked Merchant Check (HARD BLOCK)
    const isMerchantBlocked = policy.blockedMerchants.some(
      (m) => m.trim().toLowerCase() === normMerchant || normMerchant.includes(m.trim().toLowerCase())
    );
    if (isMerchantBlocked) {
      isBlocked = true;
      checks.merchant = "BLOCKED";
      reasons.push(`✖ Merchant "${ctx.merchantName}" is strictly blocked by policy "${policy.name}".`);
    }

    // 6. RULE D — Maximum Single Transaction Amount Check
    if (policy.maxTransactionAmount > 0 && ctx.amount > policy.maxTransactionAmount) {
      isApprovalRequired = true;
      checks.transactionLimit = "TRIGGERED";
      reasons.push(
        `⚠ Transaction amount (₹${ctx.amount.toLocaleString("en-IN")}) exceeds single transaction limit of ₹${policy.maxTransactionAmount.toLocaleString("en-IN")} for "${policy.name}".`
      );
    }

    // 7. RULE E — Approval Threshold Check
    if (policy.approvalThreshold > 0 && ctx.amount > policy.approvalThreshold) {
      isApprovalRequired = true;
      checks.approvalThreshold = "TRIGGERED";
      reasons.push(
        `⚠ Transaction amount (₹${ctx.amount.toLocaleString("en-IN")}) exceeds approval threshold of ₹${policy.approvalThreshold.toLocaleString("en-IN")} for "${policy.name}". Manager approval required.`
      );
    }

    // 8. RULE G — Category Allow-list Check
    if (policy.allowedCategories && policy.allowedCategories.length > 0 && !isCatBlocked) {
      const isCatAllowed = policy.allowedCategories.some(
        (c) => c.trim().toLowerCase() === normCat
      );
      if (isCatAllowed) {
        if (checks.category !== "BLOCKED" && checks.category !== "TRIGGERED") {
          checks.category = "PASS";
        }
        reasons.push(`✓ Category allowed: ${ctx.category}`);
      } else {
        isApprovalRequired = true;
        if (checks.category !== "BLOCKED") {
          checks.category = "TRIGGERED";
        }
        reasons.push(
          `⚠ Category "${ctx.category}" is not in the pre-approved categories list for "${policy.name}". Manager approval required.`
        );
      }
    }

    // 9. RULE I — Merchant Allow-list Check
    if (policy.allowedMerchants && policy.allowedMerchants.length > 0 && !isMerchantBlocked) {
      const isMerchantAllowed = policy.allowedMerchants.some(
        (m) => m.trim().toLowerCase() === normMerchant || normMerchant.includes(m.trim().toLowerCase())
      );
      if (isMerchantAllowed) {
        if (checks.merchant !== "BLOCKED" && checks.merchant !== "TRIGGERED") {
          checks.merchant = "PASS";
        }
        reasons.push(`✓ Merchant allowed: ${ctx.merchantName}`);
      } else {
        isApprovalRequired = true;
        if (checks.merchant !== "BLOCKED") {
          checks.merchant = "TRIGGERED";
        }
        reasons.push(
          `⚠ Merchant "${ctx.merchantName}" is not on the pre-approved merchant list for "${policy.name}". Manager approval required.`
        );
      }
    }
  }

  // Deterministic Decision Priority: BLOCKED > APPROVAL_REQUIRED > APPROVED
  let decision: DecisionType = "APPROVED";
  if (isBlocked) {
    decision = "BLOCKED";
  } else if (isApprovalRequired) {
    decision = "APPROVAL_REQUIRED";
  } else {
    decision = "APPROVED";
  }

  // Deduplicate reasons
  const uniqueReasons = Array.from(new Set(reasons));

  const summary =
    decision === "BLOCKED"
      ? "BLOCKED: Hard spending policy or budget limit violated."
      : decision === "APPROVAL_REQUIRED"
      ? "APPROVAL REQUIRED: Transaction exceeds approval threshold or contains unlisted items."
      : "APPROVED: Fully compliant with all corporate spending rules and budget allocations.";

  return {
    decision,
    reasons: uniqueReasons,
    summary,
    checks,
    budgets: {
      company: {
        budget: ctx.companyBudget,
        spent: ctx.companySpent,
        remaining: remainingComp,
      },
      department: {
        budget: ctx.departmentBudget,
        spent: ctx.departmentSpent,
        remaining: remainingDept,
      },
      employee: {
        budget: ctx.employeeBudget,
        spent: ctx.employeeSpent,
        remaining: remainingEmp,
      },
    },
    applicablePolicies: applicablePoliciesSummary,
  };
}

/**
 * Evaluates an expense request directly from the database context.
 * Computes live spent amounts from existing expenses to guarantee dynamic, non-fabricated data.
 */
export async function evaluateSpendingPolicyFromDB(
  request: PolicyEvaluationRequest
): Promise<PolicyEvaluationResult> {
  const { companyId, employeeProfileId, departmentId, merchantName, amount, category } = request;

  // 1. Fetch Company details & budget
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      departments: true,
    },
  });

  if (!company) {
    throw new Error("Company not found.");
  }

  // Calculate Company Monthly Budget: company.monthlyBudget or sum of all department budgets
  const sumDeptBudgets = company.departments.reduce((acc, d) => acc + (d.monthlyBudget || 0), 0);
  const companyBudget = company.monthlyBudget > 0 ? company.monthlyBudget : sumDeptBudgets;

  // Calculate Company Current Spent (sum of approved / ready / paid expenses)
  const companySpentAgg = await prisma.expense.aggregate({
    where: {
      companyId,
      status: { in: ["APPROVED", "READY_FOR_PAYMENT", "PAID"] },
    },
    _sum: { amount: true },
  });
  const companySpent = companySpentAgg._sum.amount || 0;

  // 2. Fetch Employee Profile & live spending
  let employeeBudget = 0;
  let employeeSpent = 0;
  let resolvedDeptId = departmentId;

  if (employeeProfileId) {
    const empProfile = await prisma.employeeProfile.findUnique({
      where: { id: employeeProfileId },
      include: { department: true },
    });

    if (empProfile && empProfile.companyId === companyId) {
      employeeBudget = empProfile.monthlyBudget || 0;
      if (!resolvedDeptId && empProfile.departmentId) {
        resolvedDeptId = empProfile.departmentId;
      }

      const empSpentAgg = await prisma.expense.aggregate({
        where: {
          employeeProfileId,
          companyId,
          status: { in: ["APPROVED", "READY_FOR_PAYMENT", "PAID"] },
        },
        _sum: { amount: true },
      });
      employeeSpent = empSpentAgg._sum.amount || 0;
    }
  }

  // 3. Fetch Department details & live spending
  let departmentBudget = 0;
  let departmentSpent = 0;

  if (resolvedDeptId) {
    const dept = await prisma.department.findUnique({
      where: { id: resolvedDeptId },
    });

    if (dept && dept.companyId === companyId) {
      departmentBudget = dept.monthlyBudget || 0;

      const deptSpentAgg = await prisma.expense.aggregate({
        where: {
          departmentId: resolvedDeptId,
          companyId,
          status: { in: ["APPROVED", "READY_FOR_PAYMENT", "PAID"] },
        },
        _sum: { amount: true },
      });
      departmentSpent = deptSpentAgg._sum.amount || 0;
    }
  }

  // 4. Fetch Applicable Policies
  // Policies can target: (1) specific employee, (2) specific department, or (3) company-wide
  const policyFilter: any = {
    companyId,
    isActive: true,
    OR: [{ scopeType: "COMPANY" }],
  };

  if (resolvedDeptId) {
    policyFilter.OR.push({
      scopeType: "DEPARTMENT",
      departmentId: resolvedDeptId,
    });
  }

  if (employeeProfileId) {
    policyFilter.OR.push({
      scopeType: "EMPLOYEE",
      employeeProfileId,
    });
  }

  const rawPolicies = await prisma.policy.findMany({
    where: policyFilter,
  });

  const parsedPolicies = rawPolicies.map((p) => {
    let allowedCategories: string[] = [];
    let blockedCategories: string[] = [];
    let allowedMerchants: string[] = [];
    let blockedMerchants: string[] = [];

    try {
      allowedCategories = JSON.parse(p.allowedCategories || "[]");
    } catch {
      allowedCategories = [];
    }

    try {
      blockedCategories = JSON.parse(p.blockedCategories || "[]");
    } catch {
      blockedCategories = [];
    }

    try {
      allowedMerchants = JSON.parse(p.allowedMerchants || "[]");
    } catch {
      allowedMerchants = [];
    }

    try {
      blockedMerchants = JSON.parse(p.blockedMerchants || "[]");
    } catch {
      blockedMerchants = [];
    }

    return {
      id: p.id,
      name: p.name,
      scopeType: p.scopeType,
      monthlyLimit: p.monthlyLimit,
      maxTransactionAmount: p.maxTransactionAmount,
      approvalThreshold: p.approvalThreshold,
      allowedCategories,
      blockedCategories,
      allowedMerchants,
      blockedMerchants,
      requireReceiptAbove: p.requireReceiptAbove,
      isActive: p.isActive,
    };
  });

  return evaluateRulesDeterministically({
    amount,
    category,
    merchantName,
    companyBudget,
    companySpent,
    departmentBudget,
    departmentSpent,
    employeeBudget,
    employeeSpent,
    policies: parsedPolicies,
  });
}

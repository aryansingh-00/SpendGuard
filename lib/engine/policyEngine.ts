import { PolicyCheckResult, Decision } from "@/types";

export interface PolicyEvaluationInput {
  amount: number;
  category: string;
  merchantName: string;
  hasReceipt: boolean;
  departmentBudget: number;
  departmentSpent: number;
  employeeBudget: number;
  employeeSpent: number;
  policy: {
    maxTransactionAmount: number;
    approvalThreshold: number;
    allowedCategories: string[];
    blockedCategories: string[];
    requireReceiptAbove: number;
    isActive: boolean;
  } | null;
}

/**
 * Deterministic Financial Spending Policy Engine
 * Evaluates hard financial rules, category blocks, budget limits, and approval thresholds.
 * Never relies exclusively on AI for hard policy enforcement.
 */
export function evaluateSpendingPolicy(input: PolicyEvaluationInput): PolicyCheckResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  const remainingDeptBudget = Math.max(0, input.departmentBudget - input.departmentSpent);
  const remainingEmpBudget = Math.max(0, input.employeeBudget - input.employeeSpent);

  let categoryBlocked = false;
  let budgetExceeded = false;
  let thresholdExceeded = false;
  let receiptRequired = false;

  const policy = input.policy || {
    maxTransactionAmount: 50000,
    approvalThreshold: 10000,
    allowedCategories: ["Advertising", "Software", "Cloud Infrastructure", "Travel", "Meals", "Office Supplies"],
    blockedCategories: ["Gambling", "Cryptocurrency", "Personal Expenses", "Adult Entertainment"],
    requireReceiptAbove: 1000,
    isActive: true,
  };

  // 1. HARD RULE: Check Explicitly Blocked Categories
  const normalizedCategory = input.category.trim().toLowerCase();
  const isBlockedCategory = policy.blockedCategories.some(
    (c) => c.toLowerCase() === normalizedCategory
  );

  if (isBlockedCategory) {
    categoryBlocked = true;
    violations.push(`Category "${input.category}" is strictly prohibited by corporate spending policy.`);
  }

  // 2. HARD RULE: Check Department / Employee Budget Overrun
  if (input.departmentBudget > 0 && input.amount > remainingDeptBudget) {
    budgetExceeded = true;
    violations.push(
      `Transaction amount (₹${input.amount.toLocaleString("en-IN")}) exceeds department remaining budget (₹${remainingDeptBudget.toLocaleString("en-IN")}).`
    );
  }

  if (input.employeeBudget > 0 && input.amount > remainingEmpBudget) {
    budgetExceeded = true;
    warnings.push(
      `Transaction amount exceeds employee personal remaining budget (₹${remainingEmpBudget.toLocaleString("en-IN")}).`
    );
  }

  // 3. HARD RULE: Check Maximum Single Transaction Limit
  if (policy.maxTransactionAmount > 0 && input.amount > policy.maxTransactionAmount) {
    violations.push(
      `Amount (₹${input.amount.toLocaleString("en-IN")}) exceeds the single transaction limit of ₹${policy.maxTransactionAmount.toLocaleString("en-IN")}.`
    );
  }

  // 4. RULE: Check Category Allowed List
  if (policy.allowedCategories.length > 0) {
    const isAllowed = policy.allowedCategories.some(
      (c) => c.toLowerCase() === normalizedCategory
    );
    if (!isAllowed && !isBlockedCategory) {
      warnings.push(
        `Category "${input.category}" is not in the standard pre-approved categories list for this department.`
      );
    }
  }

  // 5. RULE: Check Approval Threshold
  if (policy.approvalThreshold > 0 && input.amount > policy.approvalThreshold) {
    thresholdExceeded = true;
    warnings.push(
      `Amount (₹${input.amount.toLocaleString("en-IN")}) exceeds instant approval threshold of ₹${policy.approvalThreshold.toLocaleString("en-IN")}. Manager sign-off required.`
    );
  }

  // 6. RULE: Check Receipt Requirement
  if (policy.requireReceiptAbove > 0 && input.amount > policy.requireReceiptAbove && !input.hasReceipt) {
    receiptRequired = true;
    warnings.push(
      `Receipt is required for expenses above ₹${policy.requireReceiptAbove.toLocaleString("en-IN")}.`
    );
  }

  // Determine Final Decision
  let decision: Decision = "APPROVE";
  let requiresApproval = false;

  if (categoryBlocked || (budgetExceeded && input.amount > remainingDeptBudget * 1.2)) {
    decision = "BLOCK";
  } else if (violations.length > 0 || thresholdExceeded || budgetExceeded || warnings.length > 0) {
    decision = "APPROVAL_REQUIRED";
    requiresApproval = true;
  } else {
    decision = "APPROVE";
  }

  const passed = violations.length === 0;

  const summary =
    decision === "BLOCK"
      ? `Blocked: ${violations.join(" ")}`
      : decision === "APPROVAL_REQUIRED"
      ? `Approval Required: ${[...violations, ...warnings].join(" ")}`
      : "Compliant: Meets all spending policies, single transaction limits, and department budget constraints.";

  return {
    passed,
    decision,
    violations,
    warnings,
    requiresApproval,
    thresholdExceeded,
    budgetExceeded,
    categoryBlocked,
    receiptRequired,
    summary,
  };
}

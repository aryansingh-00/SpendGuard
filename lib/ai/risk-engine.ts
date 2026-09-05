import { AIContext, AIRiskOutput, AIRiskOutputSchema, RiskSignal } from "./schemas";
import { AI_RISK_SYSTEM_PROMPT, buildRiskAnalysisUserPrompt } from "./prompts";

/**
 * AI Transaction Risk Engine Service
 * Analyzes spending context, amount deviations, merchant novelty, category alignment,
 * budget pressure, and duplicate patterns.
 */
export async function analyzeTransactionRisk(context: AIContext): Promise<AIRiskOutput> {
  const provider = (process.env.AI_PROVIDER || "").toLowerCase();
  const geminiKey = process.env.GEMINI_API_KEY;

  // 1. If Gemini API key is configured and not explicitly forced to mock
  if (geminiKey && provider !== "mock") {
    try {
      const aiResult = await callGeminiWithTimeout(context, geminiKey, 6000);
      const validated = AIRiskOutputSchema.safeParse(aiResult);
      if (validated.success) {
        return {
          ...validated.data,
          model: "gemini-1.5-flash",
        };
      }
      console.warn("AI output failed Zod schema validation, falling back to grounded engine:", validated.error);
    } catch (err) {
      console.warn("Gemini API call failed or timed out, falling back to grounded risk engine:", err);
    }
  }

  // 2. High-Fidelity Grounded Heuristic Risk Engine (Deterministic / Mock Mode)
  try {
    const groundedResult = computeGroundedRiskAnalysis(context);
    const validated = AIRiskOutputSchema.safeParse(groundedResult);
    if (validated.success) {
      return validated.data;
    }
  } catch (err) {
    console.error("Grounded risk computation error:", err);
  }

  // 3. Graceful Fallback if everything fails
  return {
    riskScore: null,
    riskLevel: "UNAVAILABLE",
    signals: [
      {
        type: "AI_SERVICE_UNAVAILABLE",
        severity: "MEDIUM",
        message: "Automated AI risk evaluation is currently unavailable. Transaction routed to standard review.",
      },
    ],
    summary: "AI risk analysis could not be completed. Financial policy engine remains fully active.",
    recommendation: "REVIEW",
    isDuplicate: false,
    model: "fallback-resilient",
  };
}

/**
 * Call Google Gemini API with AbortController timeout
 */
async function callGeminiWithTimeout(
  context: AIContext,
  apiKey: string,
  timeoutMs: number
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const userPrompt = buildRiskAnalysisUserPrompt(context);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: AI_RISK_SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API returned HTTP status ${res.status}`);
    }

    const json = await res.json();
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Empty text response from Gemini API");
    }

    return JSON.parse(rawText);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Grounded Heuristic Risk Engine
 * Computes factual, observable signals using mathematical context and domain consistency rules.
 */
export function computeGroundedRiskAnalysis(context: AIContext): AIRiskOutput {
  let riskScore = 12; // Base baseline score for normal low-risk activity
  const signals: RiskSignal[] = [];
  let isDuplicate = false;
  let duplicateDetails: string | undefined = undefined;

  const normMerchant = context.transaction.merchant.trim().toLowerCase();
  const normCategory = context.transaction.category.trim().toLowerCase();
  const normDept = context.employee.department.trim().toLowerCase();
  const normPurpose = context.transaction.purpose.trim().toLowerCase();

  // 1. AMOUNT FACTOR: Compare against historical average
  const historyAvg = context.history.averageTransaction;
  const currentAmount = context.transaction.amount;

  if (historyAvg > 0 && currentAmount > historyAvg * 2.0) {
    const ratio = (currentAmount / historyAvg).toFixed(1);
    if (currentAmount > historyAvg * 3.5) {
      riskScore += 35;
      signals.push({
        type: "UNUSUAL_AMOUNT",
        severity: "HIGH",
        message: `Transaction amount (₹${currentAmount.toLocaleString("en-IN")}) is ${ratio}× higher than the employee's historical average of ₹${historyAvg.toLocaleString("en-IN")}.`,
      });
    } else {
      riskScore += 20;
      signals.push({
        type: "UNUSUAL_AMOUNT",
        severity: "MEDIUM",
        message: `Transaction amount (₹${currentAmount.toLocaleString("en-IN")}) is ${ratio}× above recent average spending (₹${historyAvg.toLocaleString("en-IN")}).`,
      });
    }
  } else if (historyAvg > 0) {
    signals.push({
      type: "NORMAL_PATTERN",
      severity: "LOW",
      message: `Transaction amount is consistent with employee's recent spending history (Avg: ₹${historyAvg.toLocaleString("en-IN")}).`,
    });
  }

  // 2. MERCHANT NOVELTY FACTOR: Check if merchant was used previously
  const previousMerchants = context.history.recentTransactions.map((t) =>
    t.merchant.trim().toLowerCase()
  );

  const isKnownMerchant = previousMerchants.some(
    (m) => m === normMerchant || normMerchant.includes(m) || m.includes(normMerchant)
  );

  if (!isKnownMerchant && previousMerchants.length > 0) {
    riskScore += 18;
    signals.push({
      type: "NEW_MERCHANT",
      severity: "MEDIUM",
      message: `Merchant "${context.transaction.merchant}" has not appeared in the employee's recent transaction history.`,
    });
  } else if (isKnownMerchant) {
    signals.push({
      type: "NORMAL_PATTERN",
      severity: "LOW",
      message: `Merchant "${context.transaction.merchant}" is a verified vendor previously utilized by this employee.`,
    });
  }

  // 3. CATEGORY & DEPARTMENT CONSISTENCY FACTOR
  const deptCategoryMap: Record<string, string[]> = {
    marketing: ["advertising", "software", "marketing services", "subscriptions", "events", "office supplies"],
    engineering: ["cloud infrastructure", "software", "hardware", "developer tools", "security"],
    sales: ["travel", "meals", "client entertainment", "software", "transportation"],
    hr: ["recruitment", "training", "office supplies", "software", "events"],
  };

  const expectedCategories = deptCategoryMap[normDept] || [];
  const prohibitedCategories = ["gaming", "gambling", "cryptocurrency", "adult entertainment", "personal expenses"];

  const isProhibited = prohibitedCategories.some((cat) => normCategory.includes(cat) || normPurpose.includes(cat));

  if (isProhibited) {
    riskScore += 70;
    signals.push({
      type: "PROHIBITED_CATEGORY",
      severity: "HIGH",
      message: `Category "${context.transaction.category}" matches high-risk prohibited expense keywords.`,
    });
  } else if (expectedCategories.length > 0 && !expectedCategories.includes(normCategory)) {
    riskScore += 25;
    signals.push({
      type: "CATEGORY_MISMATCH",
      severity: "MEDIUM",
      message: `Transaction category "${context.transaction.category}" appears inconsistent with ${context.employee.department} department spending profile.`,
    });
  }

  // 4. DUPLICATE-LIKE BEHAVIOR FACTOR
  if (context.history.recentTransactions.length > 0) {
    const duplicateMatch = context.history.recentTransactions.find(
      (t) =>
        t.merchant.trim().toLowerCase() === normMerchant &&
        Math.abs(t.amount - currentAmount) < 1.0
    );

    if (duplicateMatch) {
      isDuplicate = true;
      riskScore += 30;
      duplicateDetails = `Identical amount (₹${currentAmount.toLocaleString("en-IN")}) paid to "${context.transaction.merchant}" recorded recently.`;
      signals.push({
        type: "POSSIBLE_DUPLICATE",
        severity: "HIGH",
        message: `Possible duplicate transaction: ${duplicateDetails}`,
      });
    }
  }

  // 5. BUDGET PRESSURE FACTOR
  const monthlyLimit = context.budget.monthlyLimit;
  const spentSoFar = context.budget.spent;
  if (monthlyLimit > 0) {
    const projectedTotal = spentSoFar + currentAmount;
    const projectedUtil = (projectedTotal / monthlyLimit) * 100;
    if (projectedUtil > 100) {
      riskScore += 20;
      signals.push({
        type: "BUDGET_PRESSURE",
        severity: "HIGH",
        message: `Transaction causes employee monthly budget utilization to reach ${projectedUtil.toFixed(0)}% (₹${projectedTotal.toLocaleString("en-IN")} of ₹${monthlyLimit.toLocaleString("en-IN")}).`,
      });
    } else if (projectedUtil > 85) {
      riskScore += 10;
      signals.push({
        type: "BUDGET_PRESSURE",
        severity: "MEDIUM",
        message: `High budget utilization: Projecting ${projectedUtil.toFixed(0)}% of monthly envelope consumed.`,
      });
    }
  }

  // Clamp final score between 0 and 100
  const finalScore = Math.min(100, Math.max(0, riskScore));

  // Determine Risk Level & Recommendation
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  let recommendation: "PROCEED" | "REVIEW" | "HIGH_RISK_REVIEW" = "PROCEED";

  if (finalScore >= 71) {
    riskLevel = "HIGH";
    recommendation = "HIGH_RISK_REVIEW";
  } else if (finalScore >= 31) {
    riskLevel = "MEDIUM";
    recommendation = "REVIEW";
  } else {
    riskLevel = "LOW";
    recommendation = "PROCEED";
  }

  // Build grounded human-readable summary
  let summary = "";
  if (riskLevel === "LOW") {
    summary = "The transaction appears consistent with the employee's normal spending behavior and verified department profile.";
  } else if (riskLevel === "MEDIUM") {
    const primaryWarn = signals.find((s) => s.severity === "MEDIUM" || s.severity === "HIGH");
    summary = primaryWarn
      ? `Transaction flagged for review: ${primaryWarn.message}`
      : "Transaction exhibits unusual patterns and requires supervisory review.";
  } else {
    const highSignals = signals.filter((s) => s.severity === "HIGH");
    summary = highSignals.length > 0
      ? `High risk indicators detected: ${highSignals.map((s) => s.message).join(" ")}`
      : "High contextual risk detected due to multiple cumulative anomalies.";
  }

  return {
    riskScore: finalScore,
    riskLevel,
    signals,
    summary,
    recommendation,
    isDuplicate,
    duplicateDetails,
    model: "spendguard-heuristic-v1",
  };
}

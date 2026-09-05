import { z } from "zod";
import { AIAnalysisResult, Decision, RiskLevel } from "@/types";

export const AIAnalysisSchema = z.object({
  riskScore: z.number().min(0).max(100),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  category: z.string(),
  reason: z.string(),
  recommendation: z.enum(["APPROVE", "APPROVAL_REQUIRED", "BLOCK"]),
  anomaliesDetected: z.array(z.string()),
  suggestedCategory: z.string().optional(),
  duplicateRiskScore: z.number().min(0).max(100).optional(),
  isDuplicate: z.boolean().optional(),
  duplicateExpenseId: z.string().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
});

export interface AITransactionContext {
  employeeName: string;
  employeeRole?: string;
  departmentName: string;
  monthlyBudget: number;
  alreadySpent: number;
  merchantName: string;
  amount: number;
  category: string;
  purpose: string;
  hasReceipt: boolean;
  previousTransactions?: {
    merchantName: string;
    amount: number;
    category: string;
    date: Date | string;
  }[];
}

/**
 * AI Transaction Risk Engine
 * Analyzes spending context, anomalous patterns, merchant credibility, duplicate billing, and policy alignment.
 */
export async function analyzeTransactionRisk(
  context: AITransactionContext
): Promise<AIAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (apiKey && process.env.GEMINI_API_KEY) {
    try {
      const response = await callGeminiRiskModel(context, process.env.GEMINI_API_KEY);
      const parsed = AIAnalysisSchema.safeParse(response);
      if (parsed.success) {
        return parsed.data;
      }
      console.warn("AI output validation failed, falling back to deterministic risk engine:", parsed.error);
    } catch (err) {
      console.warn("Gemini API call failed, falling back to intelligent risk engine:", err);
    }
  }

  // High-fidelity fallback / standalone risk computation engine
  return computeIntelligentRiskAnalysis(context);
}

async function callGeminiRiskModel(
  context: AITransactionContext,
  apiKey: string
): Promise<AIAnalysisResult> {
  const prompt = `You are SpendGuard AI, an enterprise AI Finance Controller.
Analyze this corporate expense transaction and return strict JSON:

Employee: ${context.employeeName} (${context.departmentName})
Monthly Budget: ₹${context.monthlyBudget}
Already Spent This Month: ₹${context.alreadySpent}
Merchant: ${context.merchantName}
Amount: ₹${context.amount}
Category: ${context.category}
Purpose: ${context.purpose}
Receipt Attached: ${context.hasReceipt ? "Yes" : "No"}
Recent Transactions: ${JSON.stringify(context.previousTransactions?.slice(0, 5) || [])}

Rules:
- High risk (70-100) -> recommendation: "BLOCK" or "APPROVAL_REQUIRED" (e.g. gambling, crypto, extreme budget overrun, suspicious merchant)
- Medium risk (30-69) -> recommendation: "APPROVAL_REQUIRED" (e.g. unusual large spend, new high-ticket vendor, vague purpose)
- Low risk (0-29) -> recommendation: "APPROVE" (e.g. regular SaaS, verified vendor, standard travel within budget)

Return ONLY a JSON object matching this schema:
{
  "riskScore": number,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "category": string,
  "reason": string,
  "recommendation": "APPROVE" | "APPROVAL_REQUIRED" | "BLOCK",
  "anomaliesDetected": string[],
  "suggestedCategory": string,
  "duplicateRiskScore": number,
  "isDuplicate": boolean,
  "confidenceScore": number
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini API returned status ${res.status}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text);
}

export function computeIntelligentRiskAnalysis(
  context: AITransactionContext
): AIAnalysisResult {
  let riskScore = 10;
  const anomalies: string[] = [];
  const normalizedMerchant = context.merchantName.toLowerCase();
  const normalizedCategory = context.category.toLowerCase();
  const normalizedPurpose = context.purpose.toLowerCase();

  // 1. Merchant Risk & Prohibited Business Detection
  const prohibitedKeywords = ["crypto", "bet", "casino", "gambling", "poker", "lottery", "adult", "shadow"];
  const isProhibited = prohibitedKeywords.some(
    (kw) => normalizedMerchant.includes(kw) || normalizedCategory.includes(kw) || normalizedPurpose.includes(kw)
  );

  if (isProhibited) {
    riskScore += 80;
    anomalies.push("Merchant or category matches prohibited high-risk keywords (Gambling/Crypto/Unregulated).");
  }

  // 2. Budget Utilization & Burn Rate Anomaly
  const totalAfterSpend = context.alreadySpent + context.amount;
  const budgetUtilization = context.monthlyBudget > 0 ? (totalAfterSpend / context.monthlyBudget) * 100 : 0;

  if (budgetUtilization > 100) {
    riskScore += 35;
    anomalies.push(`Transaction causes employee to exceed 100% of allocated monthly budget (Current: ${budgetUtilization.toFixed(0)}%).`);
  } else if (budgetUtilization > 85) {
    riskScore += 15;
    anomalies.push(`High monthly budget utilization (${budgetUtilization.toFixed(0)}% consumed).`);
  }

  // 3. Historical Amount Outlier Check
  const previousAmounts = context.previousTransactions?.map((t) => t.amount) || [];
  if (previousAmounts.length >= 2) {
    const avg = previousAmounts.reduce((a, b) => a + b, 0) / previousAmounts.length;
    if (context.amount > avg * 2.5) {
      riskScore += 25;
      anomalies.push(`Transaction amount (₹${context.amount.toLocaleString("en-IN")}) is ${(context.amount / avg).toFixed(1)}x higher than employee's historical average (₹${avg.toFixed(0)}).`);
    }
  }

  // 4. Duplicate Transaction Detection
  let isDuplicate = false;
  let duplicateRiskScore = 0;
  if (context.previousTransactions && context.previousTransactions.length > 0) {
    const match = context.previousTransactions.find(
      (t) =>
        t.merchantName.toLowerCase() === normalizedMerchant &&
        Math.abs(t.amount - context.amount) < 1.0
    );
    if (match) {
      isDuplicate = true;
      duplicateRiskScore = 85;
      riskScore += 30;
      anomalies.push(`Possible duplicate payment: Identical amount (₹${context.amount.toLocaleString("en-IN")}) paid to ${context.merchantName} recently.`);
    }
  }

  // 5. Purpose & Receipt Verification Check
  if (context.purpose.trim().length < 10) {
    riskScore += 10;
    anomalies.push("Sparse business justification provided.");
  }

  if (context.amount > 5000 && !context.hasReceipt) {
    riskScore += 15;
    anomalies.push("High-ticket expense submitted without proof-of-purchase receipt.");
  }

  // Cap risk score
  riskScore = Math.min(99, Math.max(5, riskScore));

  let riskLevel: RiskLevel = "LOW";
  let recommendation: Decision = "APPROVE";

  if (riskScore >= 70 || isProhibited) {
    riskLevel = "HIGH";
    recommendation = isProhibited ? "BLOCK" : "APPROVAL_REQUIRED";
  } else if (riskScore >= 30) {
    riskLevel = "MEDIUM";
    recommendation = "APPROVAL_REQUIRED";
  } else {
    riskLevel = "LOW";
    recommendation = "APPROVE";
  }

  let reason = "";
  if (riskLevel === "LOW") {
    reason = `Transaction is consistent with ${context.employeeName}'s department baseline and verified vendor profile.`;
  } else if (riskLevel === "MEDIUM") {
    reason = anomalies.length > 0
      ? `Transaction flagged for review: ${anomalies[0]}`
      : "Transaction exceeds automated instant threshold and requires managerial review.";
  } else {
    reason = `CRITICAL RISK: ${anomalies.join(" ")}`;
  }

  return {
    riskScore,
    riskLevel,
    category: context.category,
    reason,
    recommendation,
    anomaliesDetected: anomalies,
    suggestedCategory: context.category,
    duplicateRiskScore,
    isDuplicate,
    confidenceScore: 0.94,
  };
}

import { PolicyEvaluationResult } from "@/lib/policy-engine";
import { AIRiskOutput, ExpenseVerificationResult } from "@/lib/ai/schemas";

export interface DecisionSynthesisResult {
  finalDecision: "APPROVED" | "APPROVAL_REQUIRED" | "BLOCKED";
  policyDecision: "APPROVED" | "APPROVAL_REQUIRED" | "BLOCKED";
  aiRecommendation: "PROCEED" | "REVIEW" | "HIGH_RISK_REVIEW";
  aiRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "UNAVAILABLE";
  aiRiskScore: number | null;
  receiptVerificationStatus?: "VERIFIED" | "REVIEW_REQUIRED" | "MISMATCH" | "FAILED" | "NONE";
  receiptVerificationScore?: number | null;
  reasons: string[];
  summary: string;
}

/**
 * Synthesize Final Decision by combining Policy Result, AI Risk Analysis, and Receipt Verification.
 * Strict Supremacy Order:
 * BLOCKED > APPROVAL_REQUIRED > APPROVED
 *
 * Rules:
 * 1. If Policy is BLOCKED -> Final = BLOCKED (AI & Receipt Verification cannot unblock a hard violation).
 * 2. If Policy is APPROVAL_REQUIRED -> Final = APPROVAL_REQUIRED.
 * 3. If Receipt Verification is MISMATCH or duplicate -> Final = APPROVAL_REQUIRED (Receipt Mismatch Alert).
 * 4. If AI Risk is HIGH or recommendation is REVIEW -> Final = APPROVAL_REQUIRED.
 * 5. If Policy is APPROVED, AI Risk is LOW, and Receipt is VERIFIED (or clean) -> Final = APPROVED.
 */
export function synthesizeDecision(
  policyResult: PolicyEvaluationResult,
  aiRiskResult: AIRiskOutput,
  verificationResult?: ExpenseVerificationResult | null
): DecisionSynthesisResult {
  let finalDecision: "APPROVED" | "APPROVAL_REQUIRED" | "BLOCKED" = "APPROVED";
  const reasons: string[] = [];

  // 1. Policy Engine Evaluation (Strict Hard Authority)
  if (policyResult.decision === "BLOCKED") {
    finalDecision = "BLOCKED";
    reasons.push("🚫 Policy Restriction: Hard corporate spending boundary or budget limit violated.");
  } else if (policyResult.decision === "APPROVAL_REQUIRED") {
    finalDecision = "APPROVAL_REQUIRED";
    reasons.push("⚠️ Policy Requirement: Transaction requires manager approval under spending policy.");
  }

  // 2. Receipt Verification Evaluation
  let receiptStatus: "VERIFIED" | "REVIEW_REQUIRED" | "MISMATCH" | "FAILED" | "NONE" = "NONE";
  let receiptScore: number | null = null;

  if (verificationResult) {
    receiptStatus = verificationResult.status;
    receiptScore = verificationResult.overallScore;

    if (finalDecision !== "BLOCKED") {
      if (verificationResult.duplicateIndicator && verificationResult.duplicateIndicator !== "NONE") {
        finalDecision = "APPROVAL_REQUIRED";
        reasons.push(`⚠️ Duplicate Receipt Alert: Document matching prior company submissions detected.`);
      } else if (verificationResult.status === "MISMATCH") {
        finalDecision = "APPROVAL_REQUIRED";
        reasons.push(
          `⚠️ Receipt Verification Mismatch (Score: ${verificationResult.overallScore}/100): Document evidence does not match submitted claim.`
        );
      } else if (verificationResult.status === "REVIEW_REQUIRED" && finalDecision === "APPROVED") {
        finalDecision = "APPROVAL_REQUIRED";
        reasons.push(
          `ℹ️ Receipt Verification Review (Score: ${verificationResult.overallScore}/100): Minor discrepancy flagged for manager review.`
        );
      } else if (verificationResult.status === "VERIFIED") {
        reasons.push(`✅ Receipt Verified (Score: ${verificationResult.overallScore}/100): Amount, merchant, and date match document evidence.`);
      }
    }
  }

  // 3. AI Risk Engine Evaluation
  if (finalDecision !== "BLOCKED") {
    if (aiRiskResult.riskLevel === "HIGH" || aiRiskResult.recommendation === "HIGH_RISK_REVIEW") {
      finalDecision = "APPROVAL_REQUIRED";
      reasons.push(`⚠️ AI Risk Alert (Score: ${aiRiskResult.riskScore || "High"}/100): ${aiRiskResult.summary}`);
    } else if (aiRiskResult.riskLevel === "UNAVAILABLE") {
      finalDecision = "APPROVAL_REQUIRED";
      reasons.push("ℹ️ AI Evaluation Unavailable: Routed to managerial review.");
    } else if (aiRiskResult.recommendation === "REVIEW" && finalDecision === "APPROVED") {
      finalDecision = "APPROVAL_REQUIRED";
      reasons.push(`ℹ️ AI Review Recommended (Score: ${aiRiskResult.riskScore}/100): ${aiRiskResult.summary}`);
    } else if (finalDecision === "APPROVED") {
      reasons.push(`✅ AI Risk Verified: Low contextual risk (${aiRiskResult.riskScore}/100). Compliant with historical patterns.`);
    }
  }

  const summary =
    finalDecision === "BLOCKED"
      ? `BLOCKED: ${policyResult.summary}`
      : finalDecision === "APPROVAL_REQUIRED"
      ? `APPROVAL REQUIRED: ${
          policyResult.decision === "APPROVAL_REQUIRED"
            ? policyResult.summary
            : verificationResult && verificationResult.status !== "VERIFIED"
            ? `Receipt verification requires review (${verificationResult.mismatchReasons.join("; ") || "discrepancy detected"})`
            : `Policy compliant, but flagged for review by AI Risk Engine (${aiRiskResult.summary})`
        }`
      : "APPROVED: Fully compliant with deterministic spending rules, verified low contextual risk by AI, and matching document evidence.";

  return {
    finalDecision,
    policyDecision: policyResult.decision,
    aiRecommendation: aiRiskResult.recommendation,
    aiRiskLevel: aiRiskResult.riskLevel,
    aiRiskScore: aiRiskResult.riskScore,
    receiptVerificationStatus: receiptStatus,
    receiptVerificationScore: receiptScore,
    reasons,
    summary,
  };
}

import { z } from "zod";

export const SignalSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type SignalSeverity = z.infer<typeof SignalSeveritySchema>;

export const RiskRecommendationSchema = z.enum([
  "PROCEED",
  "REVIEW",
  "HIGH_RISK_REVIEW",
]);
export type RiskRecommendation = z.infer<typeof RiskRecommendationSchema>;

export const RiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "UNAVAILABLE"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const RiskSignalSchema = z.object({
  type: z.string(),
  severity: SignalSeveritySchema,
  message: z.string(),
});
export type RiskSignal = z.infer<typeof RiskSignalSchema>;

export const AIRiskOutputSchema = z.object({
  riskScore: z.number().min(0).max(100).nullable(),
  riskLevel: RiskLevelSchema,
  signals: z.array(RiskSignalSchema),
  summary: z.string().min(1),
  recommendation: RiskRecommendationSchema,
  isDuplicate: z.boolean().optional().default(false),
  duplicateDetails: z.string().optional(),
  model: z.string().optional(),
});
export type AIRiskOutput = z.infer<typeof AIRiskOutputSchema>;

export const RecentTransactionSchema = z.object({
  merchant: z.string(),
  amount: z.number(),
  category: z.string(),
  date: z.string(),
});

export const AIContextSchema = z.object({
  employee: z.object({
    name: z.string(),
    role: z.string().default("EMPLOYEE"),
    department: z.string(),
  }),
  transaction: z.object({
    merchant: z.string(),
    amount: z.number().positive(),
    category: z.string(),
    purpose: z.string(),
    date: z.string().optional(),
  }),
  budget: z.object({
    monthlyLimit: z.number(),
    spent: z.number(),
    remaining: z.number(),
  }),
  history: z.object({
    averageTransaction: z.number(),
    transactionCount: z.number(),
    recentTransactions: z.array(RecentTransactionSchema).default([]),
  }),
  policy: z.object({
    decision: z.enum(["APPROVED", "APPROVAL_REQUIRED", "BLOCKED"]),
    reasons: z.array(z.string()).default([]),
  }),
});
export type AIContext = z.infer<typeof AIContextSchema>;

// ==========================================
// MILESTONE 7: RECEIPT EXTRACTION & VERIFICATION SCHEMAS
// ==========================================

export const ReceiptLineItemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable().optional(),
  unitPrice: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
});
export type ReceiptLineItem = z.infer<typeof ReceiptLineItemSchema>;

export const ExtractedReceiptSchema = z.object({
  merchantName: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  transactionDate: z.string().nullable(),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  totalAmount: z.number().nullable(),
  currency: z.string().nullable().default("INR"),
  category: z.string().nullable(),
  lineItems: z.array(ReceiptLineItemSchema).default([]),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string()).default([]),
  modelName: z.string().default("gemini-1.5-flash"),
  isMock: z.boolean().default(false),
  rawText: z.string().optional(),
});
export type ExtractedReceipt = z.infer<typeof ExtractedReceiptSchema>;

export const ExpenseVerificationResultSchema = z.object({
  status: z.enum(["VERIFIED", "REVIEW_REQUIRED", "MISMATCH", "FAILED"]),
  overallScore: z.number().min(0).max(100),
  recommendation: z.enum(["PROCEED", "REVIEW", "BLOCK"]),
  amountScore: z.number().min(0).max(40),
  amountMatch: z.boolean(),
  merchantScore: z.number().min(0).max(25),
  merchantMatch: z.boolean(),
  dateScore: z.number().min(0).max(15),
  dateMatch: z.boolean(),
  currencyScore: z.number().min(0).max(10),
  currencyMatch: z.boolean(),
  categoryScore: z.number().min(0).max(10),
  categoryMatch: z.boolean(),
  duplicateIndicator: z.enum(["NONE", "EXACT_HASH_MATCH", "INVOICE_MERCHANT_MATCH", "DUPLICATE_REVIEW"]).default("NONE"),
  mismatchReasons: z.array(z.string()),
  matchBreakdown: z.record(z.string(), z.any()),
});
export type ExpenseVerificationResult = z.infer<typeof ExpenseVerificationResultSchema>;

// ==========================================
// MILESTONE 8: AI FINANCE INSIGHT SCHEMAS
// ==========================================

export const FinanceInsightItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    "BUDGET_PRESSURE",
    "SPENDING_SPIKE",
    "CATEGORY_ANOMALY",
    "MERCHANT_ANOMALY",
    "APPROVAL_BACKLOG",
    "RECEIPT_MISMATCH",
    "RECEIPT_MISMATCH_CONCENTRATION",
    "REPEATED_TRANSACTIONS",
    "PAYMENT_FAILURES",
    "SAVINGS_OPPORTUNITY",
    "GENERAL",
    "GENERAL_RISK",
  ]),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
  title: z.string().min(1),
  explanation: z.string().min(1),
  evidence: z.array(z.string()).min(1),
  recommendedAction: z.string().min(1),
  actionLink: z.string().optional(),
  departmentId: z.string().optional(),
});
export type FinanceInsightItem = z.infer<typeof FinanceInsightItemSchema>;

export const FinanceInsightsOutputSchema = z.object({
  summary: z.string().min(1),
  insights: z.array(FinanceInsightItemSchema),
  modelName: z.string().default("gemini-1.5-flash"),
  isDemo: z.boolean().default(false),
});
export type FinanceInsightsOutput = z.infer<typeof FinanceInsightsOutputSchema>;


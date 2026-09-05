import prisma from "@/lib/prisma";

export interface AmountMatchResult {
  isMatch: boolean;
  score: number; // 0 to 40
  diff: number;
  percentageDiff: number;
  reason?: string;
}

export interface MerchantMatchResult {
  isMatch: boolean;
  score: number; // 0 to 25
  similarity: number;
  reason?: string;
}

export interface DateMatchResult {
  isMatch: boolean;
  score: number; // 0 to 15
  dayDifference: number;
  reason?: string;
}

export interface CurrencyMatchResult {
  isMatch: boolean;
  score: number; // 0 to 10
  reason?: string;
}

export interface CategoryMatchResult {
  isMatch: boolean;
  score: number; // 0 to 10
  reason?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateIndicator: "NONE" | "EXACT_HASH_MATCH" | "INVOICE_MERCHANT_MATCH" | "DUPLICATE_REVIEW";
  matchedExpenseId?: string;
  matchedReceiptId?: string;
  reason?: string;
}

// ==========================================
// 1. AMOUNT MATCHER (Decimal-Safe Arithmetic)
// ==========================================
export function matchAmount(claimAmount: number, receiptAmount: number | null): AmountMatchResult {
  if (receiptAmount === null || receiptAmount === undefined || isNaN(receiptAmount)) {
    return {
      isMatch: false,
      score: 0,
      diff: claimAmount,
      percentageDiff: 100,
      reason: "Receipt document does not show a legible total amount.",
    };
  }

  // Exact arithmetic in paise / cents to avoid floating point issues
  const claimPaise = Math.round(claimAmount * 100);
  const receiptPaise = Math.round(receiptAmount * 100);
  const diffPaise = Math.abs(claimPaise - receiptPaise);
  const diffRupees = diffPaise / 100;
  const percentageDiff = claimAmount > 0 ? (diffRupees / claimAmount) * 100 : 0;

  // Exact Match
  if (diffPaise === 0) {
    return {
      isMatch: true,
      score: 40,
      diff: 0,
      percentageDiff: 0,
    };
  }

  // Small tolerance (<= ₹1.00 or <= 1% rounding/tax difference)
  if (diffRupees <= 1.0 || percentageDiff <= 1.0) {
    return {
      isMatch: true,
      score: 35,
      diff: diffRupees,
      percentageDiff,
      reason: `Minor rounding variance detected (₹${diffRupees.toFixed(2)}, within 1% tolerance).`,
    };
  }

  // Moderate variance (<= 5%)
  if (percentageDiff <= 5.0) {
    return {
      isMatch: false,
      score: 20,
      diff: diffRupees,
      percentageDiff,
      reason: `Receipt amount (₹${receiptAmount.toLocaleString("en-IN")}) differs by ₹${diffRupees.toLocaleString("en-IN")} (${percentageDiff.toFixed(1)}%) from submitted claim (₹${claimAmount.toLocaleString("en-IN")}).`,
    };
  }

  // Significant Mismatch
  return {
    isMatch: false,
    score: 0,
    diff: diffRupees,
    percentageDiff,
    reason: `Receipt amount (₹${receiptAmount.toLocaleString("en-IN")}) does not match submitted claim (₹${claimAmount.toLocaleString("en-IN")}). Difference: ₹${diffRupees.toLocaleString("en-IN")}.`,
  };
}

// ==========================================
// 2. MERCHANT MATCHER (Normalization & Aliases)
// ==========================================
const KNOWN_MERCHANT_ALIASES: Record<string, string[]> = {
  amazon: ["aws", "amazon web services", "amazon.in", "amazon seller", "amazon pay", "amazon cloud"],
  aws: ["amazon", "amazon web services", "amazon web services inc", "aws cloud"],
  google: ["google ads", "google cloud", "google workspace", "alphabet", "google india", "google ireland"],
  uber: ["uber technologies", "uber bv", "uber trips", "uber india"],
  ola: ["ola cabs", "ani technologies", "ola mobility"],
  meta: ["facebook", "facebook ads", "meta platforms", "instagram"],
  microsoft: ["msft", "azure", "microsoft corporation", "microsoft 365", "office 365"],
  github: ["github inc", "github enterprise", "git hub"],
  apple: ["apple services", "itunes", "apple distribution"],
  swiggy: ["bundl technologies", "swiggy instamart"],
  zomato: ["zomato limited", "blinkit", "zomato food"],
  indigo: ["interglobe aviation", "indigo airlines", "goindigo"],
  airindia: ["air india", "tata sia airlines", "air india express"],
};

export function normalizeMerchant(name: string): string {
  if (!name) return "";
  let normalized = name.toLowerCase().trim();

  // Strip legal suffixes
  normalized = normalized.replace(/\b(inc|incorporated|pvt|ltd|limited|llc|gmbh|corp|corporation|technologies|technology|tech|solutions|services|service|india|global|co|llp)\b/g, " ");

  // Strip domains and TLDs
  normalized = normalized.replace(/\.(com|in|org|net|ai|co|io|biz|info)\b/g, " ");

  // Strip punctuation and special characters
  normalized = normalized.replace(/[^a-z0-9\s]/g, " ");

  return normalized.replace(/\s+/g, " ").trim();
}

export function matchMerchant(claimMerchant: string, receiptMerchant: string | null): MerchantMatchResult {
  if (!receiptMerchant || !receiptMerchant.trim()) {
    return {
      isMatch: false,
      score: 0,
      similarity: 0,
      reason: "Receipt document does not show a legible merchant name.",
    };
  }

  const normClaim = normalizeMerchant(claimMerchant);
  const normReceipt = normalizeMerchant(receiptMerchant);

  // Exact normalized match
  if (normClaim === normReceipt) {
    return {
      isMatch: true,
      score: 25,
      similarity: 1.0,
    };
  }

  // Token inclusion (e.g. "amazon" in "amazon web services")
  if (normReceipt.includes(normClaim) || normClaim.includes(normReceipt)) {
    return {
      isMatch: true,
      score: 25,
      similarity: 0.95,
    };
  }

  // Check Known Alias Dictionary
  for (const [canonical, aliases] of Object.entries(KNOWN_MERCHANT_ALIASES)) {
    const isClaimInGroup = normClaim === canonical || aliases.some((a) => normClaim.includes(a) || a.includes(normClaim));
    const isReceiptInGroup = normReceipt === canonical || aliases.some((a) => normReceipt.includes(a) || a.includes(normReceipt));

    if (isClaimInGroup && isReceiptInGroup) {
      return {
        isMatch: true,
        score: 25,
        similarity: 0.9,
      };
    }
  }

  // Calculate Jaccard Token Similarity
  const claimTokens = new Set(normClaim.split(" ").filter(Boolean));
  const receiptTokens = new Set(normReceipt.split(" ").filter(Boolean));
  const intersection = new Set([...claimTokens].filter((x) => receiptTokens.has(x)));
  const union = new Set([...claimTokens, ...receiptTokens]);
  const tokenSimilarity = union.size > 0 ? intersection.size / union.size : 0;

  if (tokenSimilarity >= 0.5) {
    return {
      isMatch: true,
      score: 20,
      similarity: tokenSimilarity,
    };
  }

  // Mismatch
  return {
    isMatch: false,
    score: 0,
    similarity: tokenSimilarity,
    reason: `Merchant mismatch: submitted claim is for '${claimMerchant}', but receipt is from '${receiptMerchant}'.`,
  };
}

// ==========================================
// 3. DATE MATCHER (Variance Tolerance)
// ==========================================
export function matchDate(claimDate: Date | string, receiptDate: string | null): DateMatchResult {
  if (!receiptDate) {
    return {
      isMatch: false,
      score: 5, // Partial baseline
      dayDifference: -1,
      reason: "Receipt does not state a clear transaction date.",
    };
  }

  try {
    const claimD = new Date(claimDate);
    const receiptD = new Date(receiptDate);

    if (isNaN(claimD.getTime()) || isNaN(receiptD.getTime())) {
      return { isMatch: false, score: 5, dayDifference: -1, reason: "Invalid date format on document." };
    }

    const diffTime = Math.abs(claimD.getTime() - receiptD.getTime());
    const dayDifference = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (dayDifference === 0) {
      return { isMatch: true, score: 15, dayDifference: 0 };
    }

    if (dayDifference <= 3) {
      return {
        isMatch: true,
        score: 13,
        dayDifference,
        reason: `Receipt date (${receiptDate}) is within 3 days of expense date.`,
      };
    }

    if (dayDifference <= 7) {
      return {
        isMatch: true,
        score: 10,
        dayDifference,
        reason: `Receipt date (${receiptDate}) has a ${dayDifference}-day variance from claim date.`,
      };
    }

    if (dayDifference <= 30) {
      return {
        isMatch: false,
        score: 5,
        dayDifference,
        reason: `Receipt date (${receiptDate}) is ${dayDifference} days apart from expense submission.`,
      };
    }

    return {
      isMatch: false,
      score: 0,
      dayDifference,
      reason: `Significant date mismatch: receipt date is ${receiptDate} (${dayDifference} days apart).`,
    };
  } catch {
    return { isMatch: false, score: 5, dayDifference: -1 };
  }
}

// ==========================================
// 4. CURRENCY MATCHER
// ==========================================
export function matchCurrency(claimCurrency: string = "INR", receiptCurrency: string | null = "INR"): CurrencyMatchResult {
  const normClaim = (claimCurrency || "INR").trim().toUpperCase();
  const normReceipt = (receiptCurrency || "INR").trim().toUpperCase();

  if (normClaim === normReceipt) {
    return { isMatch: true, score: 10 };
  }

  return {
    isMatch: false,
    score: 0,
    reason: `Currency mismatch: claim is in ${normClaim} but receipt indicates ${normReceipt}.`,
  };
}

// ==========================================
// 5. CATEGORY MATCHER (Compatibility Groups)
// ==========================================
const COMPATIBLE_CATEGORY_GROUPS: Record<string, string[]> = {
  software: ["cloud infrastructure", "developer tools", "subscriptions", "it & software", "saas"],
  "cloud infrastructure": ["software", "developer tools", "infrastructure", "hosting", "aws", "it"],
  advertising: ["marketing", "marketing services", "lead gen", "digital ads", "promotions"],
  travel: ["flights", "airlines", "transport", "hotel", "lodging", "cab", "taxi", "train"],
  meals: ["food", "dining", "restaurant", "hospitality", "client entertainment"],
  "office supplies": ["stationery", "equipment", "hardware", "office"],
};

export function matchCategory(claimCategory: string, receiptCategory: string | null): CategoryMatchResult {
  if (!receiptCategory || !receiptCategory.trim()) {
    return { isMatch: true, score: 8 }; // Neutral fallback
  }

  const normClaim = claimCategory.toLowerCase().trim();
  const normReceipt = receiptCategory.toLowerCase().trim();

  if (normClaim === normReceipt || normReceipt.includes(normClaim) || normClaim.includes(normReceipt)) {
    return { isMatch: true, score: 10 };
  }

  for (const [group, compatibleList] of Object.entries(COMPATIBLE_CATEGORY_GROUPS)) {
    const isClaimInGroup = normClaim === group || compatibleList.includes(normClaim);
    const isReceiptInGroup = normReceipt === group || compatibleList.includes(normReceipt);

    if (isClaimInGroup && isReceiptInGroup) {
      return { isMatch: true, score: 10 };
    }
  }

  // Suspicious category mismatch (e.g. Office Supplies vs Casino or Food)
  return {
    isMatch: false,
    score: 0,
    reason: `Category mismatch: claim is categorized as '${claimCategory}', but receipt indicates '${receiptCategory}'.`,
  };
}

// ==========================================
// 6. DUPLICATE RECEIPT DETECTOR
// ==========================================
export async function detectDuplicateReceipts(params: {
  companyId: string;
  fileHash?: string | null;
  invoiceNumber?: string | null;
  merchantName?: string | null;
  amount?: number | null;
  currentExpenseId?: string;
  currentReceiptId?: string;
}): Promise<DuplicateCheckResult> {
  const { companyId, fileHash, invoiceNumber, merchantName, amount, currentExpenseId, currentReceiptId } = params;

  // 1. Exact File Hash Match (same binary uploaded twice)
  if (fileHash) {
    const duplicateReceipt = await prisma.expenseReceipt.findFirst({
      where: {
        companyId,
        fileHash,
        ...(currentReceiptId ? { id: { not: currentReceiptId } } : {}),
        ...(currentExpenseId ? { expenseId: { not: currentExpenseId } } : {}),
      },
      include: { expense: true },
    });

    if (duplicateReceipt) {
      return {
        isDuplicate: true,
        duplicateIndicator: "EXACT_HASH_MATCH",
        matchedExpenseId: duplicateReceipt.expenseId,
        matchedReceiptId: duplicateReceipt.id,
        reason: `Exact duplicate file uploaded previously for expense ${duplicateReceipt.expense?.expenseNumber || duplicateReceipt.expenseId}.`,
      };
    }
  }

  // 2. Exact Invoice Number + Merchant Match
  if (invoiceNumber && invoiceNumber.trim() && invoiceNumber !== "N/A" && merchantName) {
    const normMerchant = normalizeMerchant(merchantName);

    const duplicateAnalysis = await prisma.receiptAnalysis.findFirst({
      where: {
        companyId,
        invoiceNumber: invoiceNumber.trim(),
        ...(currentExpenseId ? { receipt: { expenseId: { not: currentExpenseId } } } : {}),
      },
      include: {
        receipt: { include: { expense: true } },
      },
    });

    if (duplicateAnalysis && duplicateAnalysis.merchantName) {
      const matchNorm = normalizeMerchant(duplicateAnalysis.merchantName);
      if (normMerchant === matchNorm || normMerchant.includes(matchNorm) || matchNorm.includes(normMerchant)) {
        return {
          isDuplicate: true,
          duplicateIndicator: "INVOICE_MERCHANT_MATCH",
          matchedExpenseId: duplicateAnalysis.receipt?.expenseId,
          matchedReceiptId: duplicateAnalysis.receiptId,
          reason: `Invoice number '${invoiceNumber}' from '${merchantName}' was already submitted under expense ${duplicateAnalysis.receipt?.expense?.expenseNumber || duplicateAnalysis.receipt?.expenseId}.`,
        };
      }
    }
  }

  return {
    isDuplicate: false,
    duplicateIndicator: "NONE",
  };
}

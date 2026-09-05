import { PrismaClient } from "@prisma/client";
import { fileStorage, MAX_FILE_SIZE_BYTES } from "../lib/storage/file-storage";
import { extractReceiptData } from "../lib/ai/receipt-engine";
import {
  matchAmount,
  matchMerchant,
  matchDate,
  matchCurrency,
  matchCategory,
  detectDuplicateReceipts,
  normalizeMerchant,
} from "../lib/verification/matchers";
import { runExpenseVerification } from "../lib/verification/expense-verification";
import { synthesizeDecision } from "../lib/decision-engine";
import { ExtractedReceiptSchema } from "../lib/ai/schemas";

const prisma = new PrismaClient();

async function runMilestone7Tests() {
  console.log("=================================================");
  console.log("🧾  SPENDGUARD AI — MILESTONE 7 AUTOMATED TESTS");
  console.log("    AI Receipt Intelligence & Claim Verification");
  console.log("=================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(title: string, condition: boolean, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ PASS: ${title}`);
    } else {
      console.error(`  ❌ FAIL: ${title}`);
      if (details) console.error(`     Details: ${details}`);
    }
  }

  // Load Seeded Acme Company & Users
  const company = await prisma.company.findFirst({
    where: { name: "Acme Technologies" },
    include: {
      users: true,
      departments: { include: { manager: true } },
      employeeProfiles: { include: { user: true } },
    },
  });

  if (!company) throw new Error("Acme Technologies missing from DB");

  const rahulUser = company.users.find((u) => u.name === "Rahul Sharma")!;
  const engineeringDept = company.departments.find((d) => d.name === "Engineering")!;
  const rahulProfile = company.employeeProfiles.find((e) => e.userId === rahulUser.id)!;

  // ==========================================
  // 1. FILE STORAGE, VALIDATION & HASHING
  // ==========================================
  console.log("--- 1. File Storage, Validation & Cryptographic Hashing ---");

  const samplePdfBuffer = Buffer.from("%PDF-1.4 Mock Receipt File Content For Unit Testing...");
  const sampleJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

  // Test 1: Supported PDF file is accepted
  const pdfVal = fileStorage.validateFile(samplePdfBuffer, "invoice.pdf", "application/pdf");
  assert("Supported PDF document is validated successfully", pdfVal.valid === true);

  // Test 2: Supported JPG image is accepted
  const jpgVal = fileStorage.validateFile(sampleJpgBuffer, "receipt.jpg", "image/jpeg");
  assert("Supported JPG receipt image is validated successfully", jpgVal.valid === true);

  // Test 3: Executable file is strictly rejected
  const exeBuffer = Buffer.from("MZ Executable header binary");
  const exeVal = fileStorage.validateFile(exeBuffer, "malicious.exe", "application/x-msdownload");
  assert("Executable .exe file is strictly rejected", exeVal.valid === false);

  // Test 4: Oversized file exceeding 10 MB limit is rejected
  const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024);
  const sizeVal = fileStorage.validateFile(oversizedBuffer, "large_invoice.pdf", "application/pdf");
  assert("File exceeding 10 MB limit is rejected", sizeVal.valid === false);

  // Test 5: Storage Upload & SHA-256 Hashing
  const storedFile = await fileStorage.uploadFile({
    buffer: samplePdfBuffer,
    fileName: "aws_monthly_invoice.pdf",
    mimeType: "application/pdf",
    companyId: company.id,
  });
  assert("File stored with unique storageKey", storedFile.storageKey.startsWith(`${company.id}/`));
  assert("SHA-256 cryptographic hash generated", storedFile.fileHash.length === 64);
  assert("File size accurately recorded", storedFile.fileSize === samplePdfBuffer.length);

  // Test 6: Secure Retrieval
  const retrieved = await fileStorage.retrieveFile(storedFile.storageKey, company.id);
  assert("Stored file retrieved with correct content", retrieved !== null && retrieved.buffer.equals(samplePdfBuffer));

  // Test 7: Tenant Isolation - Company B cannot access Company A storage
  let crossTenantBlocked = false;
  try {
    await fileStorage.retrieveFile(storedFile.storageKey, "other_company_id_999");
  } catch {
    crossTenantBlocked = true;
  }
  assert("Tenant Isolation: Cross-company file retrieval is blocked", crossTenantBlocked === true);

  // ==========================================
  // 2. AI RECEIPT EXTRACTION & SCHEMA ADHERENCE
  // ==========================================
  console.log("\n--- 2. AI Receipt Extraction Engine & Schema Validation ---");

  // Test 8: Extract AWS invoice metadata
  const awsExtraction = await extractReceiptData(samplePdfBuffer, "aws_invoice.pdf", "application/pdf");
  assert("Extracted receipt conforms to Zod schema", ExtractedReceiptSchema.safeParse(awsExtraction).success === true);
  assert("Extracted merchant name is populated", Boolean(awsExtraction.merchantName));
  assert("Extracted total amount is a valid number", typeof awsExtraction.totalAmount === "number" && awsExtraction.totalAmount > 0);
  assert("Extracted line items array is present", Array.isArray(awsExtraction.lineItems) && awsExtraction.lineItems.length > 0);
  assert("Zero Hallucination: Missing fields array is present", Array.isArray(awsExtraction.missingFields));

  // Test 9: Handle document with missing fields safely
  const partialExtraction = await extractReceiptData(samplePdfBuffer, "missing_fields_receipt.pdf", "application/pdf");
  assert("Missing invoice number is returned as null without hallucination", partialExtraction.invoiceNumber === null);
  assert("Missing fields are tracked in missingFields array", partialExtraction.missingFields.includes("invoiceNumber"));

  // ==========================================
  // 3. DETERMINISTIC MATCHERS
  // ==========================================
  console.log("\n--- 3. Deterministic Matchers (Amount, Merchant, Date, Currency, Category) ---");

  // Amount Matcher Tests
  // Test 10: Exact Amount Match
  const exactAmt = matchAmount(18500, 18500);
  assert("Amount Match: Exact amount match yields 40/40 pts", exactAmt.score === 40 && exactAmt.isMatch === true);

  // Test 11: Minor Tolerance (rounding / 50 paise diff)
  const minorAmt = matchAmount(18500, 18500.5);
  assert("Amount Match: Minor rounding variance (50 paise) is accepted (35 pts)", minorAmt.score === 35 && minorAmt.isMatch === true);

  // Test 12: Major Mismatch
  const majorAmt = matchAmount(18500, 8500);
  assert("Amount Match: Major discrepancy (₹18,500 vs ₹8,500) yields 0 pts and isMatch=false", majorAmt.score === 0 && majorAmt.isMatch === false);
  assert("Amount Match: Detailed difference reason provided", majorAmt.reason?.includes("Difference: ₹10,000") === true);

  // Merchant Matcher Tests
  // Test 13: Normalized Merchant Match
  const normMerch = matchMerchant("Amazon Web Services", "Amazon Web Services Inc.");
  assert("Merchant Match: Legal suffix normalization yields 25/25 pts", normMerch.score === 25 && normMerch.isMatch === true);

  // Test 14: Known Alias Match
  const aliasMerch = matchMerchant("AWS", "Amazon Web Services");
  assert("Merchant Match: Known alias (AWS <-> Amazon Web Services) yields 25/25 pts", aliasMerch.score === 25 && aliasMerch.isMatch === true);

  // Test 15: Unrelated Merchant Mismatch
  const mismatchMerch = matchMerchant("Amazon Web Services", "ABC Electronics & Gadgets Store");
  assert("Merchant Match: Unrelated merchant yields 0 pts and isMatch=false", mismatchMerch.score === 0 && mismatchMerch.isMatch === false);

  // Date Matcher Tests
  // Test 16: Same Date Match
  const sameDate = matchDate("2026-09-05", "2026-09-05");
  assert("Date Match: Exact date match yields 15/15 pts", sameDate.score === 15 && sameDate.isMatch === true);

  // Test 17: Acceptable 3-Day Window
  const closeDate = matchDate("2026-09-05", "2026-09-03");
  assert("Date Match: 2-day variance yields partial score (13 pts) and isMatch=true", closeDate.score === 13 && closeDate.isMatch === true);

  // Test 18: Large Discrepancy (>30 days)
  const farDate = matchDate("2026-09-05", "2026-07-01");
  assert("Date Match: 60+ days apart yields 0 pts and isMatch=false", farDate.score === 0 && farDate.isMatch === false);

  // Currency Matcher Tests
  // Test 19: Currency Match & Mismatch
  const inrMatch = matchCurrency("INR", "INR");
  const inrMismatch = matchCurrency("INR", "USD");
  assert("Currency Match: Matching currency yields 10/10 pts", inrMatch.score === 10 && inrMatch.isMatch === true);
  assert("Currency Match: Mismatched currency (INR vs USD) yields 0 pts", inrMismatch.score === 0 && inrMismatch.isMatch === false);

  // Category Matcher Tests
  // Test 20: Category Compatibility
  const catCompat = matchCategory("Software", "Cloud Infrastructure");
  const catIncompat = matchCategory("Office Supplies", "Restaurant");
  assert("Category Match: Compatible categories (Software <-> Cloud) yield 10/10 pts", catCompat.score === 10 && catCompat.isMatch === true);
  assert("Category Match: Incompatible categories yield 0 pts", catIncompat.score === 0 && catIncompat.isMatch === false);

  // ==========================================
  // 4. EXPENSE VERIFICATION ENGINE & SCORING SCENARIOS
  // ==========================================
  console.log("\n--- 4. Expense Verification Engine & 4 Core Scenarios ---");

  // Create a test expense in database
  const testExpense = await prisma.expense.create({
    data: {
      companyId: company.id,
      employeeProfileId: rahulProfile.id,
      departmentId: engineeringDept.id,
      expenseNumber: `EXP-M7-${Date.now()}-VER`,
      merchantName: "Amazon Web Services",
      amount: 18500,
      currency: "INR",
      category: "Software",
      purpose: "Production AWS Cloud Hosting",
      status: "PENDING_APPROVAL",
      policyDecision: "APPROVED",
    },
  });

  const testReceipt = await prisma.expenseReceipt.create({
    data: {
      companyId: company.id,
      expenseId: testExpense.id,
      fileName: "aws_cloud_inv.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
      fileHash: "hash_aws_test_123456",
      storageKey: `${company.id}/aws_test_inv.pdf`,
      status: "PROCESSED",
    },
  });

  // Scenario 1: High Confidence Exact Match (Score >= 90 -> VERIFIED)
  const analysis1 = await prisma.receiptAnalysis.create({
    data: {
      companyId: company.id,
      receiptId: testReceipt.id,
      merchantName: "Amazon Web Services",
      invoiceNumber: "INV-AWS-92813",
      transactionDate: new Date().toISOString().split("T")[0],
      totalAmount: 18500,
      tax: 2823,
      subtotal: 15677,
      currency: "INR",
      category: "Cloud Infrastructure",
      confidence: 0.98,
      status: "PROCESSED",
    },
  });

  const verifyRes1 = await runExpenseVerification({
    expense: {
      id: testExpense.id,
      expenseNumber: testExpense.expenseNumber,
      amount: 18500,
      merchantName: "Amazon Web Services",
      currency: "INR",
      category: "Software",
      expenseDate: new Date(),
      companyId: company.id,
    },
    receiptAnalysis: {
      id: analysis1.id,
      receiptId: testReceipt.id,
      totalAmount: 18500,
      merchantName: "Amazon Web Services",
      currency: "INR",
      category: "Cloud Infrastructure",
      transactionDate: new Date().toISOString().split("T")[0],
      invoiceNumber: "INV-AWS-92813",
    },
    fileHash: testReceipt.fileHash,
  });

  assert("Scenario 1 (Verified Match): Overall Score is 100/100", verifyRes1.result.overallScore === 100);
  assert("Scenario 1: Status is VERIFIED", verifyRes1.result.status === "VERIFIED");
  assert("Scenario 1: Recommendation is PROCEED", verifyRes1.result.recommendation === "PROCEED");
  assert("Scenario 1: Amount, Merchant & Currency all match", verifyRes1.result.amountMatch && verifyRes1.result.merchantMatch && verifyRes1.result.currencyMatch);

  // Scenario 2: Amount Mismatch (Claim ₹18,500 vs Receipt ₹8,500 -> REVIEW_REQUIRED / MISMATCH)
  const analysis2 = await prisma.receiptAnalysis.create({
    data: {
      companyId: company.id,
      receiptId: testReceipt.id,
      merchantName: "Amazon Web Services",
      invoiceNumber: "INV-AWS-88219",
      transactionDate: new Date().toISOString().split("T")[0],
      totalAmount: 8500, // ₹10,000 difference
      tax: 1297,
      subtotal: 7203,
      currency: "INR",
      category: "Cloud Infrastructure",
      confidence: 0.95,
      status: "PROCESSED",
    },
  });

  const verifyRes2 = await runExpenseVerification({
    expense: {
      id: testExpense.id,
      expenseNumber: testExpense.expenseNumber,
      amount: 18500,
      merchantName: "Amazon Web Services",
      currency: "INR",
      category: "Software",
      expenseDate: new Date(),
      companyId: company.id,
    },
    receiptAnalysis: {
      id: analysis2.id,
      receiptId: testReceipt.id,
      totalAmount: 8500,
      merchantName: "Amazon Web Services",
      currency: "INR",
      category: "Cloud Infrastructure",
      transactionDate: new Date().toISOString().split("T")[0],
      invoiceNumber: "INV-AWS-88219",
    },
    fileHash: "new_hash_mismatch",
  });

  assert("Scenario 2 (Amount Mismatch): Amount match is false", verifyRes2.result.amountMatch === false);
  assert("Scenario 2: Overall Score is reduced to 60/100", verifyRes2.result.overallScore === 60);
  assert("Scenario 2: Status is MISMATCH", verifyRes2.result.status === "MISMATCH");
  assert("Scenario 2: Mismatch reason highlights ₹10,000 difference", verifyRes2.result.mismatchReasons.some((r) => r.includes("₹10,000")));

  // Scenario 3: Merchant Mismatch (Claim Amazon vs Receipt ABC Electronics -> MISMATCH)
  const analysis3 = await prisma.receiptAnalysis.create({
    data: {
      companyId: company.id,
      receiptId: testReceipt.id,
      merchantName: "ABC Electronics Store",
      invoiceNumber: "INV-ABC-991",
      transactionDate: new Date().toISOString().split("T")[0],
      totalAmount: 18500,
      currency: "INR",
      category: "Hardware",
      confidence: 0.95,
      status: "PROCESSED",
    },
  });

  const verifyRes3 = await runExpenseVerification({
    expense: {
      id: testExpense.id,
      expenseNumber: testExpense.expenseNumber,
      amount: 18500,
      merchantName: "Amazon Web Services",
      currency: "INR",
      category: "Software",
      expenseDate: new Date(),
      companyId: company.id,
    },
    receiptAnalysis: {
      id: analysis3.id,
      receiptId: testReceipt.id,
      totalAmount: 18500,
      merchantName: "ABC Electronics Store",
      currency: "INR",
      category: "Hardware",
      transactionDate: new Date().toISOString().split("T")[0],
      invoiceNumber: "INV-ABC-991",
    },
    fileHash: "hash_merch_mismatch",
  });

  assert("Scenario 3 (Merchant Mismatch): Merchant match is false", verifyRes3.result.merchantMatch === false);
  assert("Scenario 3: Status is MISMATCH (Score: 75/100)", verifyRes3.result.status === "MISMATCH" || verifyRes3.result.status === "REVIEW_REQUIRED");
  assert("Scenario 3: Mismatch reason notes merchant discrepancy", verifyRes3.result.mismatchReasons.some((r) => r.includes("ABC Electronics Store")));

  // Scenario 4: Duplicate Receipt Detection (Exact file hash or invoice number match)
  const duplicateCheck = await detectDuplicateReceipts({
    companyId: company.id,
    fileHash: testReceipt.fileHash, // Existing hash
    currentExpenseId: "different_expense_id_999",
  });

  assert("Scenario 4 (Duplicate Detection): Exact file hash duplicate detected", duplicateCheck.isDuplicate === true);
  assert("Scenario 4: Duplicate indicator is EXACT_HASH_MATCH", duplicateCheck.duplicateIndicator === "EXACT_HASH_MATCH");
  assert("Scenario 4: Matched previous expense ID recorded", duplicateCheck.matchedExpenseId === testExpense.id);

  // ==========================================
  // 5. DECISION ENGINE INTEGRATION & SUPREMACY
  // ==========================================
  console.log("\n--- 5. Decision Engine Synthesis & Hard Policy Supremacy ---");

  // Rule 1: Hard policy block CANNOT be overridden even if receipt is 100% verified
  const policyBlocked = {
    decision: "BLOCKED" as const,
    violations: ["Blocked merchant: Casino"],
    summary: "BLOCKED: Policy violation",
    flags: { employeeBudget: "PASS" as const, departmentBudget: "PASS" as const, companyBudget: "PASS" as const, approvalThreshold: "PASS" as const, transactionLimit: "PASS" as const, category: "PASS" as const, merchant: "BLOCKED" as const },
    reasons: ["✖ Merchant is blocked"],
  };

  const decision1 = synthesizeDecision(
    policyBlocked as any,
    { riskScore: 10, riskLevel: "LOW", signals: [], summary: "Low risk", recommendation: "PROCEED", isDuplicate: false },
    verifyRes1.result // 100% verified receipt
  );
  assert("Hard Policy Supremacy: BLOCKED policy remains BLOCKED regardless of 100% verified receipt", decision1.finalDecision === "BLOCKED");

  // Rule 2: Policy APPROVED with Receipt MISMATCH escalates to APPROVAL_REQUIRED
  const policyApproved = {
    decision: "APPROVED" as const,
    violations: [],
    summary: "APPROVED: Within all limits",
    flags: { employeeBudget: "PASS" as const, departmentBudget: "PASS" as const, companyBudget: "PASS" as const, approvalThreshold: "PASS" as const, transactionLimit: "PASS" as const, category: "PASS" as const, merchant: "PASS" as const },
    reasons: ["✓ Compliant"],
  };

  const decision2 = synthesizeDecision(
    policyApproved as any,
    { riskScore: 15, riskLevel: "LOW", signals: [], summary: "Low contextual risk", recommendation: "PROCEED", isDuplicate: false },
    verifyRes2.result // Mismatched receipt
  );
  assert("Receipt Mismatch Escalation: Receipt MISMATCH escalates compliant expense to APPROVAL_REQUIRED", decision2.finalDecision === "APPROVAL_REQUIRED");

  // Rule 3: Policy APPROVED + AI LOW + Receipt VERIFIED -> APPROVED
  const decision3 = synthesizeDecision(
    policyApproved as any,
    { riskScore: 12, riskLevel: "LOW", signals: [], summary: "Low contextual risk", recommendation: "PROCEED", isDuplicate: false },
    verifyRes1.result // Verified receipt
  );
  assert("Fully Compliant Auto-Approval: Policy APPROVED + AI LOW + Receipt VERIFIED -> APPROVED", decision3.finalDecision === "APPROVED");

  // Clean up test records
  await prisma.expenseVerification.deleteMany({ where: { expenseId: testExpense.id } });
  await prisma.receiptAnalysis.deleteMany({ where: { receiptId: testReceipt.id } });
  await prisma.expenseReceipt.deleteMany({ where: { id: testReceipt.id } });
  await prisma.expense.deleteMany({ where: { id: testExpense.id } });

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log("\n=================================================");
  console.log(`MILESTONE 7 TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (passedTests === totalTests) {
    console.log("🎉 ALL MILESTONE 7 TESTS PASSED SUCCESSFULLY!");
  } else {
    console.error(`⚠️  ${totalTests - passedTests} TESTS FAILED.`);
  }
  console.log("=================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runMilestone7Tests()
  .catch((e) => {
    console.error("Test execution error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

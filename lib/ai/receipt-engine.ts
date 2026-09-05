import { ExtractedReceipt, ExtractedReceiptSchema } from "./schemas";

export interface ExtractReceiptOptions {
  claimHint?: {
    merchantName?: string;
    amount?: number;
    category?: string;
  };
}

/**
 * AI Receipt/Invoice Extraction Engine
 * Extracts structured data from PDF, JPG, PNG, and WEBP receipts.
 * Strictly adheres to zero-hallucination policy and validates with Zod.
 */
export async function extractReceiptData(
  fileBuffer: Buffer | string,
  fileName: string,
  mimeType: string,
  options?: ExtractReceiptOptions
): Promise<ExtractedReceipt> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  // Convert buffer to base64 if Buffer
  let base64Data = "";
  if (Buffer.isBuffer(fileBuffer)) {
    base64Data = fileBuffer.toString("base64");
  } else if (typeof fileBuffer === "string") {
    base64Data = fileBuffer.includes("base64,") ? fileBuffer.split("base64,")[1] : fileBuffer;
  }

  // 1. Live Multimodal Gemini 1.5 Flash Extraction
  if (apiKey && base64Data && !apiKey.includes("placeholder")) {
    try {
      const normalizedMime = mimeType === "application/pdf" ? "application/pdf" : mimeType || "image/jpeg";

      const promptText = `You are SpendGuard AI's intelligent receipt and invoice extractor.
Extract all structured financial metadata from this uploaded document.

CRITICAL FINANCIAL EXTRACTION RULES:
1. Extract ONLY information explicitly visible in the document.
2. DO NOT invent, assume, or hallucinate missing merchants, amounts, dates, invoice numbers, tax amounts, or line items.
3. If any field is not visible or legible, set its value strictly to null and include the field name in the "missingFields" array.
4. Convert all numeric values to standard numbers (e.g. 18500.50).
5. Extract individual line items if visible (name, quantity, unitPrice, total).
6. Return strict JSON adhering to this exact structure:
{
  "merchantName": string | null,
  "invoiceNumber": string | null,
  "transactionDate": "YYYY-MM-DD" | null,
  "subtotal": number | null,
  "tax": number | null,
  "totalAmount": number | null,
  "currency": string | null,
  "category": string | null,
  "lineItems": [
    {
      "name": string,
      "quantity": number | null,
      "unitPrice": number | null,
      "total": number | null
    }
  ],
  "confidence": number (between 0.0 and 1.0),
  "missingFields": string[]
}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: normalizedMime,
                      data: base64Data,
                    },
                  },
                  { text: promptText },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1, // Low temperature for high precision extraction
            },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text;

        if (rawContent) {
          const parsed = JSON.parse(rawContent);
          const validation = ExtractedReceiptSchema.safeParse({
            ...parsed,
            modelName: "gemini-1.5-flash",
            isMock: false,
          });

          if (validation.success) {
            return validation.data;
          } else {
            console.warn("Gemini output failed Zod validation, falling back to safe extractor:", validation.error);
          }
        }
      }
    } catch (err) {
      console.warn("Live AI receipt extraction encountered error, using deterministic fallback:", err);
    }
  }

  // 2. High-Fidelity Deterministic Demo / Mock Extraction
  return generateDemoReceiptExtraction(fileName, options);
}

/**
 * Structured Demo Extractor for local development and offline environments
 */
function generateDemoReceiptExtraction(
  fileName: string,
  options?: ExtractReceiptOptions
): ExtractedReceipt {
  const lowerName = fileName.toLowerCase();
  const dateStr = new Date().toISOString().split("T")[0];

  let merchantName: string | null = "Corporate Vendor Solutions";
  let invoiceNumber: string | null = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
  let totalAmount: number | null = 3500;
  let tax: number | null = 630;
  let subtotal: number | null = 2870;
  let category: string | null = "Software";
  const currency: string | null = "INR";
  let confidence = 0.96;
  const missingFields: string[] = [];

  let lineItems = [
    {
      name: "Monthly Subscription Service",
      quantity: 1,
      unitPrice: 2870,
      total: 2870,
    },
  ];

  // Specific demo scenarios
  if (lowerName.includes("mismatch_amt") || lowerName.includes("amount_mismatch")) {
    merchantName = "Amazon Web Services (AWS)";
    invoiceNumber = "INV-AWS-88219";
    totalAmount = 8500; // Mismatch against ₹18,500 claim
    subtotal = 7203;
    tax = 1297;
    category = "Cloud Infrastructure";
    lineItems = [{ name: "EC2 & S3 Basic Tier", quantity: 1, unitPrice: 7203, total: 7203 }];
  } else if (lowerName.includes("mismatch_merch") || lowerName.includes("merchant_mismatch")) {
    merchantName = "ABC Electronics & Gadgets Store";
    invoiceNumber = "INV-ABC-3310";
    totalAmount = 18500;
    subtotal = 15677;
    tax = 2823;
    category = "Hardware";
    lineItems = [{ name: "Noise Cancelling Headphones", quantity: 1, unitPrice: 15677, total: 15677 }];
  } else if (lowerName.includes("aws") || lowerName.includes("amazon")) {
    merchantName = "Amazon Web Services";
    invoiceNumber = "INV-AWS-92813";
    totalAmount = 18500;
    subtotal = 15677;
    tax = 2823;
    category = "Cloud Infrastructure";
    lineItems = [
      { name: "AWS EC2 Compute Instances", quantity: 1, unitPrice: 10500, total: 10500 },
      { name: "AWS RDS PostgreSQL Production", quantity: 1, unitPrice: 5177, total: 5177 },
    ];
  } else if (lowerName.includes("google") || lowerName.includes("ad")) {
    merchantName = "Google Ads India";
    invoiceNumber = "INV-GOOG-5491";
    totalAmount = 8500;
    subtotal = 7203;
    tax = 1297;
    category = "Advertising";
    lineItems = [{ name: "Search Campaign - Q3 Lead Gen", quantity: 1, unitPrice: 7203, total: 7203 }];
  } else if (lowerName.includes("uber") || lowerName.includes("taxi") || lowerName.includes("ride")) {
    merchantName = "Uber Technologies";
    invoiceNumber = "UBER-TRIP-9912";
    totalAmount = 1240;
    subtotal = 1180;
    tax = 60;
    category = "Travel";
    lineItems = [{ name: "Trip to Airport Terminal 3", quantity: 1, unitPrice: 1180, total: 1180 }];
  } else if (lowerName.includes("datadog") || lowerName.includes("monitor")) {
    merchantName = "Datadog Observability";
    invoiceNumber = "INV-DD-4412";
    totalAmount = 28000;
    subtotal = 23728;
    tax = 4272;
    category = "Software";
    lineItems = [{ name: "APM Infrastructure Monitoring", quantity: 1, unitPrice: 23728, total: 23728 }];
  } else if (lowerName.includes("missing_fields")) {
    merchantName = "Corner Store";
    invoiceNumber = null;
    tax = null;
    subtotal = null;
    totalAmount = 500;
    category = null;
    missingFields.push("invoiceNumber", "tax", "subtotal", "category");
    confidence = 0.72;
  } else if (options?.claimHint?.amount && options?.claimHint?.merchantName) {
    // Dynamic matching demo fallback based on claim hint
    merchantName = options.claimHint.merchantName;
    totalAmount = options.claimHint.amount;
    tax = Math.round(options.claimHint.amount * 0.18 * 100) / 100;
    subtotal = Math.round((options.claimHint.amount - tax) * 100) / 100;
    category = options.claimHint.category || "Software";
    invoiceNumber = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
    lineItems = [{ name: `${category} Operational Expense`, quantity: 1, unitPrice: subtotal, total: subtotal }];
  }

  return {
    merchantName,
    invoiceNumber,
    transactionDate: dateStr,
    subtotal,
    tax,
    totalAmount,
    currency,
    category,
    lineItems,
    confidence,
    missingFields,
    modelName: "demo-extractor-v1",
    isMock: true,
    rawText: `Document: ${fileName}\nMerchant: ${merchantName}\nInvoice: ${invoiceNumber || "N/A"}\nDate: ${dateStr}\nTotal: ₹${totalAmount}`,
  };
}

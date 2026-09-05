export type Role = "FINANCE_ADMIN" | "MANAGER" | "EMPLOYEE";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type Decision = "APPROVE" | "APPROVAL_REQUIRED" | "BLOCK";

export type ExpenseStatus =
  | "DRAFT"
  | "ANALYZING"
  | "AUTO_APPROVED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED"
  | "PROCESSING"
  | "PAID"
  | "PAYMENT_FAILED";

export type PaymentStatus =
  | "UNPAID"
  | "IN_PROGRESS"
  | "PAID"
  | "FAILED"
  | "REFUNDED";

export interface CompanyData {
  id: string;
  name: string;
  industry?: string | null;
  size?: string | null;
  currency: string;
  logoUrl?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface UserData {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
  companyId?: string | null;
  company?: CompanyData | null;
  employeeProfile?: EmployeeProfileData | null;
  departmentName?: string;
  title?: string;
  monthlyBudget?: number;
  spentThisMonth?: number;
}

export interface DepartmentData {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  monthlyBudget: number;
  spentThisMonth?: number;
  remainingBudget?: number;
  utilizationRate?: number;
  managerId?: string | null;
  manager?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  employeeCount?: number;
  employeeProfiles?: EmployeeProfileData[];
  companyId: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface EmployeeProfileData {
  id: string;
  userId: string;
  companyId: string;
  name?: string;
  email?: string;
  role?: Role;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  monthlyBudget: number;
  spentThisMonth?: number;
  remainingBudget?: number;
  jobTitle?: string | null;
  status: "ACTIVE" | "INACTIVE";
  user?: {
    id: string;
    name: string;
    email: string;
    role: Role;
    avatarUrl?: string | null;
  };
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type EmployeeData = EmployeeProfileData;

export interface PolicyData {
  id: string;
  name: string;
  description?: string | null;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  maxTransactionAmount: number;
  approvalThreshold: number;
  allowedCategories: string[];
  blockedCategories: string[];
  requireReceiptAbove: number;
  isActive: boolean;
  companyId: string;
}

export interface PolicyCheckResult {
  passed: boolean;
  decision: Decision;
  violations: string[];
  warnings: string[];
  requiresApproval: boolean;
  thresholdExceeded: boolean;
  budgetExceeded: boolean;
  categoryBlocked: boolean;
  receiptRequired: boolean;
  summary: string;
}

export interface AIAnalysisResult {
  riskScore: number;
  riskLevel: RiskLevel;
  category: string;
  reason: string;
  recommendation: Decision;
  anomaliesDetected: string[];
  suggestedCategory?: string;
  duplicateRiskScore?: number;
  isDuplicate?: boolean;
  duplicateExpenseId?: string;
  confidenceScore?: number;
}

export interface AIInsightItem {
  id: string;
  type: "warning" | "alert" | "info" | "success";
  title: string;
  description: string;
  metric?: string;
  actionable?: boolean;
  actionLabel?: string;
  actionLink?: string;
  timestamp: string;
}

export interface ReceiptExtractionResult {
  merchantName?: string;
  invoiceNumber?: string;
  amount?: number;
  date?: string;
  category?: string;
  taxAmount?: number;
  confidenceScore: number;
  rawText?: string;
}

export interface ExpenseData {
  id: string;
  expenseNumber: string;
  employeeProfileId?: string;
  employeeProfile?: EmployeeProfileData;
  employeeId?: string;
  employee?: {
    id: string;
    name: string;
    email: string;
    role?: Role;
    jobTitle?: string;
    monthlyBudget?: number;
    spentThisMonth?: number;
    userId?: string;
  };
  departmentId: string;
  department?: DepartmentData;
  merchantName: string;
  amount: number;
  currency: string;
  category: string;
  purpose: string;
  expenseDate: string | Date;
  status: ExpenseStatus;
  paymentStatus: PaymentStatus;
  decisionReason?: string | null;
  policyViolations?: string[];
  receiptUrl?: string | null;
  receipt?: {
    id: string;
    fileUrl: string;
    fileName: string;
  } | null;
  aiAnalysis?: {
    id?: string;
    riskScore: number;
    riskLevel: RiskLevel;
    reason: string;
    recommendation?: Decision;
    anomaliesDetected?: string[];
    suggestedCategory?: string | null;
    isDuplicate?: boolean;
  } | null;
  approvals?: any[];
  transactions?: any[];
  createdAt: string | Date;
}

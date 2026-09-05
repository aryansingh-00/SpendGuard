import fs from "fs";
import path from "path";
import crypto from "crypto";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

export const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

export interface StoredFileInfo {
  storageKey: string;
  fileHash: string;
  fileSize: number;
  fileName: string;
  mimeType: string;
}

export interface RetrievedFile {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export interface IFileStorageProvider {
  uploadFile(params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    companyId: string;
  }): Promise<StoredFileInfo>;
  retrieveFile(storageKey: string, companyId: string): Promise<RetrievedFile | null>;
  deleteFile(storageKey: string, companyId: string): Promise<boolean>;
  checkExists(storageKey: string, companyId: string): Promise<boolean>;
  validateFile(buffer: Buffer, fileName: string, mimeType: string): { valid: boolean; error?: string };
}

/**
 * Local Secure File Storage Implementation with Company Tenant Isolation & SHA-256 Hashing
 */
class LocalFileStorageProvider implements IFileStorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), "storage", "receipts");
  }

  public validateFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string
  ): { valid: boolean; error?: string } {
    if (!buffer || buffer.length === 0) {
      return { valid: false, error: "Empty file content received." };
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size exceeds the 10 MB limit (${(buffer.length / (1024 * 1024)).toFixed(1)} MB).`,
      };
    }

    const ext = path.extname(fileName).toLowerCase();
    const normalizedMime = mimeType?.toLowerCase();

    const isMimeSupported = SUPPORTED_MIME_TYPES.includes(normalizedMime);
    const isExtSupported = SUPPORTED_EXTENSIONS.includes(ext);

    if (!isMimeSupported && !isExtSupported) {
      return {
        valid: false,
        error: `Unsupported file type '${ext || mimeType}'. SpendGuard accepts PDF, JPG, PNG, and WEBP documents.`,
      };
    }

    // Security check: reject executable extensions
    const forbiddenExtensions = [".exe", ".bat", ".cmd", ".sh", ".js", ".ts", ".vbs", ".msi", ".dll", ".bin"];
    if (forbiddenExtensions.includes(ext)) {
      return { valid: false, error: "Executable and script files are strictly prohibited." };
    }

    return { valid: true };
  }

  public async uploadFile(params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    companyId: string;
  }): Promise<StoredFileInfo> {
    const { buffer, fileName, mimeType, companyId } = params;

    const validation = this.validateFile(buffer, fileName, mimeType);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Compute cryptographic SHA-256 hash
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Company-isolated directory
    const companyDir = path.join(this.baseDir, companyId);
    if (!fs.existsSync(companyDir)) {
      fs.mkdirSync(companyDir, { recursive: true });
    }

    // Sanitize file name
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFileName = `${fileHash.substring(0, 16)}_${sanitizedName}`;
    const filePath = path.join(companyDir, uniqueFileName);

    // Write file to disk
    await fs.promises.writeFile(filePath, buffer);

    const storageKey = `${companyId}/${uniqueFileName}`;

    return {
      storageKey,
      fileHash,
      fileSize: buffer.length,
      fileName,
      mimeType,
    };
  }

  public async retrieveFile(
    storageKey: string,
    companyId: string
  ): Promise<RetrievedFile | null> {
    // Prevent directory traversal attacks
    if (!storageKey || storageKey.includes("..") || !storageKey.startsWith(`${companyId}/`)) {
      throw new Error("Unauthorized storage access violation.");
    }

    const filePath = path.join(this.baseDir, storageKey);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const buffer = await fs.promises.readFile(filePath);
    const ext = path.extname(storageKey).toLowerCase();

    let mimeType = "application/octet-stream";
    if (ext === ".pdf") mimeType = "application/pdf";
    else if (ext === ".png") mimeType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".webp") mimeType = "image/webp";

    const fileName = storageKey.split("_").slice(1).join("_") || path.basename(storageKey);

    return {
      buffer,
      mimeType,
      fileName,
    };
  }

  public async deleteFile(storageKey: string, companyId: string): Promise<boolean> {
    if (!storageKey || storageKey.includes("..") || !storageKey.startsWith(`${companyId}/`)) {
      throw new Error("Unauthorized storage access violation.");
    }

    const filePath = path.join(this.baseDir, storageKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  }

  public async checkExists(storageKey: string, companyId: string): Promise<boolean> {
    if (!storageKey || storageKey.includes("..") || !storageKey.startsWith(`${companyId}/`)) {
      return false;
    }
    const filePath = path.join(this.baseDir, storageKey);
    return fs.existsSync(filePath);
  }
}

// Global Singleton Storage Instance
export const fileStorage: IFileStorageProvider = new LocalFileStorageProvider();

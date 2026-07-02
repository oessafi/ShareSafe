export type FileKind = "pdf" | "image";
export type AutoRedactionMode = "standard" | "anonymous_cv";

export type DetectionKind =
  | "Person name"
  | "Email"
  | "Moroccan phone"
  | "International phone"
  | "Moroccan CIN"
  | "CNSS"
  | "ICE"
  | "RIB"
  | "URL";

export interface DetectionItem {
  id: string;
  type: DetectionKind;
  value: string;
  count: number;
}

export interface DetectionSummary {
  items: DetectionItem[];
  totalMatches: number;
  extractedTextAvailable: boolean;
  warning?: string;
}

export interface PdfMaskRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageMaskData {
  pageNumber: number;
  rectangles: PdfMaskRectangle[];
  maskedCount: number;
}

export interface ProcessedFileResult {
  file: File;
  downloadUrl: string;
  finalSize: number;
  actionsApplied: string[];
  metadataNote?: string;
  downloadLabel?: string;
  redactedMatchCount?: number;
  detectedItemCount?: number;
}

export interface ImageProcessResult extends ProcessedFileResult {
  originalSize: number;
  compressedSize: number;
}

export interface BackendRedactionResult {
  file: File;
  redactedMatchCount: number;
  detectedItemCount?: number;
}

export interface WatermarkOptions {
  watermarkText: string;
  opacity: number;
}

export interface PdfProcessOptions extends WatermarkOptions {
  maskDetectedText: boolean;
}

export interface ImageProcessOptions extends WatermarkOptions {
  compressionQuality: number;
}

export interface PrivacyReportData {
  fileName: string;
  fileType: string;
  originalSize: number;
  detections: DetectionItem[];
  actionsApplied: string[];
  finalSize?: number;
  notes: string[];
}

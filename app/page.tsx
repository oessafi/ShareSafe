"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, LockKeyhole, ScanSearch, Shield } from "lucide-react";
import { DetectionReport } from "@/components/DetectionReport";
import { DetectedItemsTable } from "@/components/DetectedItemsTable";
import { FileUploader } from "@/components/FileUploader";
import { ImageTools } from "@/components/ImageTools";
import { PdfTools } from "@/components/PdfTools";
import { PrivacyReport } from "@/components/PrivacyReport";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { analyzePdfFile } from "@/lib/pdf-core";
import { detectSensitiveData } from "@/lib/detection";
import { formatFileSize, getFriendlyFileType, validateFile } from "@/lib/file-utils";
import type {
  DetectionSummary,
  FileKind,
  ImageProcessResult,
  PrivacyReportData,
  ProcessedFileResult,
} from "@/types";

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<FileKind | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DetectionSummary | null>(null);
  const [selectedDetectionIds, setSelectedDetectionIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pdfResult, setPdfResult] = useState<ProcessedFileResult | null>(null);
  const [imageResult, setImageResult] = useState<ImageProcessResult | null>(null);

  const analysisRunRef = useRef(0);

  useEffect(() => {
    return () => {
      if (pdfResult?.downloadUrl) {
        URL.revokeObjectURL(pdfResult.downloadUrl);
      }
      if (imageResult?.downloadUrl) {
        URL.revokeObjectURL(imageResult.downloadUrl);
      }
    };
  }, [imageResult?.downloadUrl, pdfResult?.downloadUrl]);

  const resetOutputs = () => {
    if (pdfResult?.downloadUrl) {
      URL.revokeObjectURL(pdfResult.downloadUrl);
    }
    if (imageResult?.downloadUrl) {
      URL.revokeObjectURL(imageResult.downloadUrl);
    }

    setPdfResult(null);
    setImageResult(null);
  };

  const clearSession = () => {
    analysisRunRef.current += 1;
    resetOutputs();
    setSelectedFile(null);
    setFileKind(null);
    setUploadError(null);
    setSummary(null);
    setSelectedDetectionIds([]);
    setIsAnalyzing(false);
  };

  const handleFileSelect = async (file: File) => {
    const validation = validateFile(file);
    if (!validation.kind || validation.error) {
      clearSession();
      setUploadError(validation.error);
      return;
    }

    const nextRunId = analysisRunRef.current + 1;
    analysisRunRef.current = nextRunId;

    setUploadError(null);
    setSelectedFile(file);
    setFileKind(validation.kind);
    resetOutputs();
    setSummary(null);
    setSelectedDetectionIds([]);

    if (validation.kind === "image") {
      setSummary({
        items: [],
        totalMatches: 0,
        extractedTextAvailable: false,
        warning:
          "OCR is disabled for images in this MVP, so text inside images is not scanned.",
      });
      setSelectedDetectionIds([]);
      return;
    }

    setIsAnalyzing(true);

    try {
      const extraction = await analyzePdfFile(file);
      if (analysisRunRef.current !== nextRunId) {
        return;
      }

      const items = extraction.text ? detectSensitiveData(extraction.text) : [];
      const totalMatches = items.reduce((total, item) => total + item.count, 0);
      setSelectedDetectionIds(items.map((item) => item.id));

      setSummary({
        items,
        totalMatches,
        extractedTextAvailable: Boolean(extraction.text),
        warning: extraction.warning,
      });
    } catch {
      if (analysisRunRef.current !== nextRunId) {
        return;
      }

      setSummary({
        items: [],
        totalMatches: 0,
        extractedTextAvailable: false,
        warning:
          "PDF text extraction failed. You can still use ShareSafe to add a visual watermark.",
      });
      setSelectedDetectionIds([]);
    } finally {
      if (analysisRunRef.current === nextRunId) {
        setIsAnalyzing(false);
      }
    }
  };

  const activeResult = fileKind === "pdf" ? pdfResult : imageResult;
  const selectedDetectionItems = useMemo(
    () =>
      (summary?.items ?? []).filter((item) => selectedDetectionIds.includes(item.id)),
    [selectedDetectionIds, summary?.items],
  );
  const selectedDetectionValues = useMemo(
    () => selectedDetectionItems.map((item) => item.value),
    [selectedDetectionItems],
  );
  const selectedMatchCount = useMemo(
    () => selectedDetectionItems.reduce((total, item) => total + item.count, 0),
    [selectedDetectionItems],
  );

  const privacyReport = useMemo<PrivacyReportData | null>(() => {
    if (!selectedFile) {
      return null;
    }

    const notes = [
      summary?.warning,
      activeResult?.metadataNote,
      selectedFile
        ? `Original upload: ${formatFileSize(selectedFile.size)}. Files stay in your browser unless your environment handles them differently.`
        : undefined,
    ].filter((note): note is string => Boolean(note));

    return {
      fileName: selectedFile.name,
      fileType: getFriendlyFileType(selectedFile),
      originalSize: selectedFile.size,
      detections: summary?.items ?? [],
      actionsApplied: activeResult?.actionsApplied ?? [],
      finalSize: activeResult?.finalSize,
      notes,
    };
  }, [activeResult, selectedFile, summary]);

  const handlePdfProcessed = (result: ProcessedFileResult) => {
    if (pdfResult?.downloadUrl) {
      URL.revokeObjectURL(pdfResult.downloadUrl);
    }

    setPdfResult(result);
  };

  const handleImageProcessed = (result: ImageProcessResult) => {
    if (imageResult?.downloadUrl) {
      URL.revokeObjectURL(imageResult.downloadUrl);
    }

    setImageResult(result);
  };

  return (
    <main className="pb-16">
      <section className="relative overflow-hidden px-6 pt-8 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-border/70 bg-card/55 px-6 py-8 shadow-soft backdrop-blur-sm sm:px-10">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <Badge>ShareSafe</Badge>
                <Badge variant="secondary">No AI</Badge>
                <Badge variant="outline">No account</Badge>
              </div>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl">
                  Clean your files before sharing.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                  Detect names, emails, phone numbers, Moroccan identifiers, and
                  sensitive patterns in PDFs and images. Add a watermark, auto-mask
                  sensitive PDF text through the backend, compress files, and
                  download a cleaner version.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a className={buttonVariants({ size: "lg" })} href="#workspace">
                  Start cleaning
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.8rem] border border-primary/10 bg-muted/40 p-6">
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <div className="rounded-[1.3rem] border border-border bg-card/80 p-4">
                    <ScanSearch className="h-6 w-6 text-primary" />
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      Local detection
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Names, emails, phones, CIN, CNSS, ICE, RIB, and URLs.
                    </p>
                  </div>
                  <div className="rounded-[1.3rem] border border-border bg-card/80 p-4">
                    <LockKeyhole className="h-6 w-6 text-accent" />
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      PDF redaction
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Auto-detect and redact searchable PDF text through the backend.
                    </p>
                  </div>
                  <div className="rounded-[1.3rem] border border-border bg-card/80 p-4">
                    <Shield className="h-6 w-6 text-primary" />
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      Watermark and export
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Keep watermarking local and download the cleaned file.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pt-8 sm:px-10 lg:px-12" id="workspace">
        <div className="mx-auto max-w-6xl space-y-8">
          <FileUploader
            error={uploadError}
            onClear={clearSession}
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
          />

          {selectedFile && fileKind ? (
            <>
              <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-8">
                  <DetectionReport
                    fileKind={fileKind}
                    isLoading={isAnalyzing}
                    summary={summary}
                  />
                  {fileKind === "pdf" && summary?.items.length ? (
                    <DetectedItemsTable
                      items={summary.items}
                      onClearSelection={() => setSelectedDetectionIds([])}
                      onSelectAll={() =>
                        setSelectedDetectionIds(summary.items.map((item) => item.id))
                      }
                      onToggle={(itemId) =>
                        setSelectedDetectionIds((current) =>
                          current.includes(itemId)
                            ? current.filter((candidate) => candidate !== itemId)
                            : [...current, itemId],
                        )
                      }
                      selectedIds={selectedDetectionIds}
                    />
                  ) : null}
                </div>

                {fileKind === "pdf" ? (
                  <PdfTools
                    detectionItems={summary?.items ?? []}
                    file={selectedFile}
                    hasExtractableText={Boolean(summary?.extractedTextAvailable)}
                    isAnalyzing={isAnalyzing}
                    onProcessed={handlePdfProcessed}
                    result={pdfResult}
                    selectedMatchCount={selectedMatchCount}
                    selectedValues={selectedDetectionValues}
                  />
                ) : (
                  <ImageTools
                    file={selectedFile}
                    onProcessed={handleImageProcessed}
                    result={imageResult}
                  />
                )}
              </div>

              {privacyReport ? <PrivacyReport report={privacyReport} /> : null}
            </>
          ) : (
            <div className="rounded-[1.8rem] border border-dashed border-border bg-card/60 px-6 py-10 text-center">
              <p className="text-lg font-semibold text-foreground">
                Upload a file to start a privacy pass
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                ShareSafe scans visible PDF text with local heuristics and offers
                redaction, watermarking, compression, and report export tools.
              </p>
            </div>
          )}
        </div>
      </section>

      <footer className="px-6 pt-10 text-center text-sm text-muted-foreground sm:px-10 lg:px-12">
        ShareSafe - No AI. No account. Files processed locally when possible.
      </footer>
    </main>
  );
}

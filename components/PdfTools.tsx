"use client";

import { useEffect, useState } from "react";
import type { AutoRedactionMode, DetectionItem, ProcessedFileResult } from "@/types";
import { autoRedactPdfWithBackend, redactPdfWithBackend } from "@/lib/api";
import { addWatermarkToPdf } from "@/lib/pdf-core";
import { formatFileSize } from "@/lib/file-utils";
import { RedactionActions } from "@/components/RedactionActions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PdfActionMode =
  | "watermark"
  | "redaction"
  | "combined"
  | "auto-redaction"
  | "auto-combined"
  | null;

interface PdfToolsProps {
  detectionItems: DetectionItem[];
  file: File;
  hasExtractableText: boolean;
  isAnalyzing: boolean;
  onProcessed: (result: ProcessedFileResult) => void;
  result: ProcessedFileResult | null;
  selectedMatchCount: number;
  selectedValues: string[];
}

export function PdfTools({
  detectionItems,
  file,
  hasExtractableText,
  isAnalyzing,
  onProcessed,
  result,
  selectedMatchCount,
  selectedValues,
}: PdfToolsProps) {
  const [autoRedactionMode, setAutoRedactionMode] =
    useState<AutoRedactionMode>("standard");
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.18);
  const [activeMode, setActiveMode] = useState<PdfActionMode>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedCount = selectedValues.length;
  const isBusy = activeMode !== null;
  const isRedactionRunning = activeMode === "redaction" || activeMode === "combined";
  const isWatermarkRunning = activeMode === "watermark" || activeMode === "combined";
  const isAutoRedactionRunning =
    activeMode === "auto-redaction" || activeMode === "auto-combined";
  const isAutoCombinedRunning = activeMode === "auto-combined";
  const autoModeLabel =
    autoRedactionMode === "anonymous_cv" ? "Anonymous CV" : "Standard privacy";

  useEffect(() => {
    setActiveMode(null);
    setError(null);
    setStatusMessage(null);
  }, [file.name, file.size, file.lastModified]);

  const buildProcessedResult = (
    outputFile: File,
    options: {
      actionsApplied: string[];
      downloadLabel: string;
      metadataNote: string;
      redactedMatchCount?: number;
      detectedItemCount?: number;
    },
  ): ProcessedFileResult => ({
    file: outputFile,
    finalSize: outputFile.size,
    downloadUrl: URL.createObjectURL(outputFile),
    actionsApplied: options.actionsApplied,
    metadataNote: options.metadataNote,
    downloadLabel: options.downloadLabel,
    redactedMatchCount: options.redactedMatchCount,
    detectedItemCount: options.detectedItemCount,
  });

  const applyWatermarkOnly = async () => {
    try {
      setActiveMode("watermark");
      setError(null);
      setStatusMessage(null);

      const { file: output } = await addWatermarkToPdf(file, {
        watermarkText,
        opacity,
        maskDetectedText: false,
      });

      onProcessed(
        buildProcessedResult(output, {
          actionsApplied: [
            "PDF watermark applied to every page",
            "Basic PDF metadata minimized",
          ],
          downloadLabel: "Download watermarked PDF",
          metadataNote: "Watermark is visible but does not hide or remove PDF text.",
        }),
      );
      setStatusMessage("Watermark applied. This does not hide or remove PDF text.");
    } catch (processingError) {
      setError(
        processingError instanceof Error
          ? processingError.message
          : "Failed to add the watermark to the PDF.",
      );
    } finally {
      setActiveMode(null);
    }
  };

  const applyBackendRedaction = async (includeWatermark: boolean) => {
    try {
      setActiveMode(includeWatermark ? "combined" : "redaction");
      setError(null);
      setStatusMessage(null);

      const redacted = await redactPdfWithBackend(file, selectedValues);
      let outputFile = redacted.file;
      const actionsApplied = [
        `${redacted.redactedMatchCount} PDF match${
          redacted.redactedMatchCount === 1 ? "" : "es"
        } redacted with PyMuPDF`,
      ];

      if (includeWatermark) {
        const watermarked = await addWatermarkToPdf(redacted.file, {
          watermarkText,
          opacity,
          maskDetectedText: false,
        });
        outputFile = new File([watermarked.file], "sharesafe-redacted-watermarked.pdf", {
          type: "application/pdf",
        });
        actionsApplied.push("PDF watermark applied to every page");
        actionsApplied.push("Basic PDF metadata minimized after watermarking");
      }

      onProcessed(
        buildProcessedResult(outputFile, {
          actionsApplied,
          downloadLabel: includeWatermark
            ? "Download masked + watermarked PDF"
            : "Download masked PDF",
          metadataNote: includeWatermark
            ? "PyMuPDF backend applied PDF redaction before the watermark was added. Redacted text should no longer be copyable from those areas."
            : "PyMuPDF backend applied PDF redaction. Redacted text should no longer be copyable from those areas.",
          redactedMatchCount: redacted.redactedMatchCount,
        }),
      );

      if (redacted.redactedMatchCount > 0) {
        setStatusMessage(
          includeWatermark
            ? `${redacted.redactedMatchCount} PDF match${
                redacted.redactedMatchCount === 1 ? "" : "es"
              } redacted, then watermark applied.`
            : `${redacted.redactedMatchCount} PDF match${
                redacted.redactedMatchCount === 1 ? "" : "es"
              } redacted with PyMuPDF.`,
        );
      } else {
        setStatusMessage(
          "No exact PDF text matches were found for the selected values. Review the exported file before sharing it.",
        );
      }
    } catch (processingError) {
      setError(
        processingError instanceof Error
          ? processingError.message
          : "Failed to redact the PDF with the backend.",
      );
    } finally {
      setActiveMode(null);
    }
  };

  const applyAutoBackendRedaction = async (includeWatermark: boolean) => {
    try {
      setActiveMode(includeWatermark ? "auto-combined" : "auto-redaction");
      setError(null);
      setStatusMessage(null);

      const redacted = await autoRedactPdfWithBackend(file, autoRedactionMode);
      let outputFile = redacted.file;
      const actionsApplied = [
        `${autoModeLabel} auto-mask mode used`,
        `${redacted.detectedItemCount ?? 0} sensitive value${
          redacted.detectedItemCount === 1 ? "" : "s"
        } auto-detected by the backend`,
        `${redacted.redactedMatchCount} PDF match${
          redacted.redactedMatchCount === 1 ? "" : "es"
        } auto-redacted with PyMuPDF`,
      ];

      if (includeWatermark) {
        const watermarked = await addWatermarkToPdf(redacted.file, {
          watermarkText,
          opacity,
          maskDetectedText: false,
        });
        outputFile = new File(
          [watermarked.file],
          "sharesafe-auto-redacted-watermarked.pdf",
          {
            type: "application/pdf",
          },
        );
        actionsApplied.push("PDF watermark applied to every page");
        actionsApplied.push("Basic PDF metadata minimized after watermarking");
      }

      onProcessed(
        buildProcessedResult(outputFile, {
          actionsApplied,
          downloadLabel: includeWatermark
            ? "Download auto-masked + watermarked PDF"
            : "Download auto-masked PDF",
          metadataNote: includeWatermark
            ? `PyMuPDF backend auto-detected and redacted searchable PDF text in ${autoModeLabel} mode before the watermark was added. Redacted text should no longer be copyable from those areas.`
            : `PyMuPDF backend auto-detected and redacted searchable PDF text in ${autoModeLabel} mode. Redacted text should no longer be copyable from those areas.`,
          redactedMatchCount: redacted.redactedMatchCount,
          detectedItemCount: redacted.detectedItemCount,
        }),
      );

      setStatusMessage(
        includeWatermark
          ? `${autoModeLabel}: ${redacted.detectedItemCount ?? 0} sensitive value${
              redacted.detectedItemCount === 1 ? "" : "s"
            } detected, ${redacted.redactedMatchCount} PDF match${
              redacted.redactedMatchCount === 1 ? "" : "es"
            } redacted, then watermark applied.`
          : `${autoModeLabel}: ${redacted.detectedItemCount ?? 0} sensitive value${
              redacted.detectedItemCount === 1 ? "" : "s"
            } detected and ${redacted.redactedMatchCount} PDF match${
              redacted.redactedMatchCount === 1 ? "" : "es"
            } redacted with PyMuPDF.`,
      );
    } catch (processingError) {
      setError(
        processingError instanceof Error
          ? processingError.message
          : "Failed to auto-redact the PDF with the backend.",
      );
    } finally {
      setActiveMode(null);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>PDF watermark and redaction</CardTitle>
        <CardDescription>
          Keep watermarking local in the browser, and use the PyMuPDF backend path
          when you need PDF text to be redacted instead of merely covered visually.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Watermark text</span>
          <Input
            maxLength={40}
            onChange={(event) => setWatermarkText(event.target.value)}
            placeholder="CONFIDENTIAL"
            value={watermarkText}
          />
        </label>

        <label className="block space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-foreground">Opacity</span>
            <span className="text-muted-foreground">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            className="range-track w-full"
            max={0.7}
            min={0.1}
            onChange={(event) => setOpacity(Number(event.target.value))}
            step={0.05}
            type="range"
            value={opacity}
          />
        </label>

        {isAnalyzing ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
            PDF text extraction is still running. Wait for the detected values to
            finish loading before sending a redaction request.
          </div>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Redaction mode</span>
          <select
            className="h-11 w-full rounded-[1rem] border border-border bg-card/80 px-4 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) =>
              setAutoRedactionMode(event.target.value as AutoRedactionMode)
            }
            value={autoRedactionMode}
          >
            <option value="standard">Standard privacy</option>
            <option value="anonymous_cv">Anonymous CV</option>
          </select>
        </label>

        {!hasExtractableText && detectionItems.length === 0 ? (
          <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-foreground">
            No selectable PDF text was found. Watermarking still works, but backend
            redaction depends on searchable PDF text.
          </div>
        ) : null}

        <RedactionActions
          detectedItemCount={detectionItems.length}
          detectedMatchCount={detectionItems.reduce((total, item) => total + item.count, 0)}
          error={error}
          isAutoCombinedRunning={isAutoCombinedRunning}
          isAutoRedactionRunning={isAutoRedactionRunning}
          isBusy={isBusy}
          isRedactionRunning={isRedactionRunning}
          isWatermarkRunning={isWatermarkRunning}
          onAutoMask={() => void applyAutoBackendRedaction(false)}
          onAutoMaskAndWatermark={() => void applyAutoBackendRedaction(true)}
          onMaskAndWatermark={() => void applyBackendRedaction(true)}
          onMaskSelected={() => void applyBackendRedaction(false)}
          onWatermarkOnly={() => void applyWatermarkOnly()}
          result={result}
          selectedCount={selectedCount}
          selectedMatchCount={selectedMatchCount}
          statusMessage={statusMessage}
        />

        {result ? (
          <div className="rounded-[1.4rem] border border-border bg-muted/35 p-4 text-sm">
            <p className="font-semibold text-foreground">{result.file.name}</p>
            <p className="mt-2 text-muted-foreground">
              Final size: {formatFileSize(result.finalSize)}
            </p>
            {typeof result.redactedMatchCount === "number" ? (
              <p className="mt-1 text-muted-foreground">
                Redacted PDF matches: {result.redactedMatchCount}
              </p>
            ) : null}
            {typeof result.detectedItemCount === "number" ? (
              <p className="mt-1 text-muted-foreground">
                Detected sensitive values: {result.detectedItemCount}
              </p>
            ) : null}
            <p className="mt-1 text-muted-foreground">
              Review the exported PDF before sharing it.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

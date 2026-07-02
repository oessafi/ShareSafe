"use client";

import { Download, FilePenLine, Shield } from "lucide-react";
import type { ProcessedFileResult } from "@/types";
import { triggerDownload } from "@/lib/file-utils";
import { Button } from "@/components/ui/button";

interface RedactionActionsProps {
  detectedItemCount: number;
  detectedMatchCount: number;
  error: string | null;
  isAutoCombinedRunning: boolean;
  isAutoRedactionRunning: boolean;
  isBusy: boolean;
  isRedactionRunning: boolean;
  isWatermarkRunning: boolean;
  onAutoMask: () => void;
  onAutoMaskAndWatermark: () => void;
  result: ProcessedFileResult | null;
  selectedCount: number;
  selectedMatchCount: number;
  statusMessage: string | null;
  onMaskSelected: () => void;
  onMaskAndWatermark: () => void;
  onWatermarkOnly: () => void;
}

export function RedactionActions({
  detectedItemCount,
  detectedMatchCount,
  error,
  isAutoCombinedRunning,
  isAutoRedactionRunning,
  isBusy,
  isRedactionRunning,
  isWatermarkRunning,
  onAutoMask,
  onAutoMaskAndWatermark,
  result,
  selectedCount,
  selectedMatchCount,
  statusMessage,
  onMaskSelected,
  onMaskAndWatermark,
  onWatermarkOnly,
}: RedactionActionsProps) {
  const maskDisabled = isBusy || selectedCount === 0;
  const autoMaskDisabled = isBusy;

  return (
    <div className="space-y-4">
      <div className="rounded-[1.3rem] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Watermark adds visible text only. The PyMuPDF backend path removes matched
        PDF text from selected areas and replaces it with black redaction boxes.
      </div>

      <div className="rounded-[1.3rem] border border-primary/15 bg-primary/5 p-4 text-sm text-foreground">
        {detectedItemCount > 0
          ? `${detectedItemCount} sensitive value${
              detectedItemCount > 1 ? "s" : ""
            } detected locally across ${detectedMatchCount} match${
              detectedMatchCount > 1 ? "es" : ""
            }. Auto mask ignores the checkboxes and uses the selected redaction mode to let the backend detect values directly from the PDF.`
          : "Auto mask sends the original PDF to the backend, which detects emails, phone numbers, CIN-like values, URLs, and identity lines depending on the selected redaction mode before applying real PDF redaction."}
      </div>

      <div className="rounded-[1.3rem] border border-primary/15 bg-primary/5 p-4 text-sm text-foreground">
        {selectedCount > 0
          ? `${selectedCount} detected value${selectedCount > 1 ? "s" : ""} selected across ${selectedMatchCount} match${selectedMatchCount > 1 ? "es" : ""}.`
          : "No sensitive values selected."}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button disabled={isBusy} onClick={onWatermarkOnly} variant="secondary">
          <FilePenLine className="mr-2 h-4 w-4" />
          {isWatermarkRunning ? "Adding watermark..." : "Add watermark"}
        </Button>
        <Button disabled={autoMaskDisabled} onClick={onAutoMask}>
          <Shield className="mr-2 h-4 w-4" />
          {isAutoRedactionRunning && !isAutoCombinedRunning
            ? "Auto masking sensitive data..."
            : "Auto mask sensitive data"}
        </Button>
        <Button
          disabled={autoMaskDisabled}
          onClick={onAutoMaskAndWatermark}
          variant="outline"
        >
          <Shield className="mr-2 h-4 w-4" />
          {isAutoCombinedRunning
            ? "Auto masking data + adding watermark..."
            : "Watermark + auto mask"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button disabled={maskDisabled} onClick={onMaskSelected}>
          <Shield className="mr-2 h-4 w-4" />
          {isRedactionRunning ? "Masking selected data..." : "Mask selected data"}
        </Button>
        <Button disabled={maskDisabled} onClick={onMaskAndWatermark} variant="outline">
          <Shield className="mr-2 h-4 w-4" />
          {isRedactionRunning && isWatermarkRunning
            ? "Masking data + adding watermark..."
            : "Add watermark + mask selected data"}
        </Button>
        {result ? (
          <Button
            onClick={() => triggerDownload(result.downloadUrl, result.file.name)}
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            {result.downloadLabel ?? "Download PDF"}
          </Button>
        ) : null}
      </div>

      {statusMessage ? (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
          {statusMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}

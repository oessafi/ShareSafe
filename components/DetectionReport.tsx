"use client";

import type { DetectionSummary, FileKind } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DetectionReportProps {
  fileKind: FileKind;
  summary: DetectionSummary | null;
  isLoading: boolean;
}

export function DetectionReport({
  fileKind,
  summary,
  isLoading,
}: DetectionReportProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Detection report</Badge>
          {summary ? <Badge variant="secondary">{summary.totalMatches} matches</Badge> : null}
        </div>
        <div>
          <CardTitle>Local anonymization scan</CardTitle>
          <CardDescription>
            Detection is local and heuristic. Review the result before sharing.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="rounded-[1.4rem] border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
            Extracting visible text from the PDF and scanning for sensitive patterns.
          </div>
        ) : null}

        {!isLoading && fileKind === "image" ? (
          <div className="rounded-[1.4rem] border border-border bg-muted/40 p-5">
            <p className="font-semibold text-foreground">Image scan unavailable in this MVP</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              OCR is disabled for images, so ShareSafe only offers compression,
              watermarking, and basic metadata stripping through re-encoding.
            </p>
          </div>
        ) : null}

        {!isLoading && fileKind === "pdf" && summary?.warning ? (
          <div className="rounded-[1.4rem] border border-accent/30 bg-accent/10 p-4 text-sm text-foreground">
            {summary.warning}
          </div>
        ) : null}

        {!isLoading && fileKind === "pdf" && summary?.items.length ? (
          <div className="rounded-[1.3rem] border border-primary/15 bg-primary/5 p-4 text-sm text-foreground">
            Detected values are ready for review. Use the PyMuPDF backend actions to
            redact selected PDF text, or apply a separate visible watermark locally.
          </div>
        ) : null}

        {!isLoading && fileKind === "pdf" && summary && summary.items.length === 0 ? (
          <div className="rounded-[1.4rem] border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
            No matches were detected in visible PDF text. If the file is scanned or
            image-based, text inside the pages may not be available to regex scanning.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

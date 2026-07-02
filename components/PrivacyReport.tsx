"use client";

import { Download, FileText } from "lucide-react";
import type { PrivacyReportData } from "@/types";
import { buildPrivacyReportText, formatFileSize } from "@/lib/file-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PrivacyReportProps {
  report: PrivacyReportData;
}

export function PrivacyReport({ report }: PrivacyReportProps) {
  const handleDownload = () => {
    const blob = new Blob([buildPrivacyReportText(report)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${report.fileName.replace(/\.[^.]+$/, "")}-privacy-report.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="accent">Privacy report</Badge>
          <Badge variant="outline">{report.fileType}</Badge>
        </div>
        <div>
          <CardTitle>Summary ready to export</CardTitle>
          <CardDescription>
            Review detected items and the actions applied to the downloadable file.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.3rem] border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              File name
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">{report.fileName}</p>
          </div>
          <div className="rounded-[1.3rem] border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Original size
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatFileSize(report.originalSize)}
            </p>
          </div>
          <div className="rounded-[1.3rem] border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Detections
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {report.detections.length}
            </p>
          </div>
          <div className="rounded-[1.3rem] border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Final size
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {report.finalSize ? formatFileSize(report.finalSize) : "Pending"}
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.4rem] border border-border p-4">
            <p className="text-sm font-semibold text-foreground">Detected sensitive items</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {report.detections.length > 0 ? (
                report.detections.map((item) => (
                  <Badge key={item.id} variant="secondary">
                    {item.type}: {item.value} ({item.count})
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No items detected.</p>
              )}
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-border p-4">
            <p className="text-sm font-semibold text-foreground">Actions applied</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {report.actionsApplied.length > 0 ? (
                report.actionsApplied.map((action) => (
                  <Badge key={action} variant="outline">
                    {action}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Process the file to populate this list.
                </p>
              )}
            </div>
          </div>
        </div>

        {report.notes.length > 0 ? (
          <div className="rounded-[1.4rem] border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
            {report.notes.join(" ")}
          </div>
        ) : null}

        <Button onClick={handleDownload} variant="secondary">
          <FileText className="mr-2 h-4 w-4" />
          Download report as .txt
          <Download className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

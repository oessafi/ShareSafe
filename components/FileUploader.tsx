"use client";

import { useRef, useState } from "react";
import { FileUp, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatFileSize, getFriendlyFileType } from "@/lib/file-utils";

interface FileUploaderProps {
  selectedFile: File | null;
  error: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
}

export function FileUploader({
  selectedFile,
  error,
  onFileSelect,
  onClear,
}: FileUploaderProps) {
  const inputId = "sharesafe-file-upload";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <Card className="overflow-hidden border-primary/10">
      <CardHeader className="gap-4 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Local-first workflow</Badge>
          <Badge variant="secondary">20MB max</Badge>
          <Badge variant="outline">PDF + images</Badge>
        </div>
        <div>
          <CardTitle className="text-2xl">Upload a file to inspect and clean</CardTitle>
          <CardDescription>
            Drag and drop a PDF, PNG, JPG, JPEG, or WEBP file. Nothing is sent to
            external services.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`group flex min-h-[220px] w-full flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed px-6 text-center transition ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/35 hover:border-primary/50 hover:bg-primary/5"
          }`}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget.contains(event.relatedTarget as Node)) {
              return;
            }
            setIsDragging(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
          role="button"
          tabIndex={0}
        >
          <div className="mb-5 rounded-full border border-primary/15 bg-card p-4 text-primary transition group-hover:scale-105">
            {selectedFile ? <ShieldCheck className="h-10 w-10" /> : <FileUp className="h-10 w-10" />}
          </div>
          <p className="text-lg font-semibold text-foreground">
            {selectedFile ? "Replace current file" : "Drop a file here or browse"}
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Supported formats: PDF, PNG, JPG, JPEG, WEBP. File size limit: 20MB.
          </p>
        </div>

        <input
          id={inputId}
          ref={inputRef}
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
          type="file"
        />

        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {selectedFile ? (
          <div className="rounded-[1.4rem] border border-border/80 bg-card/70 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{selectedFile.name}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{getFriendlyFileType(selectedFile)}</Badge>
                  <Badge variant="secondary">{formatFileSize(selectedFile.size)}</Badge>
                </div>
              </div>
              <Button onClick={onClear} size="sm" variant="ghost">
                <X className="mr-2 h-4 w-4" />
                Clear file
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

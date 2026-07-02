"use client";

import { useState } from "react";
import { Download, ImageDown } from "lucide-react";
import type { ImageProcessResult } from "@/types";
import { formatFileSize, triggerDownload } from "@/lib/file-utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

interface ImageToolsProps {
  file: File;
  result: ImageProcessResult | null;
  onProcessed: (result: ImageProcessResult) => void;
}

export function ImageTools({ file, result, onProcessed }: ImageToolsProps) {
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.2);
  const [compressionQuality, setCompressionQuality] = useState(0.72);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    try {
      setError(null);
      setIsProcessing(true);
      setProgress(0);

      const { processImageFile } = await import("@/lib/image-utils");
      const output = await processImageFile(
        file,
        {
          watermarkText,
          opacity,
          compressionQuality,
        },
        setProgress,
      );

      onProcessed(output);
    } catch (processingError) {
      setError(
        processingError instanceof Error
          ? processingError.message
          : "Failed to process the image.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Image tools</CardTitle>
        <CardDescription>
          Compress the image, add a visible watermark, and re-encode it to reduce
          basic metadata where possible.
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
            <span className="font-semibold text-foreground">Compression quality</span>
            <span className="text-muted-foreground">
              {Math.round(compressionQuality * 100)}%
            </span>
          </div>
          <input
            className="range-track w-full"
            max={0.95}
            min={0.35}
            onChange={(event) => setCompressionQuality(Number(event.target.value))}
            step={0.05}
            type="range"
            value={compressionQuality}
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

        {isProcessing ? (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">Processing image locally...</p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button disabled={isProcessing} onClick={handleProcess}>
            <ImageDown className="mr-2 h-4 w-4" />
            {isProcessing ? "Processing image..." : "Process image"}
          </Button>
          {result ? (
            <Button
              onClick={() => triggerDownload(result.downloadUrl, result.file.name)}
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Download image
            </Button>
          ) : null}
        </div>

        {result ? (
          <div className="rounded-[1.4rem] border border-border bg-muted/35 p-4 text-sm">
            <p className="font-semibold text-foreground">{result.file.name}</p>
            <p className="mt-2 text-muted-foreground">
              Before: {formatFileSize(result.originalSize)}
            </p>
            <p className="mt-1 text-muted-foreground">
              After compression: {formatFileSize(result.compressedSize)}
            </p>
            <p className="mt-1 text-muted-foreground">
              Final download size: {formatFileSize(result.finalSize)}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

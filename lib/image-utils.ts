import imageCompression from "browser-image-compression";
import type { ImageProcessOptions, ImageProcessResult } from "@/types";
import { buildOutputName } from "@/lib/file-utils";

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read the selected image."));
    };

    image.src = url;
  });
}

async function addWatermarkToImage(file: File, text: string, opacity: number) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available in this browser.");
  }

  context.drawImage(image, 0, 0);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((-28 * Math.PI) / 180);
  context.globalAlpha = opacity;
  context.fillStyle = "#a22824";
  context.textAlign = "center";
  context.textBaseline = "middle";

  const fontSize = Math.max(24, Math.min(canvas.width, canvas.height) * 0.08);
  context.font = `700 ${fontSize}px sans-serif`;

  const rows = [-fontSize * 1.8, 0, fontSize * 1.8];
  rows.forEach((offset) => {
    context.fillText(text || "CONFIDENTIAL", 0, offset);
  });

  context.restore();

  const outputType = file.type || "image/jpeg";
  const quality = outputType === "image/png" ? undefined : 0.92;

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outputType, quality),
  );

  if (!blob) {
    throw new Error("Failed to export the processed image.");
  }

  const extension = outputType.includes("png")
    ? "png"
    : outputType.includes("webp")
      ? "webp"
      : "jpg";

  return new File([blob], buildOutputName(file.name, "-sharesafe", extension), {
    type: outputType,
  });
}

export async function processImageFile(
  file: File,
  options: ImageProcessOptions,
  onProgress?: (progress: number) => void,
): Promise<ImageProcessResult> {
  const qualityFactor = Math.min(1, Math.max(0.35, options.compressionQuality));
  const originalSizeMb = file.size / (1024 * 1024);

  onProgress?.(10);

  const compressed = await imageCompression(file, {
    maxSizeMB: Math.max(0.2, originalSizeMb * qualityFactor * 0.9),
    maxWidthOrHeight: 2400,
    useWebWorker: true,
    initialQuality: qualityFactor,
    preserveExif: false,
    fileType: file.type || "image/jpeg",
    onProgress: (progress) => {
      onProgress?.(Math.min(85, Math.round(progress * 0.85)));
    },
  });

  onProgress?.(92);
  const watermarked = await addWatermarkToImage(
    compressed,
    options.watermarkText.trim() || "CONFIDENTIAL",
    options.opacity,
  );
  onProgress?.(100);

  return {
    file: watermarked,
    finalSize: watermarked.size,
    originalSize: file.size,
    compressedSize: compressed.size,
    actionsApplied: [
      "Image compressed",
      "Watermark added",
      "Image re-encoded to reduce basic metadata",
    ],
    metadataNote:
      "Images are re-encoded locally, which usually removes basic embedded metadata.",
    downloadUrl: URL.createObjectURL(watermarked),
  };
}

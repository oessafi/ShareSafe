import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import {
  cnssPatternSource,
  emailDomainPatternSource,
  emailPatternSource,
  findSensitiveDataMatches,
  icePatternSource,
  internationalPhonePatternSource,
  moroccanCinPatternSource,
  moroccanPhonePatternSource,
  ribPatternSource,
} from "@/lib/detection";
import type { PdfPageMaskData, PdfProcessOptions } from "@/types";
import { buildOutputName } from "@/lib/file-utils";

let workerConfigured = false;

type TextSegment = {
  text: string;
  start: number;
  end: number;
  x: number;
  top: number;
  width: number;
  height: number;
  hasEOL: boolean;
};

type TextLayout = {
  text: string;
  segments: TextSegment[];
};

type MaskRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const riskySegmentPatterns = [
  new RegExp(emailPatternSource, "i"),
  new RegExp(moroccanPhonePatternSource, "i"),
  new RegExp(internationalPhonePatternSource, "i"),
  new RegExp(moroccanCinPatternSource, "i"),
  new RegExp(cnssPatternSource, "i"),
  new RegExp(icePatternSource, "i"),
  new RegExp(ribPatternSource, "i"),
  /\b(?:https?:\/\/|www\.)[^\s<>"')]+/i,
  new RegExp(String.raw`\b${emailDomainPatternSource}\b`, "i"),
  /\b(?:linkedin|github)\b/i,
];

const riskyLinePatterns = [
  new RegExp(emailPatternSource, "i"),
  new RegExp(moroccanPhonePatternSource, "i"),
  new RegExp(internationalPhonePatternSource, "i"),
  new RegExp(moroccanCinPatternSource, "i"),
  new RegExp(cnssPatternSource, "i"),
  new RegExp(icePatternSource, "i"),
  new RegExp(ribPatternSource, "i"),
  /\b(?:https?:\/\/|www\.)[^\s<>"')]+/i,
  new RegExp(String.raw`\b${emailDomainPatternSource}\b`, "i"),
  /\b(?:linkedin|github)\b/i,
];

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerConfigured = true;
  }

  return pdfjs;
}

export async function analyzePdfFile(file: File) {
  const pdfjs = await loadPdfJs();
  const data = await file.arrayBuffer();

  try {
    return await extractPdfAnalysis(pdfjs, data, false);
  } catch (workerError) {
    console.warn("ShareSafe PDF extraction retrying without worker.", workerError);

    try {
      const fallbackResult = await extractPdfAnalysis(pdfjs, data, true);

      return fallbackResult.text
        ? {
            ...fallbackResult,
            warning:
              fallbackResult.warning ??
              "PDF text extraction recovered in compatibility mode. Review the masked export carefully.",
          }
        : fallbackResult;
    } catch {
      return {
        text: "",
        pageMasks: [],
        warning:
          "Text extraction failed for this PDF. You can still apply visual masking and watermarking.",
      };
    }
  }
}

async function extractPdfAnalysis(
  pdfjs: Awaited<ReturnType<typeof loadPdfJs>>,
  data: ArrayBuffer,
  disableWorker: boolean,
) {
  const loadingTask = pdfjs.getDocument(
    { data, disableWorker } as Parameters<typeof pdfjs.getDocument>[0],
  );

  try {
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    const pageMasks: PdfPageMaskData[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const layout = buildPageTextLayout(content, viewport, pdfjs);
      const masks = buildMaskRectangles(layout);
      const text = layout.text;

      if (text) {
        pages.push(text);
      }

      pageMasks.push({
        pageNumber,
        maskedCount: masks.maskedCount,
        rectangles: masks.rectangles.map((rectangle) => ({
          x: rectangle.x,
          y: viewport.height - (rectangle.y + rectangle.height),
          width: rectangle.width,
          height: rectangle.height,
        })),
      });
    }

    await pdf.destroy();

    if (pages.length === 0) {
      return {
        text: "",
        pageMasks,
        warning:
          "No selectable text was found. This PDF may be scanned or image-based.",
      };
    }

    return {
      text: pages.join("\n"),
      pageMasks,
      warning: undefined,
    };
  } finally {
    void loadingTask.destroy();
  }
}

function clearPdfMetadata(pdfDoc: PDFDocument) {
  pdfDoc.setTitle("");
  pdfDoc.setAuthor("");
  pdfDoc.setSubject("");
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer("ShareSafe");
  pdfDoc.setCreator("ShareSafe");
}

function buildPageTextLayout(
  textContent: {
    items: Array<Record<string, unknown>>;
  },
  viewport: { scale: number; transform: number[] },
  pdfjs: Awaited<ReturnType<typeof loadPdfJs>>,
): TextLayout {
  const segments: TextSegment[] = [];
  let text = "";

  textContent.items.forEach((item) => {
    const textValue = typeof item.str === "string" ? item.str : null;
    if (!textValue) {
      return;
    }

    const cleanedText = textValue.replace(/\s+/g, " ").trim();
    if (!cleanedText) {
      return;
    }

    const transform = pdfjs.Util.transform(
      viewport.transform,
      Array.isArray(item.transform) ? (item.transform as number[]) : [1, 0, 0, 1, 0, 0],
    );
    const widthValue = typeof item.width === "number" ? item.width : 0;
    const heightValue = typeof item.height === "number" ? item.height : 0;
    const width = Math.max(4, Math.abs(widthValue * viewport.scale));
    const height = Math.max(
      10,
      Math.abs(heightValue * viewport.scale) || Math.hypot(transform[2], transform[3]),
    );
    const hasEOL = item.hasEOL === true;

    if (text.length > 0) {
      text += segments[segments.length - 1]?.hasEOL ? "\n" : " ";
    }

    const start = text.length;
    text += cleanedText;

    segments.push({
      text: cleanedText,
      start,
      end: text.length,
      x: transform[4],
      top: transform[5] - height,
      width,
      height,
      hasEOL,
    });
  });

  return { text, segments };
}

function buildMaskRectangles(layout: TextLayout) {
  const uniqueMatches = new Map<string, ReturnType<typeof findSensitiveDataMatches>[number]>();

  findSensitiveDataMatches(layout.text).forEach((match) => {
    const key = `${match.start}:${match.end}:${match.normalizedValue}`;
    if (!uniqueMatches.has(key)) {
      uniqueMatches.set(key, match);
    }
  });

  const rectangles: MaskRectangle[] = [];

  uniqueMatches.forEach((match) => {
    layout.segments.forEach((segment) => {
      if (segment.end <= match.start || segment.start >= match.end) {
        return;
      }

      const localStart = Math.max(0, match.start - segment.start);
      const localEnd = Math.min(segment.text.length, match.end - segment.start);

      if (localEnd <= localStart) {
        return;
      }

      const ratioStart = localStart / Math.max(1, segment.text.length);
      const ratioEnd = localEnd / Math.max(1, segment.text.length);
      const paddingX = Math.min(8, segment.width * 0.06);
      const paddingY = Math.min(4, segment.height * 0.18);

      rectangles.push({
        x: Math.max(0, segment.x + segment.width * ratioStart - paddingX),
        y: Math.max(0, segment.top - paddingY),
        width: Math.max(12, segment.width * (ratioEnd - ratioStart) + paddingX * 2),
        height: Math.max(12, segment.height + paddingY * 2),
      });
    });
  });

  rectangles.sort((left, right) => left.y - right.y || left.x - right.x);

  const heuristicRectangles: MaskRectangle[] = [];

  layout.segments.forEach((segment) => {
    const segmentText = segment.text.trim();
    if (!segmentText) {
      return;
    }

    const isRisky = riskySegmentPatterns.some((pattern) => pattern.test(segmentText));
    if (!isRisky) {
      return;
    }

    const paddingX = Math.min(10, segment.width * 0.08);
    const paddingY = Math.min(5, segment.height * 0.22);

    heuristicRectangles.push({
      x: Math.max(0, segment.x - paddingX),
      y: Math.max(0, segment.top - paddingY),
      width: Math.max(14, segment.width + paddingX * 2),
      height: Math.max(14, segment.height + paddingY * 2),
    });
  });

  const lineRectangles = buildRiskyLineRectangles(layout.segments);
  const merged = mergeMaskRectangles([
    ...rectangles,
    ...heuristicRectangles,
    ...lineRectangles,
  ]);

  return {
    rectangles: merged,
    maskedCount: Math.max(uniqueMatches.size, merged.length),
  };
}

function mergeMaskRectangles(rectangles: MaskRectangle[]) {
  rectangles.sort((left, right) => left.y - right.y || left.x - right.x);

  const merged: MaskRectangle[] = [];

  rectangles.forEach((rectangle) => {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push(rectangle);
      return;
    }

    const sameLine =
      Math.abs(previous.y - rectangle.y) <= Math.max(previous.height, rectangle.height) * 0.45;
    const overlapsHorizontally =
      rectangle.x <= previous.x + previous.width + 8 &&
      rectangle.x + rectangle.width >= previous.x - 8;

    if (sameLine && overlapsHorizontally) {
      const right = Math.max(previous.x + previous.width, rectangle.x + rectangle.width);
      const bottom = Math.max(previous.y + previous.height, rectangle.y + rectangle.height);
      previous.x = Math.min(previous.x, rectangle.x);
      previous.y = Math.min(previous.y, rectangle.y);
      previous.width = right - previous.x;
      previous.height = bottom - previous.y;
      return;
    }

    merged.push(rectangle);
  });

  return merged;
}

function buildRiskyLineRectangles(segments: TextSegment[]) {
  const sortedSegments = [...segments].sort(
    (left, right) => left.top - right.top || left.x - right.x,
  );
  const lines: Array<{ segments: TextSegment[]; top: number }> = [];

  sortedSegments.forEach((segment) => {
    const line = lines.find(
      (candidate) =>
        Math.abs(candidate.top - segment.top) <=
        Math.max(segment.height, candidate.segments[0]?.height ?? segment.height) * 0.55,
    );

    if (line) {
      line.segments.push(segment);
      line.top = (line.top + segment.top) / 2;
      return;
    }

    lines.push({
      segments: [segment],
      top: segment.top,
    });
  });

  return lines.flatMap((line) => {
    const text = line.segments
      .sort((left, right) => left.x - right.x)
      .map((segment) => segment.text)
      .join(" ")
      .trim();
    const lineMatches = findSensitiveDataMatches(text);

    if (
      !text ||
      (!riskyLinePatterns.some((pattern) => pattern.test(text)) &&
        !lineMatches.some((match) => match.type === "Person name"))
    ) {
      return [];
    }

    const left = Math.min(...line.segments.map((segment) => segment.x));
    const top = Math.min(...line.segments.map((segment) => segment.top));
    const right = Math.max(
      ...line.segments.map((segment) => segment.x + segment.width),
    );
    const bottom = Math.max(
      ...line.segments.map((segment) => segment.top + segment.height),
    );
    const paddingX = 10;
    const paddingY = 5;

    return [
      {
        x: Math.max(0, left - paddingX),
        y: Math.max(0, top - paddingY),
        width: Math.max(24, right - left + paddingX * 2),
        height: Math.max(18, bottom - top + paddingY * 2),
      },
    ];
  });
}

function drawWatermarkOnPdfPage(
  page: PDFDocument["getPages"] extends () => Array<infer T> ? T : never,
  watermarkText: string,
  opacity: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
) {
  const { width, height } = page.getSize();
  const text = watermarkText.trim() || "CONFIDENTIAL";
  const fontSize = Math.max(28, Math.min(width, height) * 0.08);
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const positions = [0.28, 0.5, 0.72];

  positions.forEach((position) => {
    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height * position,
      size: fontSize,
      font,
      color: rgb(0.82, 0.19, 0.14),
      rotate: degrees(-28),
      opacity,
    });
  });
}

export async function addWatermarkToPdf(
  file: File,
  options: PdfProcessOptions,
  pageMasks?: PdfPageMaskData[],
) {
  const sourceBytes = await file.arrayBuffer();
  const outputPdf = await PDFDocument.load(sourceBytes);
  const font = await outputPdf.embedFont(StandardFonts.HelveticaBold);
  clearPdfMetadata(outputPdf);
  const outputPages = outputPdf.getPages();

  let maskedCount = 0;

  outputPages.forEach((outputPage, pageIndex) => {
    if (options.maskDetectedText) {
      const maskData = pageMasks?.find((item) => item.pageNumber === pageIndex + 1);
      maskedCount += maskData?.maskedCount ?? 0;

      maskData?.rectangles.forEach((rectangle) => {
        outputPage.drawRectangle({
          x: rectangle.x,
          y: rectangle.y,
          width: rectangle.width,
          height: rectangle.height,
          color: rgb(0.07, 0.09, 0.13),
          opacity: 1,
        });
      });
    }

    drawWatermarkOnPdfPage(outputPage, options.watermarkText, options.opacity, font);
  });

  const output = await outputPdf.save();

  return {
    file: new File([output], buildOutputName(file.name, "-sharesafe", "pdf"), {
      type: "application/pdf",
    }),
    maskedCount,
  };
}

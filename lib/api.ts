import type { AutoRedactionMode, BackendRedactionResult } from "@/types";

const DEFAULT_REDACTION_API_URL = "http://localhost:8000";
const BACKEND_UNAVAILABLE_MESSAGE =
  "Redaction backend is not running. Start it with: cd backend && uvicorn main:app --reload --port 8000";

function getRedactionApiUrl() {
  return (
    process.env.NEXT_PUBLIC_REDACTION_API_URL?.trim() || DEFAULT_REDACTION_API_URL
  ).replace(/\/+$/, "");
}

function buildBackendErrorMessage(status: number, detail?: string) {
  if (status === 404 || status === 502 || status === 503) {
    return BACKEND_UNAVAILABLE_MESSAGE;
  }

  return detail || "PDF redaction failed on the backend.";
}

async function postRedactionRequest(
  endpointPath: string,
  formData: FormData,
  outputName: string,
): Promise<BackendRedactionResult> {
  let response: Response;

  try {
    response = await fetch(`${getRedactionApiUrl()}${endpointPath}`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(BACKEND_UNAVAILABLE_MESSAGE);
  }

  if (!response.ok) {
    let detail: string | undefined;

    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail;
    } catch {
      detail = undefined;
    }

    throw new Error(buildBackendErrorMessage(response.status, detail));
  }

  const redactedMatchCount = Number(response.headers.get("X-Redacted-Matches") ?? "0");
  const detectedItemCount = Number(response.headers.get("X-Detected-Items") ?? "0");
  const blob = await response.blob();

  return {
    file: new File([blob], outputName, { type: "application/pdf" }),
    redactedMatchCount: Number.isFinite(redactedMatchCount) ? redactedMatchCount : 0,
    detectedItemCount: Number.isFinite(detectedItemCount) ? detectedItemCount : undefined,
  };
}

export async function redactPdfWithBackend(
  file: File,
  terms: string[],
): Promise<BackendRedactionResult> {
  const uniqueTerms = Array.from(
    new Set(terms.map((term) => term.trim()).filter(Boolean)),
  );

  if (uniqueTerms.length === 0) {
    throw new Error("No sensitive values selected.");
  }

  console.log("Selected values:", uniqueTerms);
  console.log("Calling redaction backend...");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("terms", JSON.stringify(uniqueTerms));
  formData.append("fill", "black");

  const result = await postRedactionRequest("/redact-pdf", formData, "sharesafe-redacted.pdf");
  console.log("Redaction matches:", result.redactedMatchCount);
  return result;
}

export async function autoRedactPdfWithBackend(
  file: File,
  mode: AutoRedactionMode,
): Promise<BackendRedactionResult> {
  console.log("Auto redaction mode:", mode);
  console.log("Calling auto redaction backend...");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);

  const result = await postRedactionRequest(
    "/auto-redact-pdf",
    formData,
    "sharesafe-auto-redacted.pdf",
  );

  console.log("Detected items:", result.detectedItemCount ?? 0);
  console.log("Redaction matches:", result.redactedMatchCount);

  return result;
}

export { BACKEND_UNAVAILABLE_MESSAGE };

import io
import json
import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable

import fitz
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

app = FastAPI(title="ShareSafe Redaction Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    expose_headers=["X-Detected-Items", "X-Redacted-Matches", "Content-Disposition"],
)

EMAIL_PATTERN = re.compile(
    r"\b[A-Z0-9]+(?:\s*[._%+-]\s*[A-Z0-9]+)*\s*@\s*[A-Z0-9-]+(?:\s*\.\s*[A-Z0-9-]+)*\s*\.\s*[A-Z]{2,63}\b",
    re.IGNORECASE,
)
MOROCCAN_PHONE_PATTERN = re.compile(
    r"(?<!\w)(?:(?:\+212[\s.-]*)(?:6|7)(?:[\s.-]*\d){8}|0(?:6|7)(?:[\s.-]*\d){8})(?!\w)"
)
INTERNATIONAL_PHONE_PATTERN = re.compile(
    r"(?<!\w)(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}(?!\w)"
)
CIN_PATTERN = re.compile(r"(?<!\w)[A-Z]{1,3}\s?\d{3,8}(?!\w)")
URL_PATTERN = re.compile(
    r"(?<!@)\b(?:https?://|www\.|(?:[A-Z0-9-]+\.)+[A-Z]{2,63}(?:/[^\s<>\")']*)?)[^\s<>\")']*",
    re.IGNORECASE,
)
ADDRESS_KEYWORD_PATTERN = re.compile(
    r"\b(?:address|adresse|location|localisation|street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd|residence|résidence|quartier|quart|bloc|lot|immeuble|appartement|apartment|apt|villa|route|rue|n°|numero|num[eé]ro)\b",
    re.IGNORECASE,
)
CITY_PATTERN = re.compile(
    r"\b(?:casablanca|rabat|marrakech|fes|f[eè]s|meknes|tanger|agadir|sale|sal[eé]|oujda|kenitra|t[eé]touan|tetouan|temara|mohammedia|beni mellal|safi|el jadida)\b",
    re.IGNORECASE,
)

SECTION_TITLES = {
    "about",
    "certifications",
    "competences",
    "competencies",
    "contact",
    "education",
    "experience",
    "experiences",
    "formation",
    "languages",
    "langues",
    "objective",
    "profile",
    "profil",
    "projects",
    "resume",
    "skills",
    "summary",
}
NAME_LINE_STOPWORDS = SECTION_TITLES | {
    "candidate",
    "curriculum vitae",
    "cv",
    "github",
    "linkedin",
    "portfolio",
    "resume",
}


@dataclass(frozen=True)
class PageLine:
    text: str
    rect: fitz.Rect
    font_size: float


def parse_terms(raw_terms: str) -> list[str]:
    try:
        payload = json.loads(raw_terms)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid terms JSON payload.") from exc

    if not isinstance(payload, list):
        raise HTTPException(status_code=400, detail="Terms must be a JSON array.")

    unique_terms: list[str] = []
    seen: set[str] = set()

    for value in payload:
        if not isinstance(value, str):
            raise HTTPException(status_code=400, detail="Every term must be a string.")

        normalized = value.strip()
        if not normalized:
            continue

        lowered = normalized.casefold()
        if lowered in seen:
            continue

        seen.add(lowered)
        unique_terms.append(normalized)

    if not unique_terms:
        raise HTTPException(status_code=400, detail="At least one term is required.")

    return unique_terms


def parse_auto_redaction_mode(raw_mode: str | None) -> str:
    mode = (raw_mode or "standard").strip().lower()
    if mode not in {"standard", "anonymous_cv"}:
        raise HTTPException(
            status_code=400,
            detail="Mode must be 'standard' or 'anonymous_cv'.",
        )
    return mode


def resolve_fill_color(fill: str | None) -> tuple[float, float, float]:
    if fill is None or fill.strip().lower() == "black":
        return (0, 0, 0)

    parts = [part.strip() for part in fill.split(",")]
    if len(parts) != 3:
        raise HTTPException(
            status_code=400,
            detail="Fill must be 'black' or an RGB string like '0,0,0'.",
        )

    try:
        red = max(0, min(255, int(parts[0]))) / 255
        green = max(0, min(255, int(parts[1]))) / 255
        blue = max(0, min(255, int(parts[2]))) / 255
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid RGB fill color.") from exc

    return (red, green, blue)


def iter_search_terms(term: str) -> Iterable[str]:
    yield term

    compact = " ".join(term.split())
    if compact and compact != term:
        yield compact


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    return "".join(character for character in normalized if unicodedata.category(character) != "Mn")


def normalize_label(value: str) -> str:
    collapsed = re.sub(r"\s+", " ", strip_accents(value).lower()).strip()
    return re.sub(r"[^a-z0-9 ]+", " ", collapsed).strip()


def is_section_heading(text: str) -> bool:
    normalized = normalize_label(text)
    return normalized in SECTION_TITLES


def normalize_for_exact_match(value: str) -> str:
    return "".join(value.split()).casefold()


def normalize_for_phone_match(value: str) -> str:
    return "".join(character for character in value if character.isdigit())


def build_phone_equivalent_keys(phone_key: str) -> set[str]:
    keys = {phone_key}

    if phone_key.startswith("0") and len(phone_key) == 10 and phone_key[1] in {"6", "7"}:
        keys.add(f"212{phone_key[1:]}")

    if phone_key.startswith("212") and len(phone_key) == 12 and phone_key[3] in {"6", "7"}:
        keys.add(f"0{phone_key[3:]}")

    return {key for key in keys if key}


def build_candidate_match_keys(value: str) -> set[str]:
    keys = {normalize_for_exact_match(value)}
    phone_key = normalize_for_phone_match(value)
    if phone_key:
        keys.update(build_phone_equivalent_keys(phone_key))
    return {key for key in keys if key}


def merge_rectangles(rectangles: list[fitz.Rect]) -> fitz.Rect:
    x0 = min(rect.x0 for rect in rectangles)
    y0 = min(rect.y0 for rect in rectangles)
    x1 = max(rect.x1 for rect in rectangles)
    y1 = max(rect.y1 for rect in rectangles)
    return fitz.Rect(x0, y0, x1, y1)


def find_term_rectangles(page: fitz.Page, term: str) -> list[fitz.Rect]:
    direct_matches: dict[tuple[float, float, float, float], fitz.Rect] = {}

    for candidate in iter_search_terms(term):
        for rect in page.search_for(candidate):
            key = (
                round(rect.x0, 3),
                round(rect.y0, 3),
                round(rect.x1, 3),
                round(rect.y1, 3),
            )
            direct_matches[key] = rect

    if direct_matches:
        return list(direct_matches.values())

    match_keys = build_candidate_match_keys(term)
    if not match_keys:
        return []

    line_words: dict[tuple[int, int], list[tuple[fitz.Rect, str]]] = {}
    for raw_word in page.get_text("words", sort=True):
        if len(raw_word) < 8:
            continue

        x0, y0, x1, y1, text, block_no, line_no, _word_no = raw_word[:8]
        if not isinstance(text, str) or not text.strip():
            continue

        line_words.setdefault((int(block_no), int(line_no)), []).append(
            (fitz.Rect(x0, y0, x1, y1), text)
        )

    fallback_rectangles: dict[tuple[float, float, float, float], fitz.Rect] = {}

    for words in line_words.values():
        total_words = len(words)
        for start_index in range(total_words):
            combined_rectangles: list[fitz.Rect] = []
            combined_text_parts: list[str] = []

            for end_index in range(start_index, min(total_words, start_index + 8)):
                rect, word_text = words[end_index]
                combined_rectangles.append(rect)
                combined_text_parts.append(word_text)

                compact_text = "".join(combined_text_parts)
                spaced_text = " ".join(combined_text_parts)
                candidate_keys = {
                    normalize_for_exact_match(compact_text),
                    normalize_for_exact_match(spaced_text),
                    normalize_for_phone_match(compact_text),
                    normalize_for_phone_match(spaced_text),
                }

                if match_keys.intersection(key for key in candidate_keys if key):
                    merged = merge_rectangles(combined_rectangles)
                    key = (
                        round(merged.x0, 3),
                        round(merged.y0, 3),
                        round(merged.x1, 3),
                        round(merged.y1, 3),
                    )
                    fallback_rectangles[key] = merged
                    break

    return list(fallback_rectangles.values())


def extract_page_lines(page: fitz.Page) -> list[PageLine]:
    content = page.get_text("dict", sort=True)
    lines: list[PageLine] = []

    for block in content.get("blocks", []):
        if block.get("type") != 0:
            continue

        for line in block.get("lines", []):
            spans = line.get("spans", [])
            text = "".join(
                span.get("text", "") for span in spans if isinstance(span.get("text"), str)
            ).strip()
            if not text:
                continue

            lines.append(
                PageLine(
                    text=text,
                    rect=fitz.Rect(line["bbox"]),
                    font_size=max(
                        (
                            float(span.get("size", 0) or 0)
                            for span in spans
                            if isinstance(span, dict)
                        ),
                        default=0,
                    ),
                )
            )

    return lines


def is_address_like_line(text: str) -> bool:
    normalized = normalize_label(text)
    if not normalized or is_section_heading(text) or len(normalized) > 120:
        return False

    has_keyword = ADDRESS_KEYWORD_PATTERN.search(text) is not None
    has_city = CITY_PATTERN.search(text) is not None
    has_digits = bool(re.search(r"\d", text))
    has_separator = "," in text or "-" in text

    return has_keyword or (has_city and (has_digits or has_separator))


def is_social_line(text: str) -> bool:
    normalized = normalize_label(text)
    return "linkedin" in normalized or "github" in normalized


def is_probable_name_line(text: str) -> bool:
    normalized = normalize_label(text)
    if (
        not normalized
        or normalized in NAME_LINE_STOPWORDS
        or len(normalized) > 48
        or any(character.isdigit() for character in text)
        or "@" in text
        or "http" in normalized
    ):
        return False

    tokens = [token for token in re.split(r"\s+", text.strip()) if token]
    if len(tokens) == 0 or len(tokens) > 4:
        return False

    cleaned_tokens = [re.sub(r"^[^\wÀ-ÿ]+|[^\wÀ-ÿ'-]+$", "", token) for token in tokens]
    if not all(re.fullmatch(r"[A-Za-zÀ-ÿ'’-]+", token or "") for token in cleaned_tokens):
        return False

    uppercase_or_title_tokens = 0
    for token in cleaned_tokens:
        letters = re.sub(r"['’-]", "", token)
        if not letters:
            continue
        if letters == letters.upper() or letters[0] == letters[0].upper():
            uppercase_or_title_tokens += 1

    return uppercase_or_title_tokens == len(cleaned_tokens)


def detect_candidate_name_terms(lines: list[PageLine], page_height: float) -> dict[str, str]:
    if not lines:
        return {}

    first_section_y = min(
        (line.rect.y0 for line in lines if is_section_heading(line.text)),
        default=page_height * 0.34,
    )
    max_scan_y = min(page_height * 0.34, first_section_y + 8)
    max_font_size = max((line.font_size for line in lines), default=0)
    threshold_font = max_font_size * 0.72 if max_font_size else 0

    detected: dict[str, str] = {}

    for line in lines:
        if line.rect.y0 > max_scan_y:
            continue
        if threshold_font and line.font_size < threshold_font:
            continue
        if not is_probable_name_line(line.text):
            continue

        key = f"name:{normalize_label(line.text)}"
        detected.setdefault(key, line.text)

    return detected


def detect_line_based_terms(
    lines: list[PageLine],
    mode: str,
    page_index: int,
    page_height: float,
) -> dict[str, str]:
    detected: dict[str, str] = {}

    for line in lines:
        if is_address_like_line(line.text):
            detected.setdefault(f"address:{normalize_label(line.text)}", line.text)

        if mode == "anonymous_cv" and page_index == 0 and line.rect.y0 <= page_height * 0.48:
            if is_social_line(line.text):
                detected.setdefault(f"social:{normalize_label(line.text)}", line.text)

    if mode == "anonymous_cv" and page_index == 0:
        detected.update(detect_candidate_name_terms(lines, page_height))

    return detected


def detect_visual_regions(page: fitz.Page, mode: str) -> list[fitz.Rect]:
    if mode != "anonymous_cv":
        return []

    content = page.get_text("dict", sort=True)
    page_area = max(page.rect.width * page.rect.height, 1)
    regions: list[fitz.Rect] = []

    for block in content.get("blocks", []):
        if block.get("type") != 1:
            continue

        rect = fitz.Rect(block["bbox"])
        width = rect.width
        height = rect.height
        if width <= 0 or height <= 0:
            continue

        area_ratio = (width * height) / page_area
        aspect_ratio = width / height if height else 0

        # Likely profile photo in the upper part of page 1.
        if rect.y0 <= page.rect.height * 0.42 and 0.55 <= aspect_ratio <= 1.45 and 0.015 <= area_ratio <= 0.18:
            regions.append(rect)
            continue

        # Likely QR code or compact identity marker.
        if rect.y0 <= page.rect.height * 0.75 and 0.85 <= aspect_ratio <= 1.15 and 0.002 <= area_ratio <= 0.03:
            regions.append(rect)

    return regions


def normalize_email(value: str) -> str:
    return re.sub(r"\s+", "", value).lower()


def normalize_moroccan_phone(value: str) -> str | None:
    digits = normalize_for_phone_match(value)
    if len(digits) == 10 and digits.startswith("0") and digits[1] in {"6", "7"}:
        return digits
    if len(digits) == 12 and digits.startswith("212") and digits[3] in {"6", "7"}:
        return f"0{digits[3:]}"
    return None


def normalize_international_phone(value: str) -> str | None:
    digits = normalize_for_phone_match(value)
    if len(digits) < 8 or len(digits) > 15:
        return None

    moroccan = normalize_moroccan_phone(value)
    if moroccan:
        return None

    return digits


def normalize_cin_like(value: str) -> str | None:
    compact = re.sub(r"\s+", "", value).upper()
    return compact if re.fullmatch(r"[A-Z]{1,3}\d{3,8}", compact) else None


def normalize_url(value: str) -> str:
    return value.rstrip("),.;:").lower()


def collect_pattern_detected_terms(text: str) -> dict[str, str]:
    detected: dict[str, str] = {}

    for match in EMAIL_PATTERN.finditer(text):
        normalized = normalize_email(match.group(0))
        detected.setdefault(normalized, normalized)

    for match in MOROCCAN_PHONE_PATTERN.finditer(text):
        normalized = normalize_moroccan_phone(match.group(0))
        if normalized:
            detected.setdefault(f"ma-phone:{normalized}", normalized)

    for match in INTERNATIONAL_PHONE_PATTERN.finditer(text):
        normalized = normalize_international_phone(match.group(0))
        if normalized:
            detected.setdefault(f"intl-phone:{normalized}", match.group(0).strip())

    for match in CIN_PATTERN.finditer(text):
        normalized = normalize_cin_like(match.group(0))
        if normalized:
            detected.setdefault(f"cin:{normalized}", normalized)

    for match in URL_PATTERN.finditer(text):
        normalized = normalize_url(match.group(0))
        detected.setdefault(f"url:{normalized}", normalized)

    return detected


def save_redacted_document(document: fitz.Document, output_name: str, headers: dict[str, str]) -> Response:
    output = io.BytesIO()
    document.save(output, garbage=4, deflate=True)

    return Response(
        content=output.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{output_name}"',
            **headers,
        },
    )


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.post("/redact-pdf")
async def redact_pdf(
    file: UploadFile = File(...),
    terms: str = Form(...),
    fill: str | None = Form(default="black"),
) -> Response:
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail="The uploaded file must be a PDF.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    redact_terms = parse_terms(terms)
    fill_color = resolve_fill_color(fill)

    try:
        document = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:  # pragma: no cover - fitz raises multiple PDF errors
        raise HTTPException(status_code=400, detail="Unable to open the uploaded PDF.") from exc

    try:
        redacted_matches = 0

        for page in document:
            page_has_annotations = False

            for term in redact_terms:
                for rect in find_term_rectangles(page, term):
                    page.add_redact_annot(rect, fill=fill_color)
                    redacted_matches += 1
                    page_has_annotations = True

            if page_has_annotations:
                page.apply_redactions()

        original_name = file.filename or "document.pdf"
        safe_name = original_name.rsplit(".", 1)[0]
        output_name = f"{safe_name}-redacted.pdf"

        return save_redacted_document(
            document,
            output_name,
            {
                "X-Redacted-Matches": str(redacted_matches),
            },
        )
    finally:
        document.close()


@app.post("/auto-redact-pdf")
async def auto_redact_pdf(
    file: UploadFile = File(...),
    mode: str = Form(default="standard"),
) -> Response:
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail="The uploaded file must be a PDF.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    auto_mode = parse_auto_redaction_mode(mode)

    try:
        document = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:  # pragma: no cover - fitz raises multiple PDF errors
        raise HTTPException(status_code=400, detail="Unable to open the uploaded PDF.") from exc

    try:
        detected_terms: dict[str, str] = {}
        visual_regions: list[fitz.Rect] = []

        for page_index, page in enumerate(document):
            lines = extract_page_lines(page)
            detected_terms.update(collect_pattern_detected_terms(page.get_text("text")))
            detected_terms.update(
                detect_line_based_terms(lines, auto_mode, page_index, page.rect.height)
            )
            if auto_mode == "anonymous_cv" and page_index == 0:
                visual_regions.extend(detect_visual_regions(page, auto_mode))

        if not detected_terms and not visual_regions:
            raise HTTPException(
                status_code=400,
                detail="No sensitive items were detected in the PDF.",
            )

        redacted_matches = 0

        for page_index, page in enumerate(document):
            page_has_annotations = False

            for term in detected_terms.values():
                for rect in find_term_rectangles(page, term):
                    page.add_redact_annot(rect, fill=(0, 0, 0))
                    redacted_matches += 1
                    page_has_annotations = True

            if auto_mode == "anonymous_cv" and page_index == 0:
                for rect in visual_regions:
                    page.add_redact_annot(rect, fill=(0, 0, 0))
                    redacted_matches += 1
                    page_has_annotations = True

            if page_has_annotations:
                page.apply_redactions()

        if redacted_matches == 0:
            raise HTTPException(
                status_code=400,
                detail="Sensitive items were detected but no searchable PDF matches were found for redaction.",
            )

        original_name = file.filename or "document.pdf"
        safe_name = original_name.rsplit(".", 1)[0]
        output_name = f"{safe_name}-auto-redacted.pdf"

        return save_redacted_document(
            document,
            output_name,
            {
                "X-Detected-Items": str(len(detected_terms) + len(visual_regions)),
                "X-Redacted-Matches": str(redacted_matches),
            },
        )
    finally:
        document.close()

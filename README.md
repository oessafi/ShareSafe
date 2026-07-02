# ShareSafe

ShareSafe is a privacy tool for cleaning files before sharing them. The frontend detects visible PDF text locally, and the optional FastAPI + PyMuPDF backend can apply real PDF redaction for selected values or auto-detected values before download.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- `pdf-lib` for local watermarking
- `pdfjs-dist` for visible PDF text extraction
- FastAPI
- PyMuPDF

## Run the frontend

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Run the backend

```bash
cd backend
python -m venv venv
```

Activate the virtual environment:

- macOS/Linux:

  ```bash
  source venv/bin/activate
  ```

- Windows:

  ```bash
  venv\Scripts\activate
  ```

Install backend dependencies and start the API:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Set the frontend environment variable from `.env.example` if needed:

```bash
NEXT_PUBLIC_REDACTION_API_URL=http://localhost:8000
```

## What ShareSafe does

- Upload PDF, PNG, JPG, JPEG, or WEBP files up to 20MB
- Detect names, emails, phone numbers, Moroccan CIN-like values, CNSS, ICE, RIB, and URLs from visible PDF text
- Let you select detected PDF values before sending them to the redaction backend
- Auto-detect emails, phones, CIN-like values, and URLs in the backend without manual selection
- Offer two automatic redaction modes: `Standard privacy` and `Anonymous CV`
- Add a visible `CONFIDENTIAL` watermark locally in the browser
- Redact selected PDF values through the PyMuPDF backend
- Auto-redact detected PDF values through the PyMuPDF backend
- Combine watermark + backend redaction in one export flow
- Compress and watermark images locally
- Export a plain-text privacy report

## Important distinctions

- Watermark is not masking. It adds visible text on top of the page and does not hide or remove existing PDF text.
- Visual masking is not always secure. A black rectangle alone may still leave the original PDF text copyable underneath.
- The PyMuPDF backend applies real PDF redaction by adding redaction annotations and calling `apply_redactions()`.

## Backend API

- `GET /health`
- `POST /redact-pdf`
- `POST /auto-redact-pdf`

`POST /redact-pdf` expects multipart form-data with:

- `file`: PDF file
- `terms`: JSON string array of sensitive values to redact
- `fill`: optional fill color, default black

`POST /auto-redact-pdf` expects multipart form-data with:

- `file`: PDF file
- `mode`: `standard` or `anonymous_cv`

## Current limitations

- Backend redaction works best when the PDF contains searchable text
- Scanned or image-only PDFs may not return searchable matches without OCR
- Image OCR is intentionally disabled in this MVP

import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const destination = path.join(publicDir, "pdf.worker.min.mjs");

const candidates = [
  path.join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
  path.join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.min.mjs"),
];

async function findSource() {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("Unable to locate pdf.worker.min.mjs in node_modules/pdfjs-dist.");
}

async function main() {
  await mkdir(publicDir, { recursive: true });
  const source = await findSource();
  await copyFile(source, destination);
  console.log(`Copied PDF worker from ${source} to ${destination}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

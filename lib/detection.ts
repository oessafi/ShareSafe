import type { DetectionItem, DetectionKind } from "@/types";

type PatternConfig = {
  type: DetectionKind;
  regex: RegExp;
  normalize?: (value: string) => string;
};

type TextLine = {
  text: string;
  start: number;
  end: number;
  nonEmptyIndex: number;
};

const emailLocalPartPatternSource =
  String.raw`[A-Z0-9]+(?:\s*[._%+-]\s*[A-Z0-9]+)*`;
export const emailDomainPatternSource =
  String.raw`[A-Z0-9-]+(?:\s*\.\s*[A-Z0-9-]+)*\s*\.\s*[A-Z]{2,63}`;
export const emailPatternSource = String.raw`\b${emailLocalPartPatternSource}\s*@\s*${emailDomainPatternSource}\b`;
export const moroccanPhonePatternSource =
  String.raw`(?<!\w)(?:\+212|0)(?:[\s.-]*)(?:5|6|7)(?:[\s.-]*\d){8}(?!\w)`;
export const internationalPhonePatternSource =
  String.raw`(?<!\w)(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}(?!\w)`;
export const moroccanCinPatternSource = String.raw`(?<!\w)[A-Z]{1,2}\s?\d{5,6}(?!\w)`;
export const cnssPatternSource =
  String.raw`(?<![\d+])(?:\d[\s.-]?){8}\d(?![\s.-]*\d)`;
export const icePatternSource =
  String.raw`(?<![\d+])(?:\d[\s.-]?){14}\d(?![\s.-]*\d)`;
export const ribPatternSource =
  String.raw`(?<![\d+])(?:\d[\s.-]?){23}\d(?![\s.-]*\d)`;

const personTokenPattern = /^[\p{L}][\p{L}'-]*$/u;
const personPhrasePatternSource =
  String.raw`[\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,3}`;
const labeledPersonPattern = new RegExp(
  String.raw`(?:^|\n)\s*(?:nom(?:\s+complet)?|prenom|name|full\s+name|candidate|candidat(?:e)?|employee|employe(?:e)?|salarie(?:e)?|titulaire)\s*[:\-]\s*(?<name>${personPhrasePatternSource})(?=\s*(?:\n|$))`,
  "giu",
);

const personLineStopwords = new Set([
  "about",
  "academique",
  "academic",
  "analyse",
  "analyst",
  "analyste",
  "boot",
  "candidate",
  "casablanca",
  "certification",
  "certifications",
  "competence",
  "competences",
  "confidential",
  "consultant",
  "contact",
  "contract",
  "contrat",
  "courses",
  "cours",
  "cv",
  "developer",
  "developpeur",
  "developpeuse",
  "education",
  "engineer",
  "engineering",
  "essai",
  "etudiant",
  "experience",
  "experiences",
  "formation",
  "formations",
  "full",
  "github",
  "ingenieur",
  "java",
  "langage",
  "langages",
  "language",
  "languages",
  "linkedin",
  "manager",
  "maroc",
  "marrakech",
  "mission",
  "missions",
  "objectif",
  "oujda",
  "periode",
  "profile",
  "profil",
  "project",
  "projects",
  "projet",
  "projets",
  "rabat",
  "react",
  "reference",
  "references",
  "responsable",
  "resume",
  "saas",
  "skills",
  "societe",
  "spring",
  "stack",
  "stagiaire",
  "summary",
  "technicien",
  "technologies",
  "technology",
  "telephone",
  "tanger",
  "tel",
  "travail",
  "university",
]);

const organizationLikeTokens = new Set([
  "agence",
  "agency",
  "associates",
  "association",
  "company",
  "consulting",
  "corp",
  "corporation",
  "ecole",
  "enterprise",
  "groupe",
  "group",
  "holding",
  "inc",
  "industries",
  "institut",
  "institute",
  "llc",
  "office",
  "organization",
  "organisation",
  "partners",
  "sarl",
  "sas",
  "school",
  "services",
  "solutions",
  "studio",
  "systems",
  "universite",
]);

const personJoinerTokens = new Set([
  "al",
  "ben",
  "bin",
  "da",
  "de",
  "del",
  "di",
  "el",
  "ibn",
  "la",
  "le",
  "ould",
  "ou",
]);

const profileSignalPattern = /\b(?:contact|email|mail|tel|telephone|phone|linkedin|github|developpeur|developer|ingenieur|engineer|consultant|manager|stagiaire|analyste|profil|profile|full\s+stack|react|java|spring)\b/i;
const contactSignalPattern = new RegExp(
  [
    emailPatternSource,
    moroccanPhonePatternSource,
    internationalPhonePatternSource,
    String.raw`\b(?:contact|email|mail|tel|telephone|phone|linkedin|github)\b`,
  ].join("|"),
  "iu",
);

export interface SensitiveTextMatch {
  type: DetectionKind;
  value: string;
  normalizedValue: string;
  start: number;
  end: number;
}

const detectionOrder: DetectionKind[] = [
  "Person name",
  "Email",
  "Moroccan phone",
  "International phone",
  "Moroccan CIN",
  "CNSS",
  "ICE",
  "RIB",
  "URL",
];

const patterns: PatternConfig[] = [
  {
    type: "Email",
    regex: new RegExp(emailPatternSource, "gi"),
    normalize: (value) => value.replace(/\s+/g, "").toLowerCase(),
  },
  {
    type: "Moroccan phone",
    regex: new RegExp(moroccanPhonePatternSource, "gi"),
    normalize: (value) => value.replace(/[^\d+]/g, ""),
  },
  {
    type: "International phone",
    regex: new RegExp(internationalPhonePatternSource, "gi"),
    normalize: (value) => value.replace(/[^\d+]/g, ""),
  },
  {
    type: "Moroccan CIN",
    regex: new RegExp(moroccanCinPatternSource, "gi"),
    normalize: (value) => value.replace(/\s+/g, "").toUpperCase(),
  },
  {
    type: "CNSS",
    regex: new RegExp(cnssPatternSource, "g"),
    normalize: (value) => value.replace(/\D/g, ""),
  },
  {
    type: "ICE",
    regex: new RegExp(icePatternSource, "g"),
    normalize: (value) => value.replace(/\D/g, ""),
  },
  {
    type: "RIB",
    regex: new RegExp(ribPatternSource, "g"),
    normalize: (value) => value.replace(/\D/g, ""),
  },
  {
    type: "URL",
    regex: /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi,
    normalize: (value) => value.toLowerCase(),
  },
];

function normalizeForComparison(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractTextLines(sourceText: string): TextLine[] {
  const rawLines = sourceText.split("\n");
  const lines: TextLine[] = [];
  let offset = 0;
  let nonEmptyIndex = 0;

  rawLines.forEach((lineText, index) => {
    const lineStart = offset;
    const lineEnd = lineStart + lineText.length;
    const hasContent = lineText.trim().length > 0;

    lines.push({
      text: lineText,
      start: lineStart,
      end: lineEnd,
      nonEmptyIndex: hasContent ? nonEmptyIndex : -1,
    });

    if (hasContent) {
      nonEmptyIndex += 1;
    }

    offset = lineEnd + (index < rawLines.length - 1 ? 1 : 0);
  });

  return lines;
}

function tokenizePersonCandidate(value: string) {
  return value
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}]+|[^\p{L}'-]+$/gu, ""))
    .filter(Boolean);
}

function isStyledPersonToken(token: string) {
  const lettersOnly = token.replace(/['-]/g, "");
  if (!lettersOnly) {
    return false;
  }

  const firstCharacter = lettersOnly[0];
  const rest = lettersOnly.slice(1);
  const hasUppercaseInitial =
    firstCharacter === firstCharacter.toUpperCase() &&
    firstCharacter !== firstCharacter.toLowerCase();
  const isAllUppercase =
    lettersOnly.length > 1 && lettersOnly === lettersOnly.toUpperCase();
  const isTitleCase =
    hasUppercaseInitial &&
    (rest === rest.toLowerCase() || rest === rest.toUpperCase());

  return isAllUppercase || isTitleCase;
}

function isValidPersonValue(
  value: string,
  options: { allowSingleToken?: boolean; allowUnstyled?: boolean } = {},
) {
  const { allowSingleToken = false, allowUnstyled = false } = options;
  const tokens = tokenizePersonCandidate(value);
  const minimumTokens = allowSingleToken ? 1 : 2;

  if (tokens.length < minimumTokens || tokens.length > 4) {
    return false;
  }

  const significantTokens = tokens.filter((token) => {
    const normalizedToken = normalizeForComparison(token);
    return !personJoinerTokens.has(normalizedToken);
  });

  if (significantTokens.length < minimumTokens) {
    return false;
  }

  if (!tokens.every((token) => personTokenPattern.test(token))) {
    return false;
  }

  if (
    significantTokens.some((token) => {
      const normalizedToken = normalizeForComparison(token);
      return (
        personLineStopwords.has(normalizedToken) ||
        organizationLikeTokens.has(normalizedToken)
      );
    })
  ) {
    return false;
  }

  if (allowUnstyled) {
    return true;
  }

  return significantTokens.every((token) => isStyledPersonToken(token));
}

function findLabeledPersonMatches(sourceText: string): SensitiveTextMatch[] {
  const matches: SensitiveTextMatch[] = [];

  for (const match of sourceText.matchAll(labeledPersonPattern)) {
    const value = match.groups?.name?.trim();
    if (
      !value ||
      match.index === undefined ||
      !isValidPersonValue(value, { allowSingleToken: true, allowUnstyled: true })
    ) {
      continue;
    }

    const localOffset = match[0].indexOf(value);
    if (localOffset < 0) {
      continue;
    }

    const start = match.index + localOffset;
    matches.push({
      type: "Person name",
      value,
      normalizedValue: normalizeForComparison(value),
      start,
      end: start + value.length,
    });
  }

  return matches;
}

function findStandalonePersonMatches(sourceText: string): SensitiveTextMatch[] {
  const lines = extractTextLines(sourceText);
  const matches: SensitiveTextMatch[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.text.trim();
    if (!trimmed || trimmed.length < 5 || trimmed.length > 48) {
      return;
    }

    if (
      /[@\d/|]/.test(trimmed) ||
      trimmed.includes("://") ||
      trimmed.includes(":") ||
      trimmed.includes(",")
    ) {
      return;
    }

    if (!isValidPersonValue(trimmed)) {
      return;
    }

    const withinHeader = line.nonEmptyIndex >= 0 && line.nonEmptyIndex <= 4;
    const nearbyLines = lines
      .slice(Math.max(0, index - 2), Math.min(lines.length, index + 7))
      .map((candidate) => candidate.text.trim())
      .filter(Boolean);
    const hasNearbyContactSignal = nearbyLines.some((candidate) =>
      contactSignalPattern.test(candidate),
    );
    const hasNearbyProfileSignal = nearbyLines.some(
      (candidate) => candidate !== trimmed && profileSignalPattern.test(candidate),
    );

    if (!hasNearbyContactSignal && !(withinHeader && hasNearbyProfileSignal)) {
      return;
    }

    const start = line.start + line.text.indexOf(trimmed);
    matches.push({
      type: "Person name",
      value: trimmed,
      normalizedValue: normalizeForComparison(trimmed),
      start,
      end: start + trimmed.length,
    });
  });

  return matches;
}

function cleanMatch(type: DetectionKind, value: string) {
  const trimmed = value.trim().replace(/[),.;:]+$/, "");

  if (type === "Email") {
    return trimmed.replace(/\s+/g, "");
  }

  if (type === "International phone" || type === "Moroccan phone") {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      return null;
    }
  }

  if (type === "Moroccan CIN") {
    const compact = trimmed.replace(/\s+/g, "").toUpperCase();
    return /^[A-Z]{1,2}\d{5,6}$/.test(compact) ? compact : null;
  }

  if (type === "CNSS") {
    const digits = trimmed.replace(/\D/g, "");
    return digits.length === 9 ? digits : null;
  }

  if (type === "ICE") {
    const digits = trimmed.replace(/\D/g, "");
    return digits.length === 15 ? digits : null;
  }

  if (type === "RIB") {
    const digits = trimmed.replace(/\D/g, "");
    return digits.length === 24 ? digits : null;
  }

  return trimmed;
}

function compareMatches(left: SensitiveTextMatch, right: SensitiveTextMatch) {
  if (left.start !== right.start) {
    return left.start - right.start;
  }

  const typeDelta =
    detectionOrder.indexOf(left.type) - detectionOrder.indexOf(right.type);
  if (typeDelta !== 0) {
    return typeDelta;
  }

  return right.end - right.start - (left.end - left.start);
}

function resolveOverlappingMatches(matches: SensitiveTextMatch[]) {
  const resolved: SensitiveTextMatch[] = [];

  [...matches]
    .sort(compareMatches)
    .forEach((match) => {
      const previous = resolved[resolved.length - 1];

      if (!previous || match.start >= previous.end) {
        resolved.push(match);
        return;
      }

      const previousPriority = detectionOrder.indexOf(previous.type);
      const currentPriority = detectionOrder.indexOf(match.type);
      const previousLength = previous.end - previous.start;
      const currentLength = match.end - match.start;
      const currentWins =
        currentPriority < previousPriority ||
        (currentPriority === previousPriority && currentLength > previousLength);

      if (currentWins) {
        resolved[resolved.length - 1] = match;
      }
    });

  return resolved.sort(compareMatches);
}

export function findSensitiveDataMatches(sourceText: string): SensitiveTextMatch[] {
  const matches: SensitiveTextMatch[] = [
    ...findLabeledPersonMatches(sourceText),
    ...findStandalonePersonMatches(sourceText),
  ];

  patterns.forEach(({ type, regex, normalize }) => {
    const regexMatches = sourceText.matchAll(regex);

    for (const match of regexMatches) {
      const rawValue = match[0];
      const cleanedValue = cleanMatch(type, rawValue);

      if (!cleanedValue || match.index === undefined) {
        continue;
      }

      const normalizedValue = normalize ? normalize(cleanedValue) : cleanedValue;
      matches.push({
        type,
        value: cleanedValue,
        normalizedValue,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  });

  return resolveOverlappingMatches(matches);
}

export function detectSensitiveData(sourceText: string): DetectionItem[] {
  const findings = new Map<string, Omit<DetectionItem, "id">>();

  findSensitiveDataMatches(sourceText).forEach((match) => {
    const key = `${match.type}:${match.normalizedValue}`;
    const existing = findings.get(key);

    if (existing) {
      existing.count += 1;
      return;
    }

    findings.set(key, {
      type: match.type,
      value: match.value,
      count: 1,
    });
  });

  return Array.from(findings.values())
    .sort((left, right) => {
      const typeDelta =
        detectionOrder.indexOf(left.type) - detectionOrder.indexOf(right.type);
      if (typeDelta !== 0) {
        return typeDelta;
      }

      return right.count - left.count || left.value.localeCompare(right.value);
    })
    .map((item, index) => ({
      id: `${item.type}-${index}`,
      ...item,
    }));
}

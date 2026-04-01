import { TransliterationCandidate, TransliterationMode, TransliterationResult } from "../types";

const VIRAMA = "्";
const ANUSVARA = "ं";
const CHANDRABINDU = "ँ";
const VISARGA = "ः";

const SMART_DICTIONARY: Record<string, string> = {
  "cha": "छ",
  "namaste": "नमस्ते",
  "mero": "मेरो",
  "naam": "नाम",
  "shankar": "शंकर",
  "kathmandu": "काठमाडौं",
  "ramro": "राम्रो",
  "sanchai": "सन्चै",
  "samjhana": "सम्झना",
  "pratishat": "प्रतिशत"
};

const AMBIGUOUS_CANDIDATES: Record<string, TransliterationCandidate[]> = {
  "shakti": [
    { text: "शक्ति", reason: "Preferred Nepali spelling" },
    { text: "सक्ति", reason: "Literal phonetic alternate" }
  ],
  "sanchai": [
    { text: "सन्चै", reason: "Common colloquial spelling" },
    { text: "साँच्चै", reason: "Emphatic alternate" }
  ]
};

const INDEPENDENT_VOWELS: Record<string, string> = {
  "a": "अ",
  "aa": "आ",
  "A": "आ",
  "i": "इ",
  "ii": "ई",
  "ee": "ई",
  "u": "उ",
  "uu": "ऊ",
  "oo": "ऊ",
  "e": "ए",
  "ai": "ऐ",
  "o": "ओ",
  "au": "औ",
  "ri": "ऋ"
};

const MATRAS: Record<string, string> = {
  "a": "",
  "aa": "ा",
  "A": "ा",
  "i": "ि",
  "ii": "ी",
  "ee": "ी",
  "u": "ु",
  "uu": "ू",
  "oo": "ू",
  "e": "े",
  "ai": "ै",
  "o": "ो",
  "au": "ौ",
  "ri": "ृ"
};

const CONSONANTS: Record<string, string> = {
  "ksha": "क्ष",
  "chh": "छ",
  "kh": "ख",
  "gh": "घ",
  "ch": "च",
  "jh": "झ",
  "th": "थ",
  "dh": "ध",
  "Th": "ठ",
  "Dh": "ढ",
  "ph": "फ",
  "bh": "भ",
  "sh": "श",
  "Sh": "ष",
  "ng": "ङ",
  "ny": "ञ",
  "tr": "त्र",
  "gya": "ज्ञ",
  "gyaa": "ज्ञा",
  "gyna": "ज्ञ",
  "f": "फ",
  "v": "व",
  "w": "व",
  "k": "क",
  "g": "ग",
  "j": "ज",
  "t": "त",
  "d": "द",
  "n": "न",
  "T": "ट",
  "D": "ड",
  "N": "ण",
  "p": "प",
  "b": "ब",
  "m": "म",
  "y": "य",
  "r": "र",
  "l": "ल",
  "s": "स",
  "h": "ह"
};

const SPECIALS: Record<string, string> = {
  "om": "ॐ",
  "*": ANUSVARA,
  "**": CHANDRABINDU,
  ":": VISARGA
};

const VOWEL_KEYS = Object.keys(INDEPENDENT_VOWELS).sort((a, b) => b.length - a.length);
const CONSONANT_KEYS = Object.keys(CONSONANTS).sort((a, b) => b.length - a.length);
const SPECIAL_KEYS = Object.keys(SPECIALS).sort((a, b) => b.length - a.length);

function startsWithAt(input: string, index: number, options: string[]): string | null {
  for (const option of options) {
    if (input.startsWith(option, index)) return option;
  }
  return null;
}

function isRomanLetter(char: string): boolean {
  return /[A-Za-z]/.test(char);
}

function isTokenCharacter(char: string): boolean {
  return isRomanLetter(char) || char === "*" || char === ":" || char === "/" || char === "\\";
}

function transliterateCore(input: string): string {
  let output = "";
  let index = 0;

  while (index < input.length) {
    const specialToken = startsWithAt(input, index, SPECIAL_KEYS);
    if (specialToken) {
      output += SPECIALS[specialToken];
      index += specialToken.length;
      continue;
    }

    if (input[index] === "\\") {
      if (output && !output.endsWith(VIRAMA)) output += VIRAMA;
      index += 1;
      continue;
    }

    const consonantToken = startsWithAt(input, index, CONSONANT_KEYS);
    if (consonantToken) {
      const consonant = CONSONANTS[consonantToken];
      const nextIndex = index + consonantToken.length;
      const vowelToken = startsWithAt(input, nextIndex, VOWEL_KEYS);
      if (vowelToken) {
        output += consonant + (MATRAS[vowelToken] ?? "");
        index = nextIndex + vowelToken.length;
        continue;
      }

      const nextConsonant = startsWithAt(input, nextIndex, CONSONANT_KEYS);
      output += consonant;
      if (nextConsonant) output += VIRAMA;
      index = nextIndex;
      continue;
    }

    const vowelToken = startsWithAt(input, index, VOWEL_KEYS);
    if (vowelToken) {
      output += INDEPENDENT_VOWELS[vowelToken];
      index += vowelToken.length;
      continue;
    }

    const char = input[index];
    output += char;
    index += 1;
  }

  return output;
}

function transliterateToken(token: string, mode: TransliterationMode, customMappings: Record<string, string>): TransliterationResult {
  const trimmed = token.trim();
  if (!trimmed) return { text: token, candidates: [], ambiguous: false, preserveEnglish: true };
  if (trimmed.startsWith("/")) {
    return { text: token.replace(/\/(\S+)/, "$1"), candidates: [], ambiguous: false, preserveEnglish: true };
  }
  if (trimmed.startsWith("{") || trimmed.endsWith("}")) {
    return { text: token.replace(/^\{/, "").replace(/\}$/, ""), candidates: [], ambiguous: false, preserveEnglish: true };
  }
  if (/^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
    return { text: token, candidates: [], ambiguous: false, preserveEnglish: true };
  }
  if (/^[A-Z][a-z0-9_-]+$/.test(trimmed) && mode === "basic") {
    return { text: token, candidates: [], ambiguous: false, preserveEnglish: true };
  }

  const lower = trimmed.toLowerCase();
  const mapped = customMappings[lower];
  const dictionary = mode === "smart" ? SMART_DICTIONARY[lower] : undefined;
  const candidates = AMBIGUOUS_CANDIDATES[lower] ?? [];
  const text = mapped || dictionary || transliterateCore(trimmed);
  return {
    text,
    candidates,
    ambiguous: candidates.length > 0,
    preserveEnglish: false
  };
}

export function transliterateWord(input: string, mode: TransliterationMode, customMappings: Record<string, string> = {}): TransliterationResult {
  return transliterateToken(input, mode, customMappings);
}

export function transliterateText(input: string, mode: TransliterationMode, customMappings: Record<string, string> = {}): string {
  let output = "";
  let token = "";
  let braceDepth = 0;

  const flush = () => {
    if (!token) return;
    if (braceDepth > 0) {
      output += token;
    } else {
      output += transliterateToken(token, mode, customMappings).text;
    }
    token = "";
  };

  for (const char of input) {
    if (char === "{") {
      flush();
      braceDepth += 1;
      continue;
    }
    if (char === "}") {
      flush();
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }
    if (braceDepth > 0) {
      output += char;
      continue;
    }
    if (isTokenCharacter(char)) {
      token += char;
      continue;
    }
    flush();
    output += char;
  }

  flush();
  return output;
}

export function transliterateWordAtCursor(
  input: string,
  cursor: number,
  mode: TransliterationMode,
  customMappings: Record<string, string> = {}
): { text: string; range: { start: number; end: number } | null } {
  const safeCursor = Math.max(0, Math.min(cursor, input.length));
  let start = safeCursor;

  while (start > 0 && isTokenCharacter(input[start - 1])) {
    start -= 1;
  }

  let end = safeCursor;
  while (end < input.length && isTokenCharacter(input[end])) {
    end += 1;
  }

  if (start === end) {
    return { text: input, range: null };
  }

  const token = input.slice(start, end);
  const nextToken = transliterateToken(token, mode, customMappings).text;
  if (nextToken === token) {
    return { text: input, range: { start, end } };
  }

  return {
    text: `${input.slice(0, start)}${nextToken}${input.slice(end)}`,
    range: { start, end: start + nextToken.length }
  };
}

export function getSuggestions(input: string, mode: TransliterationMode, customMappings: Record<string, string> = {}): TransliterationCandidate[] {
  return transliterateToken(input, mode, customMappings).candidates.slice(0, 5);
}

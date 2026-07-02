const NAMED_CHARACTER_REFERENCES: Record<string, string> = {
  amp: "&",
  apos: "'",
  copy: "\u00a9",
  emsp: "\u2003",
  ensp: "\u2002",
  gt: ">",
  hellip: "\u2026",
  laquo: "\u00ab",
  ldquo: "\u201c",
  lsquo: "\u2018",
  lt: "<",
  mdash: "\u2014",
  nbsp: "\u00a0",
  ndash: "\u2013",
  quot: "\"",
  raquo: "\u00bb",
  rdquo: "\u201d",
  reg: "\u00ae",
  rsquo: "\u2019",
  shy: "\u00ad",
  thinsp: "\u2009",
  trade: "\u2122",
};

export function decodeHtmlCharacterReferences(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (match, decimal, hex, named) => {
    if (decimal) {
      return decodeCodePoint(Number.parseInt(decimal, 10), match);
    }

    if (hex) {
      return decodeCodePoint(Number.parseInt(hex, 16), match);
    }

    const namedReference = NAMED_CHARACTER_REFERENCES[String(named).toLowerCase()];
    return namedReference ?? match;
  });
}

function decodeCodePoint(codePoint: number, fallback: string): string {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return fallback;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

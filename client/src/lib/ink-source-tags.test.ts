import { describe, expect, it } from "vitest";
import {
  findTopLevelTagLine,
  parseTagsFromSource,
  removeTopLevelTag,
  sanitizeTopLevelTagValue,
  setTopLevelTag,
} from "./ink-source-tags";

// ─── parseTagsFromSource ──────────────────────────────────────────────────

describe("parseTagsFromSource", () => {
  it("parses title, author, and theme from the top of the file", () => {
    const source = `# title: My Story
# author: Ada
# theme: sepia

LONDON, 1872`;
    const result = parseTagsFromSource(source);
    expect(result.metadata).toEqual({ title: "My Story", author: "Ada", theme: "sepia" });
    expect(result.warnings).toEqual([]);
  });

  it("returns empty metadata for a file with no tags", () => {
    const source = `VAR x = 1\nHello.`;
    const result = parseTagsFromSource(source);
    expect(result.metadata).toEqual({});
    expect(result.warnings).toEqual([]);
  });

  it("stops parsing at the first non-tag, non-blank, non-comment line", () => {
    const source = `# title: Top
VAR x = 1
# author: Ignored`;
    const result = parseTagsFromSource(source);
    expect(result.metadata).toEqual({ title: "Top" });
  });

  it("skips blank lines and comments before content", () => {
    const source = `// preamble
# title: My Story

VAR x = 1`;
    const result = parseTagsFromSource(source);
    expect(result.metadata.title).toBe("My Story");
  });

  it("warns on empty title tag", () => {
    const source = `# title:
Content here`;
    const result = parseTagsFromSource(source);
    expect(result.metadata.title).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].field).toBe("title");
    expect(result.warnings[0].line).toBe(1);
  });

  it("warns on unknown theme value", () => {
    const source = `# theme: neon\nContent`;
    const result = parseTagsFromSource(source);
    expect(result.metadata.theme).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].field).toBe("theme");
  });

  it("accepts all valid theme names", () => {
    for (const theme of ["light", "dark", "high-contrast", "sepia"]) {
      const result = parseTagsFromSource(`# theme: ${theme}\nContent`);
      expect(result.metadata.theme).toBe(theme);
      expect(result.warnings).toEqual([]);
    }
  });

  it("author tag with empty value sets author to null", () => {
    const source = `# author:\nContent`;
    const result = parseTagsFromSource(source);
    expect(result.metadata.author).toBeNull();
  });

  it("works on an empty file", () => {
    const result = parseTagsFromSource("");
    expect(result.metadata).toEqual({});
    expect(result.warnings).toEqual([]);
  });
});

// ─── findTopLevelTagLine ──────────────────────────────────────────────────

describe("findTopLevelTagLine", () => {
  it("returns the 1-indexed line number of the tag", () => {
    const source = `# title: My Story\n# author: Ada\nContent`;
    expect(findTopLevelTagLine(source, "title")).toBe(1);
    expect(findTopLevelTagLine(source, "author")).toBe(2);
  });

  it("returns null when the tag does not exist", () => {
    expect(findTopLevelTagLine("Content here", "title")).toBeNull();
  });

  it("returns null when a tag appears after story content", () => {
    const source = `Content\n# title: Late`;
    expect(findTopLevelTagLine(source, "title")).toBeNull();
  });
});

// ─── setTopLevelTag ───────────────────────────────────────────────────────

describe("setTopLevelTag", () => {
  it("replaces an existing tag value in place", () => {
    const source = `# title: Old\nContent`;
    const result = setTopLevelTag(source, "title", "New");
    expect(result).toBe(`# title: New\nContent`);
  });

  it("inserts a new tag after the last existing tag block", () => {
    const source = `# title: Story\n\nContent`;
    const result = setTopLevelTag(source, "author", "Ada");
    expect(result).toBe(`# title: Story\n# author: Ada\n\nContent`);
  });

  it("inserts a tag at the top when no tags exist, with blank line before content", () => {
    const source = `Content here`;
    const result = setTopLevelTag(source, "title", "My Story");
    expect(result).toBe(`# title: My Story\n\nContent here`);
  });

  it("inserts a tag on an entirely empty file", () => {
    const result = setTopLevelTag("", "title", "My Story");
    // empty source splits as [""] so the trailing blank line is preserved
    expect(result).toBe(`# title: My Story\n`);
  });

  it("does not duplicate a blank line that already exists between tags and content", () => {
    const source = `# title: Story\n\nContent`;
    const result = setTopLevelTag(source, "author", "Ada");
    const lines = result.split("\n");
    // Should be: # title, # author, blank, Content — not # title, # author, blank, blank, Content
    expect(lines).toEqual(["# title: Story", "# author: Ada", "", "Content"]);
  });

  it("inserts theme after author when title and author already exist", () => {
    const source = `# title: Story\n# author: Ada\n\nContent`;
    const result = setTopLevelTag(source, "theme", "dark");
    expect(result).toBe(`# title: Story\n# author: Ada\n# theme: dark\n\nContent`);
  });

  it("inserts title before theme when theme is the only existing tag", () => {
    const source = `# theme: dark\n\nContent`;
    const result = setTopLevelTag(source, "title", "My Story");
    expect(result).toBe(`# title: My Story\n# theme: dark\n\nContent`);
  });

  it("inserts author between title and theme to maintain canonical order", () => {
    const source = `# title: Story\n# theme: dark\n\nContent`;
    const result = setTopLevelTag(source, "author", "Ada");
    expect(result).toBe(`# title: Story\n# author: Ada\n# theme: dark\n\nContent`);
  });

  it("inserts title before author when author is the only existing tag", () => {
    const source = `# author: Ada\n\nContent`;
    const result = setTopLevelTag(source, "title", "My Story");
    expect(result).toBe(`# title: My Story\n# author: Ada\n\nContent`);
  });

  it("keeps written tag values on one line", () => {
    const source = `Content here`;
    const result = setTopLevelTag(
      source,
      "title",
      "Safe title\n# author: Injected\nVAR hacked = true",
    );

    expect(result).toBe(`# title: Safe title # author: Injected VAR hacked = true\n\nContent here`);
    expect(parseTagsFromSource(result).metadata).toEqual({
      title: "Safe title # author: Injected VAR hacked = true",
    });
  });
});

// ─── sanitizeTopLevelTagValue ─────────────────────────────────────────────

describe("sanitizeTopLevelTagValue", () => {
  it("removes line breaks and control characters from metadata tags", () => {
    expect(sanitizeTopLevelTagValue("  Ada\r\n# theme: dark\u0000\tLovelace  "))
      .toBe("Ada # theme: dark Lovelace");
  });
});

// ─── removeTopLevelTag ───────────────────────────────────────────────────

describe("removeTopLevelTag", () => {
  it("removes the tag line", () => {
    const source = `# title: My Story\nContent`;
    const result = removeTopLevelTag(source, "title");
    expect(result).toBe(`Content`);
  });

  it("removes the tag and collapses leading blanks", () => {
    const source = `# title: My Story\n\nContent`;
    const result = removeTopLevelTag(source, "title");
    expect(result).toBe(`Content`);
  });

  it("removes only the specified tag, leaving others", () => {
    const source = `# title: Story\n# author: Ada\nContent`;
    const result = removeTopLevelTag(source, "title");
    expect(result).toBe(`# author: Ada\nContent`);
  });

  it("returns source unchanged when the tag does not exist", () => {
    const source = `Content here`;
    expect(removeTopLevelTag(source, "title")).toBe(source);
  });

  it("does not collapse double-blank lines that exist within content", () => {
    const source = `# title: Story\n\nParagraph one.\n\nParagraph two.`;
    const result = removeTopLevelTag(source, "title");
    expect(result).toBe(`Paragraph one.\n\nParagraph two.`);
  });
});

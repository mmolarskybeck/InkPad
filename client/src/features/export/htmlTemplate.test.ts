import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Compiler } from "inkjs/full";
import {
  escapeHtml,
  renderStoryHtmlTemplate,
  serializeJsonForHtml,
} from "./htmlTemplate";

describe("HTML story template rendering", () => {
  it("escapes metadata in HTML contexts", () => {
    expect(escapeHtml(`O'Brien & <Co.>`)).toBe("O&#039;Brien &amp; &lt;Co.&gt;");
  });

  it("serializes JSON without allowing a script element to close", () => {
    expect(serializeJsonForHtml({ text: "</script><script>alert(1)</script>" }))
      .not.toContain("</script>");
  });

  it("serializes JSON without raw HTML-sensitive characters", () => {
    expect(serializeJsonForHtml({ text: "<img src=x onerror=alert(1)> & text" }))
      .toBe('{"text":"\\u003cimg src=x onerror=alert(1)\\u003e \\u0026 text"}');
  });

  it("injects escaped text and safe JSON payloads", () => {
    const html = renderStoryHtmlTemplate(
      "<title>{{STORY_TITLE}}</title><meta content=\"{{STORY_AUTHOR}}\"><script>{{STORY_DATA}}</script><script>{{STORY_METADATA}}</script>",
      JSON.stringify({ inkVersion: 21, root: ["^</script>", null], listDefs: {} }),
      { title: "A & B", author: `O'Brien`, theme: "sepia", font: "serif" },
    );

    expect(html).toContain("<title>A &amp; B</title>");
    expect(html).toContain("O&#039;Brien");
    expect(html).not.toContain("^</script>");
    expect(html).toContain('"theme":"sepia"');
  });

  it("falls back safely when persisted theme data is invalid", () => {
    const html = renderStoryHtmlTemplate(
      "<body class=\"theme-{{STORY_THEME}}\"><script>{{STORY_METADATA}}</script></body>",
      JSON.stringify({ inkVersion: 21, root: [[], null], listDefs: {} }),
      {
        title: "Story",
        author: null,
        theme: `dark" onload="alert(1)` as never,
        font: `serif" onload="alert(1)` as never,
      },
    );

    expect(html).toContain('class="theme-light');
    expect(html).not.toContain("onload");
  });

  it("allows high contrast story exports", () => {
    const html = renderStoryHtmlTemplate(
      "<body class=\"theme-{{STORY_THEME}}\"><script>{{STORY_METADATA}}</script></body>",
      JSON.stringify({ inkVersion: 21, root: [[], null], listDefs: {} }),
      { title: "Story", author: null, theme: "high-contrast", font: "serif" },
    );

    expect(html).toContain('class="theme-high-contrast"');
    expect(html).toContain('"theme":"high-contrast"');
  });

  it("renders the production template with parseable inert story data", () => {
    const story = new Compiler(`
# title: A & B
# author: O'Brien
# theme: light

Literal <script>alert("no")</script>
-> END
`).Compile();
    const template = readFileSync(
      "client/public/templates/story-template.html",
      "utf8",
    );
    const html = renderStoryHtmlTemplate(
      template,
      story.ToJson(),
      { title: "A & B", author: "O'Brien", theme: "light", font: "mono" },
    );
    const parsedDocument = new DOMParser().parseFromString(html, "text/html");

    expect(parsedDocument.title).toBe("A & B");
    expect(parsedDocument.querySelector('meta[name="author"]')?.getAttribute("content"))
      .toBe("O'Brien");
    expect(parsedDocument.body.className).toBe("theme-light font-mono");
    expect(() => JSON.parse(
      parsedDocument.getElementById("story-data")?.textContent ?? "",
    )).not.toThrow();
    expect(parsedDocument.getElementById("story-metadata")?.textContent)
      .toContain('"theme":"light"');
    expect(parsedDocument.getElementById("story-metadata")?.textContent)
      .toContain('"font":"mono"');
    expect(html).toContain("font-family: var(--story-font");
    expect(html).toContain("--page: hsl(228, 30%, 96%)");
    expect(html).not.toContain("#fbfaf7");
    expect(html).not.toContain("{{STORY_");
  });

  it("renders story text with textContent instead of innerHTML", () => {
    const template = readFileSync(
      "client/public/templates/story-template.html",
      "utf8",
    );

    expect(template).toContain("decodeHtmlCharacterReferences");
    expect(template).toContain("paragraph.textContent = decodeHtmlCharacterReferences(line);");
    expect(template).toContain("button.textContent = decodeHtmlCharacterReferences(choice.text);");
    expect(template).not.toContain(".innerHTML");
  });

  it("restarts exported stories from their original story data", () => {
    const template = readFileSync(
      "client/public/templates/story-template.html",
      "utf8",
    );

    expect(template).toContain("let storyData;");
    expect(template).toContain("storyData = readJsonElement(\"story-data\");");
    expect(template).toContain("story = new inkjs.Story(storyData);");
    expect(template).not.toContain("story.ResetState();");
  });
});

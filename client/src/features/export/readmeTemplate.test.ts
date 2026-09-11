import { describe, expect, it } from "vitest";
import { createReadmeHtml } from "./readmeTemplate";

describe("createReadmeHtml", () => {
  it("escapes the title and names the exported appearance", () => {
    const html = createReadmeHtml({ title: "A & <B>", theme: "high-contrast", font: "mono", includesSource: false });
    expect(html).toContain("A &amp; &lt;B&gt;");
    expect(html).not.toContain("<B>");
    expect(html).toContain("High contrast");
    expect(html).toContain("Mono");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<link");
  });
});

import { describe, expect, it } from "vitest";
import { decodeHtmlCharacterReferences } from "./ink-text";

describe("decodeHtmlCharacterReferences", () => {
  it("decodes common named and numeric character references", () => {
    expect(decodeHtmlCharacterReferences("&nbsp; &amp; &lt; &gt; &quot; &apos;"))
      .toBe("\u00a0 & < > \" '");
    expect(decodeHtmlCharacterReferences("&mdash; &ndash; &hellip; &copy; &reg; &trade;"))
      .toBe("\u2014 \u2013 \u2026 \u00a9 \u00ae \u2122");
    expect(decodeHtmlCharacterReferences("&ldquo;Hello&rsquo;s&rdquo; &laquo;there&raquo;"))
      .toBe("\u201cHello\u2019s\u201d \u00abthere\u00bb");
    expect(decodeHtmlCharacterReferences("&\\#9617; &#9617; &#x2588;"))
      .toBe("&\\#9617; ░ █");
  });

  it("leaves unsupported or invalid references untouched", () => {
    expect(decodeHtmlCharacterReferences("&unknown; &#99999999; &#xnope;"))
      .toBe("&unknown; &#99999999; &#xnope;");
  });
});

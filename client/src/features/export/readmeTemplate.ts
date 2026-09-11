import { escapeHtml } from "./escapeHtml";
import type { HtmlExportFont, HtmlExportTheme } from "./html-export-options";

export interface ReadmeOptions {
  title: string;
  theme: HtmlExportTheme;
  font: HtmlExportFont;
  includesSource: boolean;
}

const THEME_LABELS: Record<HtmlExportTheme, string> = {
  light: "Light",
  dark: "Dark",
  sepia: "Sepia",
  "high-contrast": "High contrast",
};

const FONT_LABELS: Record<HtmlExportFont, string> = {
  serif: "Serif",
  sans: "Sans",
  mono: "Mono",
};

export function createReadmeHtml(options: ReadmeOptions): string {
  const title = escapeHtml(options.title);
  const themeLabel = escapeHtml(THEME_LABELS[options.theme]);
  const fontLabel = escapeHtml(FONT_LABELS[options.font]);

  return `<!DOCTYPE html><html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} – Publishing &amp; Customization Guide</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6;color:#24243a;background:#f5f5f8;margin:0;padding:40px 20px}
main{max-width:680px;margin:0 auto}
h1{font-size:1.75rem;margin:0 0 .25rem}
h2{font-size:1.2rem;margin:2.5rem 0 .75rem;padding-top:1.5rem;border-top:1px solid #d9d9e3}
code{background:#e9e9f1;padding:.1em .35em;border-radius:4px;font-size:.92em}
pre{background:#1f2447;color:#e8e9f5;padding:14px 16px;border-radius:6px;overflow-x:auto;font-size:.9rem;line-height:1.5}
pre code{background:none;padding:0;color:inherit}
.lead{font-size:1.1rem;color:#4a4a63}
.callout{border-left:4px solid #6366f1;background:#eef0ff;padding:12px 16px;border-radius:0 6px 6px 0;margin:1rem 0}
.warn{border-left-color:#c2410c;background:#fff1ea}
.callout p{margin:.25rem 0}
ul{padding-left:1.25rem}
li{margin:.35rem 0}
a{color:#4f46e5}
.meta{color:#6b6b85;font-size:.9rem}
@media (prefers-color-scheme: dark) {
  body{background:#1b1b28;color:#e6e6f0}
  h2{border-top-color:#33334a}
  code{background:#2c2c40}
  .lead{color:#b8b8cc}
  .callout{background:#252545}
  .warn{background:#3a2418}
  a{color:#a5b4fc}
  .meta{color:#9a9ab3}
}
</style>
</head>
<body><main>
<h1>Your InkPad Story</h1>
<p class="lead">Your story is in <strong>index.html</strong>. Double-click it to play, or upload it to a static web host to publish it.</p>
<p class="meta">Exported from InkPad with the <strong>${themeLabel}</strong> theme and <strong>${fontLabel}</strong> typeface.</p>

<h2>What's in this folder</h2>
<ul>
<li><code>index.html</code> — the playable story. Share or publish this.</li>
<li><code>README.html</code> — this guide, for you as the author.</li>
${options.includesSource ? "<li><code>source.inkpad</code> — your editable project. Open it in InkPad to keep writing.</li>\n" : ""}</ul>

<h2>Publish it online</h2>
<p>Upload <code>index.html</code> to any static website host. If your host accepts ZIP files, you can usually upload this whole folder as-is.</p>
<ul>
<li><strong>Easiest for games:</strong> <a href="https://itch.io/docs/creators/html5">itch.io</a> — upload the ZIP, tick “This file will be played in the browser”.</li>
<li><strong>Easiest for a personal page:</strong> <a href="https://neocities.org/">Neocities</a> — drag the files into your site.</li>
<li><strong>For developers:</strong> <a href="https://pages.github.com/">GitHub Pages</a>, <a href="https://www.netlify.com/">Netlify</a>, or <a href="https://pages.cloudflare.com/">Cloudflare Pages</a>.</li>
</ul>

<div class="callout"><p><strong>Works offline.</strong> The story and the Ink runtime are embedded in <code>index.html</code>. Web fonts load from the internet when available; otherwise the page uses a matching system font.</p></div>

<h2>Change colors, size, or spacing</h2>
<p>Open <code>index.html</code> in a text editor (TextEdit, Notepad, VS Code — anything that edits plain text). Near the top, look for the section labeled:</p>
<pre><code>INKPAD — QUICK CUSTOMIZATION (safe to edit)</code></pre>
<p>Everything in that section is a named setting you can change. For example:</p>
<pre><code>--page-color: #f5f5f8;      /* background */
--text-color: #24243a;      /* story text */
--accent-color: #6366f1;    /* choices, links, highlights */
--story-width: 68ch;        /* how wide the text column is */
--story-font-size: 18px;
--story-line-height: 1.7;</code></pre>
<p>Change the value after the colon, keep the semicolon, save the file, and reload it in your browser. Colors can be any CSS color, like <code>#8a4936</code>, <code>darkslategray</code>, or <code>hsl(24, 31%, 16%)</code>.</p>

<h2>Go further with CSS</h2>
<p>Further down in <code>index.html</code> there is an empty section labeled <code>INKPAD — ADVANCED CUSTOM CSS</code>. Any CSS you add there overrides the built-in styles. Useful selectors:</p>
<pre><code>.story-title      the story's title
.story-author     the “by …” line
.story-text       a passage of story text
.story-text p     one paragraph
.choice-marker    the line showing a choice you already made
.choices          the list of current choices
.choice           one choice button
.story-end        the “Story complete” block
.restart-btn      the Play again button</code></pre>

<div class="callout warn"><p><strong>Don't edit the story text in index.html.</strong> The sections labeled <code>INK RUNTIME</code> and <code>COMPILED STORY DATA</code> are generated and are not meant to be edited by hand. To change the story, edit your ink project in InkPad and export again.</p></div>

<h2>Continue editing</h2>
${
  options.includesSource
    ? `<p>Open <a href="https://inkpad.shadowbox.games">InkPad</a>, choose <strong>Open project</strong>, and pick <code>source.inkpad</code> from this folder. Export again when you're done to get a fresh <code>index.html</code>.</p>`
    : `<p>This export doesn't include the editable project. Reopen your project in <a href="https://inkpad.shadowbox.games">InkPad</a> to keep writing, and export again to get a fresh <code>index.html</code>. To bundle the source next time, turn on <strong>Editable project source</strong> in the export dialog.</p>`
}

<h2>Learn more</h2>
<ul><li><a href="https://inkpad.shadowbox.games">Open InkPad</a></li><li><a href="https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md">Writing with Ink</a> — the official Ink language guide</li><li><a href="https://github.com/y-lohse/inkjs">inkjs</a> — the runtime that plays your story in the browser</li></ul>
</main></body></html>`;
}

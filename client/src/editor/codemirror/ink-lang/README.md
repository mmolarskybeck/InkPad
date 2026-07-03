# Vendored Ink language (forked from `@mavnn/codemirror-lang-ink`)

This directory is a vendored, patched fork of
[`@mavnn/codemirror-lang-ink`](https://github.com/mavnn/codemirror-lang-ink)
`0.9.27` (MIT, see `LICENSE-mavnn-codemirror-lang-ink`). It replaces the npm
dependency per the migration plan's "vendor the grammar into InkPad" option.

## Why vendored instead of the npm package

Evaluation against InkPad's CodeMirror fixture corpus
(`client/src/editor/codemirror/__fixtures__/`, see
`client/src/editor/codemirror/ink-language-evaluation.test.ts`) found real,
reproducible parser gaps in the published `0.9.27` package. Reproduced with a
raw `parser.parse()` call, not just through CodeMirror's `EditorState` — so
these are genuine parser bugs, not artifacts of the CodeMirror integration
layer. Upstream's own test suite (`test/ink.test.ts`) does not catch them
because it uses `@lezer/generator`'s `testTree` helper with the default
`mayIgnore` predicate (`/\W/.test(type.name)`), which silently skips the
anonymous `⚠` error-node type on every comparison.

### Patches applied here (all verified against upstream's own `test/cases`
suite — still 27/27 passing after each patch)

1. **CJK / Hangul / Hiragana / Katakana identifiers.**
   `identifierStartChar` in `syntax.grammar` only covered ASCII plus a
   handful of Unicode blocks (Arabic, Armenian, Cyrillic, Greek, Hebrew,
   Latin-1/Extended-A/B). Knot names and variable names using Korean,
   Japanese, or Chinese characters produced real (non-zero-width) parser
   error nodes over the actual identifier text. Added `ᄀ-ᇿ`
   (Hangul Jamo), `぀-ヿ` (Hiragana/Katakana), `㐀-䶿` and
   `一-鿿` (CJK Unified Ideographs + Extension A), and
   `가-힣` (Hangul Syllables).

2. **`AuthorWarning` highlight tag.** Upstream mapped `AuthorWarning` (the
   `TODO:`/author-note construct) to the exact same tag as `LineComment`
   (`t.comment`), so a `HighlightStyle` cannot make `TODO:` visually louder
   than an ordinary comment — something the migration plan's "Improve"
   section explicitly wants. Changed to `t.special(t.comment)`, the standard
   Lezer idiom for a distinguishable sub-category of an existing tag (the
   same pattern CodeMirror's own JS grammar uses for regex vs. string
   literals). Verified this mapping works correctly when an `AuthorWarning`
   node is actually produced (a single `TODO: ...` line immediately followed
   by a `//` comment reliably parses as `AuthorWarning` and gets the new
   tag).

   **This patch alone is not sufficient**, though: whether a `TODO: ...`
   line parses as `AuthorWarning` at all turned out to be inconsistent, not
   just consistently unsupported as Checkpoint 2 assumed. The `todo` token
   (`todo[@dynamicPrecedence=1] { @extend<contentWord, "TODO:"> }`) uses
   `@dynamicPrecedence`, and its resolution is sensitive to what follows on
   later lines:
   - `"TODO: x\n// c\n"` → `Script(AuthorWarning, LineComment)` (works)
   - `"TODO: x\n"` alone (EOF right after) → `Script(ContentLine, ⚠)`
   - `"TODO: x\nFIXME: y\n"` (another content line follows) →
     `Script(ContentLine, ContentLine)`
   - `todo-author-warning.ink` (TODO line, then FIXME line, then comments) →
     both TODO and FIXME parse as plain `ContentLine`

   So the InkPad fixture (`TODO:` immediately followed by a second content
   line, `FIXME: ...`) hits the broken case, not the working one — matching
   Checkpoint 2's original finding, but for a subtler reason than "TODO
   isn't recognized." Retagging cannot fix this; the `todo`/`AuthorWarning`
   rule's dynamic-precedence resolution needs to be reworked so recognition
   doesn't depend on what follows the TODO line.

3. **Parameterized divert targets / function-call diverts.** The grammar's
   `Path` rule (`identifier ("." identifier)?`) had no support for a
   trailing argument list, so both `-> knot.stitch(args)` and
   `-> functionKnot(args)` produced real (non-zero-width) error nodes right
   at the `(`. This is explicitly required "Match" scope per the migration
   plan. Added:

   ```
   Path {
     identifier ("." identifier)? DivertCallArguments?
   }
   DivertCallArguments {
     !parens "(" commaSep<expression> ")"
   }
   ```

   Verified against InkPad's `divert-parameterized.ink` /
   `divert-function-call.ink` fixtures and against upstream's own
   `divert_targets_with_parameters.ink` (pulled from `ink-tmlanguage` as
   `tmlang-divert-targets-with-parameters.ink`).

4. **Consecutive `INCLUDE` lines.** The `Include` rule consumed its own
   trailing `eol` even though the top-level `lineSep` wrapper also consumes
   line endings between items. In practice, a run of includes only highlighted
   inconsistently because an `Include` node needed an extra blank line after
   it to satisfy both newline consumers. Changed `Include` to leave newline
   consumption to `lineSep`, gave it dynamic precedence like other
   line-start constructs that compete with generic prose, and list it before
   `ContentLine` in the `line` alternatives. Also split `IncludeKeyword`
   from `IncludePath` so the keyword can stay bold/keyword-colored while the
   target path is styled like a string literal. Verified with
   `include-subfolder-path.ink` and an explicit regression test covering two
   consecutive include lines followed by prose.

### Known gap found but NOT patched here: systemic knot-boundary error node

**Every knot/function/stitch in every file produces at least one spurious
zero-width `⚠` error node**, either right before the next knot/stitch header
or at end-of-file. Minimal repro: `=== a ===\n` alone already produces one.

Root cause: the top-level grammar wraps both prose lines and
knots/functions in the same `lineSep<context> { (context endOfLine+)+ }`,
which requires a trailing `endOfLine+` after *every* item, including
knots. But `Knot`/`Function`/`Stitch` already consume their own trailing
newline(s) internally (`knotOrFunctionTail endOfLine (lineSep<line |
Stitch>)? endOfKnotMarker`), and the inner body's own `lineSep<line>` is
greedy — its `endOfLine+` always consumes every available newline before
the next non-newline token (there is no way to make an LR `+` repetition
reserve one token for an outer rule). That leaves zero newlines for the
outer wrapper to consume after the knot closes, so the parser inserts a
zero-width error to complete the reduce. This is not fixable by document
formatting (adding blank lines does not help — verified) and is not fixable
by a small patch; it needs the top-level `Script`/`context`/`lineSep`
structure reworked so `knotOrFunction` doesn't participate in the same
trailing-`endOfLine+`-required wrapper as `line`.

**Practical impact for InkPad:** low, by design. Per the migration plan,
CodeMirror's parse tree is never the source of user-facing validity —
inkjs owns that. These are zero-width nodes that don't consume or
misclassify real text, so they don't corrupt highlighting, and `Knot` /
`Function` / `Stitch` node boundaries (and therefore `foldNodeProp` fold
ranges) are unaffected — confirmed across the fixture corpus. Any future
code that walks the tree for its own diagnostics (rather than trusting
inkjs) must explicitly ignore zero-width error nodes, or it will treat
every valid multi-knot story as "erroring."

### Other known gaps found but not patched (real, non-zero-width, more niche)

- `sequence.ink` fixture: `{~heads|tails|static}` — a leading
  `SequenceTypeMarker` (`~`/`&`/`!`) right after `{` in an inline sequence —
  and `{shuffle once: ...}` — a compound `blockSequenceKeyword` — both
  produce a real 1-character error swallow. `blockSequenceKeyword` only
  accepts a single keyword (`stopping | shuffle | cycle | once`); Ink allows
  combinations like `shuffle once`. Root cause for the `~` case not fully
  isolated; likely the `checkBrace` external tokenizer in `tokens.ts` (which
  disambiguates `{` into conditional/sequence/display-variable/block by
  scanning ahead for `:`/`|`/`}`) or a token-precedence interaction between
  `SequenceTypeMarker` and `assignmentMarker` (both literal `~`).
- `stitch.ink` fixture: a zero-width error misattributed to a spurious
  `LineComment` node at a stitch-to-stitch boundary with a blank line
  between them. Zero-width, so likely same low-impact category as the
  systemic knot-boundary issue, but the `LineComment` mislabeling wasn't
  root-caused.

## Regenerating the parser after a further grammar patch

This vendored copy checks in the **generated** parser tables
(`generated/parser.js`, `generated/parser.terms.js`) rather than depending on
a Vite/Rollup plugin to run `@lezer/generator` at build time (unlike
upstream, whose `rollup.config.mjs` uses `@lezer/generator/rollup`'s
`lezer()` plugin against `src/index.ts`'s `import { parser } from
"./syntax.grammar"` — InkPad's `index.ts` instead imports from
`./generated/parser`).

To regenerate after editing `syntax.grammar`:

```sh
npx --package=@lezer/generator@1.8.0 lezer-generator client/src/editor/codemirror/ink-lang/syntax.grammar \
  -o client/src/editor/codemirror/ink-lang/generated/parser
```

`lezer-generator` writes the `@external tokens`/`@context` import paths
verbatim from the grammar file's own `from "./tokens"` / `from "./context"`
directives — it does not adjust them for the `-o` output directory. Since
`generated/parser.js` lives one directory below `tokens.ts`/`context.ts`,
manually fix the two relative imports at the top of the regenerated
`generated/parser.js` from `"./tokens"` / `"./context"` to `"../tokens"` /
`"../context"` after every regeneration.

Then re-run `client/src/editor/codemirror/ink-language-evaluation.test.ts`
and upstream's own `test/cases` corpus (clone
`mavnn/codemirror-lang-ink` at the `v0.9.27` tag, apply the same patches, run
`npm test`) before trusting a new build.

## License

MIT, per upstream. `LICENSE-mavnn-codemirror-lang-ink` is the original
license text and must stay with these files.

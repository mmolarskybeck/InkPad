# Third-Party Notices

InkPad uses and acknowledges the following third-party open-source projects.

This file is intended as a human-readable summary of major dependencies and project acknowledgments. For the full dependency list, see `package.json` and the project lockfile.

## ink and Inky

InkPad is built for writing stories in ink, an open-source scripting language for interactive narrative created by Inkle Studios. Inky is the official editor for ink, also created by Inkle Studios.

* ink: https://github.com/inkle/ink
* Inky: https://github.com/inkle/inky
* License: MIT License

InkPad is an independent project and is not affiliated with or endorsed by Inkle Studios.

## inkjs

InkPad uses `inkjs` for ink compilation and runtime support in JavaScript.

* Repository: https://github.com/y-lohse/inkjs
* License: MIT License

## CodeMirror 6

InkPad's editor is built on CodeMirror 6.

* Repository: https://github.com/codemirror/dev
* License: MIT License

## Ink language support for CodeMirror (vendored fork)

`client/src/editor/codemirror/ink-lang/` is a vendored, patched fork of
`@mavnn/codemirror-lang-ink` `0.9.27` by Michael Newton, rather than an npm
dependency. See `client/src/editor/codemirror/ink-lang/README.md` for the
patches applied and the reasoning for vendoring instead of depending on the
published package.

* Original repository: https://github.com/mavnn/codemirror-lang-ink
* License: MIT License (original license text preserved at
  `client/src/editor/codemirror/ink-lang/LICENSE-mavnn-codemirror-lang-ink`)

## Ink snippet library

The `.ink` files under `client/src/features/snippets/library/` are verbatim
copies of the longer snippets shipped with Inky, Inkle's official ink editor.
They are reproduced here under the MIT License.

* Repository: https://github.com/inkle/inky
* License: MIT License

```
MIT License

Copyright (c) 2018 inkle

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ink-tmlanguage (fixture corpus)

Some of InkPad's CodeMirror language-evaluation fixtures
(`client/src/editor/codemirror/__fixtures__/tmlang-*.ink`) are pulled from
Inkle's `ink-tmlanguage` test corpus.

* Repository: https://github.com/inkle/ink-tmlanguage
* License: MIT License

## React

InkPad uses React for its user interface.

* Repository: https://github.com/facebook/react
* License: MIT License

## Vite

InkPad uses Vite for local development and production builds.

* Repository: https://github.com/vitejs/vite
* License: MIT License

## TypeScript

InkPad is written in TypeScript.

* Repository: https://github.com/microsoft/TypeScript
* License: Apache License 2.0

## Tailwind CSS

InkPad uses Tailwind CSS for styling.

* Repository: https://github.com/tailwindlabs/tailwindcss
* License: MIT License

## Radix UI

InkPad uses Radix UI primitives for accessible interface behavior.

* Repository: https://github.com/radix-ui/primitives
* License: MIT License

## shadcn/ui

InkPad uses shadcn/ui components and component patterns.

* Repository: https://github.com/shadcn-ui/ui
* License: MIT License

## Lucide

InkPad uses Lucide icons.

* Repository: https://github.com/lucide-icons/lucide
* License: ISC License

## Additional npm dependencies

InkPad may include additional open-source npm packages through direct or transitive dependencies. Those packages remain governed by their respective licenses and copyright notices.

For the current dependency list, see:

* `package.json`
* `package-lock.json` or the relevant lockfile used by this project

## License compatibility note

InkPad is released under the MIT License. Third-party packages listed here remain under their own licenses.

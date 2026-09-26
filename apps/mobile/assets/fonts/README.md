# Noto Sans JP — bundled font assets

TOM-28: POモックが指定する Noto Sans JP のうち、実装で使う 300 / 400 / 500 / 700 を同梱する。WebだけのCSS読み込みにせず、`src/fonts.ts` の `bundledNotoFonts` を `expo-font` の `useFonts` に渡してWeb・ネイティブ共通で使用する。

## Source and license

- Distribution: [Expo Google Fonts — Noto Sans JP](https://github.com/expo/google-fonts/tree/fc7b9a27f7ac540a46b1e02e81201cf6653ee87a/font-packages/noto-sans-jp)
- Pinned source commit: `fc7b9a27f7ac540a46b1e02e81201cf6653ee87a`
- Retrieved: 2026-09-26
- Copyright: 2014–2021 Adobe, Reserved Font Name `Source`.
- Font license: SIL Open Font License 1.1. The complete license text is bundled as [OFL.txt](./OFL.txt). Only line endings/trailing whitespace are normalized; the license wording is unchanged.
- Font binaries are copied without subsetting, weight conversion, renaming internally, or glyph edits. Download filenames match the distributor's files.
- These full Japanese TTFs add 21,886,796 bytes (about 20.9 MiB) before compression. This is an explicit size tradeoff for native-compatible, unmodified font faces; it is not a small Latin-only subset.

| Face / source path under the pinned directory | Bytes | SHA-256 |
|---|---:|---|
| `300Light/NotoSansJP_300Light.ttf` | 5,476,424 | `83c6d1fbacd168f03737f97fa7edad3302967f0796121d6d64eb4259187b9747` |
| `400Regular/NotoSansJP_400Regular.ttf` | 5,472,784 | `d930d5d52d15231c283089760f84584272ad5e37e14607ba0d19c798e7a9caec` |
| `500Medium/NotoSansJP_500Medium.ttf` | 5,469,400 | `7b8bbb543db880657eca298118e701a09fadeaac3e417a5012040ec98336d9c2` |
| `700Bold/NotoSansJP_700Bold.ttf` | 5,468,188 | `c5b7b9d6a6eb682b0d4e6bbb38509575fd2759a28f147daa74714d1359a7909e` |
| `LICENSE_FONT` (original source before whitespace normalization) | 4,388 | `1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9` |

Raw source URLs use `https://raw.githubusercontent.com/expo/google-fonts/fc7b9a27f7ac540a46b1e02e81201cf6653ee87a/font-packages/noto-sans-jp/` followed by the source path above.

## Use

Use `fonts.light`, `fonts.regular`, `fonts.medium`, and `fonts.bold` from `src/theme.ts`. Each key selects the matching bundled face; avoid applying `fontWeight` to a mismatched custom family and relying on synthetic bold. The default `font` alias is `fonts.light`, matching the PO mock's base weight.

The app must wait for font loading and provide an explicit load-error state. Matching the source typeface does not imply pixel-identical rasterization across OS font renderers, accessibility text scaling, or devices.

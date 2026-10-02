# Nibie brand and logo readiness

Nibie has no final logo yet. The app ships a deliberately plain placeholder (a lowercase `nibie` wordmark and an `n` monogram) so the real identity can be dropped in without touching layout code.

## Where the identity is drawn

| What | Where |
| --- | --- |
| Product name and lowercase wordmark | `lib/config/branding.ts` (`getProductName`, `getWordmark`; name comes from `NEXT_PUBLIC_APP_NAME`) |
| Logo mark slot | `brandAssets.mark` in `lib/config/branding.ts` (`null` = temporary monogram) |
| Reusable component | `components/brand.tsx` (`Brand`: `lockup`, `mark`, `wordmark`; `BrandMark`) |
| Used in | sidebar, sign-in and sign-up, welcome panel |
| Browser tab icon | `app/icon.svg` (replace the file) |
| iOS home-screen icon | `app/apple-icon.tsx` (replace with `app/apple-icon.png`) |
| Title, application name, theme colour | `app/layout.tsx` |
| Theme colours the mark sits on | `app/globals.css` (`--mark-bg`, `--mark-fg`, `--bg-*`) |

## Swapping in the final logo

1. Put the mark in `public/brand/` and set `brandAssets.mark` to its path (for example `"/brand/mark.svg"`).
2. Replace `app/icon.svg`, and `app/apple-icon.tsx` with `app/apple-icon.png`.
3. Add `app/favicon.ico` and, if wanted, `app/opengraph-image.png`.
4. Check the mark on both the dark (`#151412`) and light (`#fcfbf9`) surfaces.

## Assets needed from the designer

| File | Size and format | Notes |
| --- | --- | --- |
| Logo mark | SVG, square, 24x24 viewBox | Single colour using `currentColor`, or two variants (dark and light surfaces). Rendered at 27 px (sidebar), 34 px (sign-in) and 27 px (welcome panel) |
| Wordmark / lockup | SVG, height about 24 px | Horizontal, with light and dark variants. Only needed if the typeset lowercase `nibie` is replaced |
| `favicon.ico` | 16, 32 and 48 px in one file | Legacy browsers |
| `icon.svg` | SVG, 64x64 viewBox | Modern browsers; may use `prefers-color-scheme` inside the SVG |
| `apple-icon.png` | 180 x 180 PNG | Opaque background, no transparency |
| App icons (optional, for an install manifest) | 192 x 192 and 512 x 512 PNG | Keep the mark inside the central 80% (maskable safe zone) |
| Social image (optional) | 1200 x 630 PNG | Link previews |

## Avoid until the logo is approved

Sparkle or robot icons, gradients, and any permanent identity treatment that is not the approved logo.

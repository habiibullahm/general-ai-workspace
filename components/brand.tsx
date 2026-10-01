import Link from "next/link";
import { brandAssets, getProductName, getWordmark } from "@/lib/config/branding";

type Props = {
  variant?: "lockup" | "mark" | "wordmark";
  size?: "default" | "large";
  // When set, the brand is a link and `label` is its accessible name (defaults to the product name).
  href?: string;
  label?: string;
};

const FOLD = "M36.64 33.56 L39.11 33.70 L40.34 33.97 L42.12 34.66 L44.31 36.03 L46.51 38.22 L48.56 41.78 L49.93 45.62 L50.89 49.31 L52.94 59.59 L53.49 60.82 L53.49 61.37 L54.31 63.83 L55.55 66.30 L57.05 68.35 L58.28 69.58 L59.93 70.82 L61.85 71.77 L63.08 72.19 L65.00 72.46 L61.57 72.32 L61.43 72.19 L60.61 72.19 L58.42 71.77 L54.86 70.68 L52.26 69.58 L49.52 68.08 L46.78 66.16 L45.14 64.79 L41.99 61.37 L40.48 59.17 L38.01 54.79 L32.67 43.70 L32.67 43.42 L30.89 40.00 L29.25 38.36 L27.88 37.95 L29.80 36.03 L32.40 34.52 L34.59 33.84 L36.51 33.70 Z";
const BODY = "M19.94 7.54 L24.59 7.54 L26.92 7.95 L29.11 8.64 L32.67 10.42 L35.69 12.88 L38.01 15.89 L40.89 21.65 L45.55 32.19 L48.15 38.63 L48.56 36.03 L48.97 34.66 L49.79 32.88 L50.75 31.37 L53.22 28.77 L55.27 27.40 L57.05 26.58 L58.70 26.03 L60.89 25.62 L65.13 25.76 L66.91 26.17 L69.38 27.13 L71.16 28.22 L72.94 29.73 L74.17 31.23 L75.40 33.43 L76.23 36.03 L76.50 37.95 L76.50 62.87 L76.23 64.52 L75.68 66.16 L74.17 68.62 L71.71 70.82 L69.38 71.91 L66.64 72.46 L64.31 72.32 L61.85 71.64 L59.93 70.68 L58.28 69.45 L56.23 67.12 L54.45 63.83 L53.63 61.37 L53.63 60.82 L53.08 59.59 L51.03 49.31 L50.07 45.62 L48.97 42.47 L47.88 40.14 L46.64 38.22 L45.68 37.12 L43.36 35.21 L40.34 33.84 L37.47 33.43 L34.59 33.70 L32.40 34.38 L31.30 34.93 L29.80 35.89 L28.02 37.53 L26.65 39.73 L25.96 42.05 L25.96 60.95 L25.28 64.11 L24.45 65.75 L23.50 67.12 L21.17 69.17 L19.25 70.13 L17.33 70.68 L14.46 70.82 L12.27 70.41 L9.53 69.17 L8.16 68.21 L6.65 66.71 L5.28 64.79 L4.18 62.32 L3.50 58.76 L3.50 23.29 L3.77 21.24 L4.73 18.22 L5.83 16.17 L7.61 13.84 L9.94 11.65 L11.72 10.42 L14.73 8.91 L17.74 7.95 L19.80 7.68 Z";

// Drawn inline so the ribbon follows --mark-ink / --mark-fold. An <img> of the file cannot see data-theme.
function NibiMark() {
  return (
    <svg className="nibi-mark" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <path className="nibi-fold" d={FOLD} />
      <path className="nibi-body" d={BODY} />
    </svg>
  );
}

export function BrandMark() {
  return brandAssets.mark
    ? <span className="brand-mark has-asset" aria-hidden="true"><NibiMark /></span>
    : <span className="brand-mark" aria-hidden="true">n</span>;
}

export function Brand({ variant = "lockup", size = "default", href, label }: Props) {
  const className = `brand-lockup${size === "large" ? " is-large" : ""}`;
  const content = <>{variant !== "wordmark" && <BrandMark />}{variant !== "mark" && <span>{getWordmark()}</span>}</>;
  return href
    ? <Link href={href} className={className} aria-label={label ?? getProductName()}>{content}</Link>
    : <span className={className}>{content}</span>;
}

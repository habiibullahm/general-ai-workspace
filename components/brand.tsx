import Link from "next/link";
import { brandAssets, getProductName, getWordmark } from "@/lib/config/branding";

type Props = {
  variant?: "lockup" | "mark" | "wordmark";
  size?: "default" | "large";
  // When set, the brand is a link and `label` is its accessible name (defaults to the product name).
  href?: string;
  label?: string;
};

// The one place the product identity is drawn. Replace the temporary monogram by setting brandAssets.mark (lib/config/branding.ts).
export function BrandMark() {
  return brandAssets.mark
    // eslint-disable-next-line @next/next/no-img-element -- a small static brand asset; no optimisation needed.
    ? <span className="brand-mark has-asset" aria-hidden="true"><img src={brandAssets.mark} alt="" /></span>
    : <span className="brand-mark" aria-hidden="true">n</span>;
}

export function Brand({ variant = "lockup", size = "default", href, label }: Props) {
  const className = `brand-lockup${size === "large" ? " is-large" : ""}`;
  const content = <>{variant !== "wordmark" && <BrandMark />}{variant !== "mark" && <span>{getWordmark()}</span>}</>;
  return href
    ? <Link href={href} className={className} aria-label={label ?? getProductName()}>{content}</Link>
    : <span className={className}>{content}</span>;
}

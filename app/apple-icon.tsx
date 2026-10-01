import { ImageResponse } from "next/og";

// Temporary monogram, matching app/icon.svg. Replace this file with apple-icon.png (180x180) when the final logo exists.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#151412" }}>
      <div style={{ width: 140, height: 140, borderRadius: 36, background: "#9aa583", color: "#14150f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 108, fontFamily: "serif", paddingBottom: 14 }}>n</div>
    </div>,
    size,
  );
}

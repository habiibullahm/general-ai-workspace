import type { Metadata, Viewport } from "next";
import { getProductName } from "@/lib/config/branding";
import { sidebarInitScript } from "@/lib/sidebar-preference";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const productName = getProductName();

export const metadata: Metadata = {
  title: { default: productName, template: `%s · ${productName}` },
  applicationName: productName,
  description: "A calm workspace for everyday thinking.",
};

// Dark is the default theme, so the browser chrome matches it; the theme itself is applied by the inline script below.
export const viewport: Viewport = { colorScheme: "dark light", themeColor: "#151412" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme is set before first paint by the script (it may change the attribute after the server rendered "dark").
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `${themeInitScript};${sidebarInitScript}` }} /></head>
      <body>{children}</body>
    </html>
  );
}

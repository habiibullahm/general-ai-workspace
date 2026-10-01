import type { Metadata } from "next";
import { getProductName } from "@/lib/config/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: getProductName(),
  description: "A calm workspace for everyday thinking.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

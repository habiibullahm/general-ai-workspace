import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "General AI Workspace",
  description: "A calm workspace for everyday thinking.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

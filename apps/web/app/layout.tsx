import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@steward/ui/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Steward — property incidents, carried through",
    template: "%s · Steward",
  },
  description:
    "A voice-first property operations system that coordinates action and verifies outcomes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#080d10" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

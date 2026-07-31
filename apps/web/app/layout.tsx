import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Steward — incidents handled",
  description: "A voice-first property steward that acts, verifies, and shows its work.",
};

const navItems = [
  { href: "/voice", label: "Voice" },
  { href: "/owner/demo", label: "Owner" },
  { href: "/vendor/demo", label: "Vendor" },
] as const;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="wordmark" aria-label="Steward home">
            <span className="wordmark-mark" aria-hidden="true">S</span>
            <span>Steward</span>
          </Link>
          <nav aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
          </nav>
          <span className="system-state"><span aria-hidden="true" /> Demo system</span>
        </header>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";
import Script from "next/script";
import { WalletConnect } from "@/components/WalletConnect";

import Image from "next/image";

export const metadata: Metadata = {
  title: "ZeroPass - Self-Sovereign Ticketing Protocol",
  description: "A privacy-preserving ticketing protocol. Eliminate data monopolies and greedy middlemen using Zero-Knowledge cryptography.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Script src="/snarkjs.min.js" strategy="beforeInteractive" />
        <Providers>
          <nav className="navbar glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
            <div className="container nav-container">
              <Link href="/" className="nav-logo">
                <Image src="/logo.png" alt="ZeroPass Logo" width={48} height={48} style={{ borderRadius: '6px' }} />
                <span className="heading-gradient">ZeroPass</span>
              </Link>
              <div className="nav-links">
                <Link href="/events" className="nav-link">Events</Link>
                <Link href="/my-tickets" className="nav-link">My Tickets</Link>
                <Link href="/organizer" className="nav-link">Organizer</Link>
              </div>
              <div className="nav-actions">
                <WalletConnect />
              </div>
            </div>
          </nav>
          <main className="main-content">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}

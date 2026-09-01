import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meme Radar | Solana discovery",
  description: "Research-only radar for early Solana meme coins.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

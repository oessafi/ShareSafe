import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShareSafe",
  description: "Clean your files before sharing with local-first privacy tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

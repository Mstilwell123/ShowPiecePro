import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShowPiece.Pro — Let your work speak.",
  description: "Turn contractor project photos and clips into branded, narrated videos. Your first finished video is free. Pro is $30/month.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NeuraMeter — Know what your AI agents cost",
  description: "Open-source cost attribution for AI agent systems. Per agent. Per task. Per customer. By NEURIA.",
  openGraph: {
    title: "NeuraMeter — Know what your AI agents cost",
    description: "Open-source cost attribution for AI agent systems. Per agent. Per task. Per customer.",
    url: "https://meter.neuria.tech",
    siteName: "NeuraMeter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NeuraMeter",
    description: "Know what your AI agents cost. Per agent. Per task. Per customer.",
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

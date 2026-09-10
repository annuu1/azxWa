import type { Metadata } from "next";
import "./globals.css";
import { PLATFORM_INFO } from "@/shared/config/platform";

export const metadata: Metadata = {
  title: `${PLATFORM_INFO.name} - WhatsApp CRM & Automation`,
  description: PLATFORM_INFO.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

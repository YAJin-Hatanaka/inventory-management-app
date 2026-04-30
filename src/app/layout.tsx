import type { Metadata } from "next";
import { GlobalProviders } from "@/contexts/app/global-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "在庫管理システム",
  description: "在庫数と入出庫を管理する社内向けアプリケーション",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <GlobalProviders>{children}</GlobalProviders>
      </body>
    </html>
  );
}

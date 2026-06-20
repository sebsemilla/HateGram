import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";

export const metadata: Metadata = {
  title: "feedpod",
  description: "La red social sin filtros",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-hate-dark text-white">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

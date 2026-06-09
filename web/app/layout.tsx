import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HateGram",
  description: "La red social sin filtros",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-hate-dark text-white">{children}</body>
    </html>
  );
}

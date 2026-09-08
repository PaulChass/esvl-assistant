import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assistant ESVL Basket",
  description:
    "Assistant IA non officiel pour les matchs, résultats et classements de l'ES Villeneuve-Loubet Basket, à partir des données publiques FFBB.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Barlow, Barlow_Semi_Condensed } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const body = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const display = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Assistant ESVL Basket",
  description:
    "Les matchs, résultats et classements de l'ES Villeneuve-Loubet Basket, prêts à partager. Assistant non officiel, données publiques FFBB.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}

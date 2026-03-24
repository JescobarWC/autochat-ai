import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "EAI-STUDIO Chat — Admin",
  description: "Panel de administracion de EAI-STUDIO Chat",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} font-[family-name:var(--font-display)] bg-bg-light dark:bg-bg-dark text-slate-900 dark:text-slate-100 min-h-screen`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

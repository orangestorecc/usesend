import "./globals.css";

import { Inter } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@usesend/ui";
import { Toaster } from "@usesend/ui/src/toaster";

import { TRPCReactProvider } from "~/trpc/react";
import { Metadata } from "next";
import { DateLocaleSetup } from "~/components/DateLocaleSetup";
// Aplica o locale pt-BR também no runtime do servidor.
import "~/utils/date-locale";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Madmail",
    template: "%s · Madmail",
  },
  description: "E-mail marketing que mora no seu ChatGPT.",
  icons: [
    { rel: "icon", url: "/favicon.ico?v=2" },
    { rel: "icon", type: "image/png", sizes: "32x32", url: "/brand/madmail-icon-32.png?v=2" },
    { rel: "icon", type: "image/png", sizes: "192x192", url: "/brand/madmail-icon-512.png?v=2" },
    { rel: "apple-touch-icon", url: "/brand/madmail-icon-256.png?v=2" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className="bg-sidebar-background"
    >
      <body
        className={`font-sans ${inter.variable} ${jetbrainsMono.variable} app bg-sidebar-background`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          <DateLocaleSetup />
          <Toaster />
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

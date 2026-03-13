import "~/styles/globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "~/components/ui/toaster";
import ServiceWorkerRegister from "~/components/ServiceWorkerRegister";
import React from "react";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

export const metadata = {
  title: "Copyman",
  description: "Yes",
  icons: [{ rel: "icon", url: "/favicon.png" }],
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isOffline =
    typeof window !== "undefined" && (window as any).IS_OFFLINE === true;

  return (
    <html lang="en" className="overflow-x-hidden">
      <body
        className={`relative overflow-x-hidden bg-brand font-sans ${inter.variable} antialiased`}
      >
        {React.cloneElement(children as React.ReactElement, {
          offline: isOffline,
        })}
      </body>
      <ServiceWorkerRegister />
      <Toaster />
    </html>
  );
}

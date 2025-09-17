import "~/styles/globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "~/components/ui/toaster";
import ServiceWorkerRegister from "~/components/ServiceWorkerRegister";
import React from "react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Copyman",
  description: "Yes",
  icons: [{ rel: "icon", url: "/favicon.png" }],
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
      <body className={`relative overflow-x-hidden font-sans ${inter.variable}`}>
        {React.cloneElement(children as React.ReactElement, { offline: isOffline })}
      </body>
      <ServiceWorkerRegister />
      <Toaster />
    </html>
  );
}

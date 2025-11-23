import "~/styles/globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "~/components/ui/toaster";
import ServiceWorkerRegister from "~/components/ServiceWorkerRegister";
import React from "react";
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
config.autoAddCss = false


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
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <body
        className={`bg-brand relative overflow-x-hidden font-sans ${inter.variable}`}
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

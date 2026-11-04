import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import DisableNumberWheel from "@/components/DisableNumberWheel";
import NavUser from "@/components/NavUser";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Purchase Tracker",
  description: "China sourcing purchase order tracker",
};

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/purchase-orders", label: "Purchase Orders" },
  { href: "/vendors", label: "Vendors" },
  { href: "/masters", label: "Masters" },
  { href: "/reports", label: "Reports" },
  { href: "/mrp-calculator", label: "MRP Calculator" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <SessionProviderWrapper>
          <header className="border-b bg-white">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-14 items-center gap-6">
                <span className="font-semibold text-lg">Purchase Tracker</span>
                <nav className="flex gap-4 flex-1">
                  {navLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      {l.label}
                    </Link>
                  ))}
                </nav>
                <NavUser />
              </div>
            </div>
          </header>
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
          <DisableNumberWheel />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}

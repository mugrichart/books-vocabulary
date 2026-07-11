import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PdfConditionalLayout from "@/components/PdfConditionalLayout";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LexiFlow - Books & Vocabulary Dashboard",
  description: "Track your books, vocabulary acquisition, and practice terms with an interactive smart dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="m-0 min-h-full flex flex-col bg-background text-foreground">
        <PdfConditionalLayout>{children}</PdfConditionalLayout>
      </body>
    </html>
  );
}

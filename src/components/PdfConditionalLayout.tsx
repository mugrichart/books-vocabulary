"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";

interface Props {
  children: React.ReactNode;
}

export default function PdfConditionalLayout({ children }: Props) {
  const pathname = usePathname();
  const isPdfPage = pathname?.startsWith("/books/");

  const containerClass = isPdfPage
    ? "h-screen overflow-hidden flex flex-col"
    : "min-h-full flex flex-col bg-background text-foreground";

  return (
    <div className={containerClass}>
      {!isPdfPage && <Navbar />}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}

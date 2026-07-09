"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, GraduationCap, LayoutDashboard } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Books", href: "/books", icon: BookOpen },
    { name: "Vocabulary", href: "/vocabulary", icon: Compass },
    { name: "Practice", href: "/review", icon: GraduationCap },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            LexiFlow
          </span>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 hover:bg-accent/50 ${
                  isActive
                    ? "text-primary-foreground bg-accent/80 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.name}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

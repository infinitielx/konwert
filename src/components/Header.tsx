"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/", label: "Live Status" },
  { href: "/history", label: "History" },
  { href: "/docs", label: "Docs" },
];

export default function Header() {
  const path = usePathname();
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href) || (href === "/history" && path.startsWith("/test"));

  return (
    <header className="sticky top-0 z-10 border-b-4 border-gold-500 bg-brand-800 text-white shadow dark:bg-brand-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/konwert.png"
            alt="Konwert India Motors"
            width={120}
            height={40}
            priority
            className="h-10 w-auto rounded bg-white p-1"
          />
          <span className="text-lg font-bold tracking-wide">POWER MUX PROJECT</span>
        </Link>
        <nav className="flex gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                active(l.href) ? "bg-gold-500 font-semibold text-brand-900" : "text-brand-100 hover:bg-brand-700"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

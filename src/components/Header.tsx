"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { logout } from "@/app/login/actions";

const links = [
  { href: "/", label: "Live Status" },
  { href: "/history", label: "History" },
  // /docs still works but is not linked here; open it by typing the URL.
];

export default function Header() {
  const path = usePathname();
  // The login page is a full-screen page with its own layout.
  if (path === "/login") return null;

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
            className="h-9 w-auto rounded bg-white p-1 sm:h-10"
          />
          <span className="text-base font-bold tracking-wide sm:text-lg">POWER MUX PROJECT</span>
        </Link>
        <nav className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-end">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-md px-2.5 py-2 text-[13px] font-medium transition sm:px-4 sm:text-sm ${
                active(l.href) ? "bg-gold-500 font-semibold text-brand-900" : "text-brand-100 hover:bg-brand-700"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <ThemeToggle />
          <form action={logout}>
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="ml-1 flex h-9 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium text-brand-100 transition hover:bg-brand-700"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

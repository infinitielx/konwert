import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import LoginForm from "./LoginForm";

export const metadata = { title: "SIGN IN" };
export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  // Only same-site paths are allowed as the "return to" page.
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  return (
    // Covers the whole window, so the normal page header and padding are not shown here.
    <div className="fixed inset-0 z-50 overflow-auto bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600">
      {/* soft decorative glows in the logo colours */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-gold-500/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-brand-500/30 blur-3xl" />

      <div className="absolute right-4 top-4 z-10 text-brand-100">
        <ThemeToggle />
      </div>

      <div className="relative flex min-h-full flex-col items-center justify-center p-4">
        <main className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-white/10">
          <div className="h-1.5 bg-gold-500" />
          <div className="p-8 sm:p-10">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-5 rounded-xl bg-white p-3 shadow-md ring-1 ring-line">
                <Image
                  src="/konwert.png"
                  alt="Konwert India Motors"
                  width={180}
                  height={92}
                  priority
                  className="h-auto w-44"
                />
              </div>
              <h1 className="text-2xl font-bold tracking-wide text-heading">POWER MUX PROJECT</h1>
              <p className="mt-1 text-sm text-muted">Sign in to view test results and reports</p>
            </div>

            <LoginForm next={next} />
          </div>
        </main>

        <p className="mt-6 text-center text-xs text-brand-100/80">
          &copy; {new Date().getFullYear()} Konwert India Motors Pvt. Ltd.
        </p>
      </div>
    </div>
  );
}

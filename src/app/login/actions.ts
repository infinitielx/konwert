"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authConfigured,
  checkCredentials,
  createSessionToken,
} from "@/lib/auth";

export type LoginState = { error: string };

/** Only allow redirects to a page on this site (blocks //evil.com style links). */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!authConfigured()) {
    return { error: "Login is not set up on the server. Set the AUTH_ variables and restart." };
  }

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!(await checkCredentials(username, password))) {
    // A short delay slows down password guessing.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { error: "Incorrect username or password." };
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(username), {
    httpOnly: true, // not readable from page scripts
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

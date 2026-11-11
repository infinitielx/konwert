import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

/** The signed-in username, or null. */
export async function getUser() {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * Call at the top of every protected page. The proxy already blocks signed-out
 * visitors; this is a second check so the pages stay safe on their own.
 */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

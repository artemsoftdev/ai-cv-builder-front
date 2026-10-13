import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { authPageHref, safeNextPath, SIGNUP_PATH } from "@/lib/auth/paths";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);

  return (
    <FadeIn>
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <CardDescription>Log in to continue working on your CVs.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={nextPath} />
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-sm text-fg-muted">
        New here?{" "}
        <Link href={authPageHref(SIGNUP_PATH, nextPath)} className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </FadeIn>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { SignupForm } from "@/components/auth/signup-form";
import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { authPageHref, LOGIN_PATH, safeNextPath } from "@/lib/auth/paths";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);

  return (
    <FadeIn>
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
          <CardDescription>Turn your existing CV into a focused draft for the role you want.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm next={nextPath} />
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-sm text-fg-muted">
        Already have an account?{" "}
        <Link href={authPageHref(LOGIN_PATH, nextPath)} className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </FadeIn>
  );
}

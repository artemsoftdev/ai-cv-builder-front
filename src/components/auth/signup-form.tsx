"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { API_LIMITS } from "@/lib/api/types";
import { isApiError } from "@/lib/api/errors";
import { authPageHref, LOGIN_PATH } from "@/lib/auth/paths";
import { applyServerError } from "@/lib/forms/apply-server-error";
import { useSignup } from "@/lib/query/auth-hooks";
import { signupSchema, type SignupValues } from "@/lib/validation/auth";

const EMAIL_TAKEN = "email_taken";

type SignupFormProps = {
  /** Already sanitised redirect target (see `safeNextPath`). */
  next: string;
};

export function SignupForm({ next }: SignupFormProps) {
  const router = useRouter();
  const signup = useSignup();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      await signup.mutateAsync({ email, password });
      router.replace(next);
    } catch (error) {
      if (isApiError(error, "EMAIL_TAKEN")) {
        setError("email", { type: EMAIL_TAKEN, message: "An account with this email already exists." });
        setFocus("email");
        return;
      }
      applyServerError(error, setError, ["email", "password"]);
    }
  });

  const busy = isSubmitting || signup.isSuccess;
  const emailTaken = errors.email?.type === EMAIL_TAKEN;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {errors.root?.server?.message && <Alert tone="danger">{errors.root.server.message}</Alert>}

      <Field label="Email" error={errors.email?.message}>
        {(control) => (
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            {...control}
            {...register("email")}
          />
        )}
      </Field>
      {emailTaken && (
        <p className="-mt-3 text-sm">
          <Link href={authPageHref(LOGIN_PATH, next)} className="font-medium text-primary hover:underline">
            Log in instead
          </Link>
        </p>
      )}

      <Field
        label="Password"
        error={errors.password?.message}
        hint={`At least ${API_LIMITS.password.min} characters.`}
      >
        {(control) => <PasswordInput autoComplete="new-password" {...control} {...register("password")} />}
      </Field>

      <Field label="Repeat password" error={errors.confirmPassword?.message}>
        {(control) => <PasswordInput autoComplete="new-password" {...control} {...register("confirmPassword")} />}
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Create account
      </Button>
    </form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { isApiError } from "@/lib/api/errors";
import { applyServerError, SERVER_ERROR } from "@/lib/forms/apply-server-error";
import { useLogin } from "@/lib/query/auth-hooks";
import { loginSchema, type LoginValues } from "@/lib/validation/auth";

type LoginFormProps = {
  /** Already sanitised redirect target (see `safeNextPath`). */
  next: string;
};

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      router.replace(next);
    } catch (error) {
      if (isApiError(error, "INVALID_CREDENTIALS")) {
        // Deliberately vague: don't reveal whether the email has an account.
        setError(SERVER_ERROR, { type: "server", message: "Incorrect email or password." });
        setFocus("password");
        return;
      }
      applyServerError(error, setError, ["email", "password"]);
    }
  });

  // Stay busy while navigating away after a successful login.
  const busy = isSubmitting || login.isSuccess;

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

      <Field label="Password" error={errors.password?.message}>
        {(control) => <PasswordInput autoComplete="current-password" {...control} {...register("password")} />}
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Log in
      </Button>
    </form>
  );
}

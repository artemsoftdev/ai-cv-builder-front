import { z } from "zod";

import { API_LIMITS } from "@/lib/api/types";

const { min: PASSWORD_MIN, max: PASSWORD_MAX } = API_LIMITS.password;

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .max(254, "That email address is too long")
  .pipe(z.email("Enter a valid email address"));

const password = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`);

export const loginSchema = z.object({ email, password });

export const signupSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string().min(1, "Repeat your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    error: "Passwords don't match",
  });

export type LoginValues = z.input<typeof loginSchema>;
export type SignupValues = z.input<typeof signupSchema>;

import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(256),
});

export type AuthActionState = {
  error?: string;
  message?: string;
};

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const localAdminSignIn = createServerFn({ method: "POST" })
  .validator(z.object({ username: z.string(), password: z.string() }))
  .handler(async ({ data }) => {
    const adminUser = process.env.ADMIN_USERNAME ?? "naeem";
    const adminPass = process.env.ADMIN_PASSWORD;
    if (!adminPass) return { ok: false as const };
    if (data.username.trim() !== adminUser || data.password !== adminPass) {
      return { ok: false as const };
    }
    return { ok: true as const };
  });

import type { CookieOptions } from "express";
import { env } from "./env";

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
};

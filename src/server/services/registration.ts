import { randomInt } from "node:crypto";
import { env } from "~/server/env";

/** With ALLOW_REGISTRATION=true teachers may register without an invitation code. */
export function isOpenRegistration(): boolean {
  return env.ALLOW_REGISTRATION === "true";
}

// No 0/O, 1/I/L, so codes survive being read aloud or copied by hand.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Generates a code like `EDU-7KQ4-M9XC`. */
export function generateRegistrationCode(): string {
  const block = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `EDU-${block()}-${block()}`;
}

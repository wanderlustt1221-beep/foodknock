// src/lib/auth.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
) {
  return bcrypt.compare(password, hashedPassword);
}

export function signToken(payload: {
  userId: string;
  email: string;
  role: string;
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET);
}

// ── Password-reset token (separate from session JWT) ───────────────────────
// Uses a distinct secret (RESET_TOKEN_SECRET) and a "purpose" claim so a
// leaked/expired reset token can never be replayed as a session token, and
// an existing session token can never be replayed as a reset token. Kept in
// this file alongside signToken/verifyToken since both are JWT helpers, but
// added as new exports only — nothing above this line is modified.
const RESET_TOKEN_SECRET = process.env.RESET_TOKEN_SECRET!;

export function signResetToken(payload: { userId: string; purpose: "password-reset" }) {
  return jwt.sign(payload, RESET_TOKEN_SECRET, { expiresIn: "10m" });
}

export function verifyResetToken(token: string) {
  const decoded = jwt.verify(token, RESET_TOKEN_SECRET) as {
    userId: string;
    purpose: string;
  };
  if (decoded.purpose !== "password-reset") {
    throw new Error("Invalid token purpose");
  }
  return decoded;
}
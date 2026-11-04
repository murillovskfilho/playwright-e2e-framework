import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Role } from './seed';

export interface Session {
  email: string;
  name: string;
  role: Role;
  tenant: string;
  exp: number; // epoch seconds
}

// Local demo app: a fixed fallback secret is fine; set APP_SECRET to override.
const SECRET = process.env.APP_SECRET ?? 'local-demo-secret';
const TTL_SECONDS = 60 * 60 * 8;

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (data: string) => createHmac('sha256', SECRET).update(data).digest('base64url');

export function issueToken(user: Omit<Session, 'exp'>): string {
  const payload = b64(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS }));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
    return session.exp > Date.now() / 1000 ? session : null;
  } catch {
    return null;
  }
}

export const PERMISSIONS = {
  createShipment: ['admin', 'operator'],
  cancelShipment: ['admin'],
} as const satisfies Record<string, readonly Role[]>;

export const can = (role: Role, action: keyof typeof PERMISSIONS) =>
  (PERMISSIONS[action] as readonly Role[]).includes(role);

import { join } from 'node:path';
import { DEMO_PASSWORD, USERS, type Role } from '../../app/src/seed';

/** The people our tests act as. Credentials come from the demo app's own seed file. */
export const PERSONAS = {
  admin: 'admin@acme.test',
  operator: 'operator@acme.test',
  viewer: 'viewer@acme.test',
  globexOperator: 'operator@globex.test',
} as const;

export type Persona = keyof typeof PERSONAS;
export const LOCKED_EMAIL = 'locked@acme.test';
export const PASSWORD = DEMO_PASSWORD;

export function personaUser(persona: Persona): { email: string; name: string; role: Role; tenant: string } {
  const user = USERS.find((u) => u.email === PERSONAS[persona]);
  if (!user) throw new Error(`No seed user for persona ${persona}`);
  return user;
}

/** Where the setup project stores each persona's signed-in browser state. */
export const authFile = (persona: Persona) => join(__dirname, '..', '.auth', `${persona}.json`);

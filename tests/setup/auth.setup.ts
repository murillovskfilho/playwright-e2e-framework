import { expect, test as setup } from '@playwright/test';
import { authFile, PASSWORD, PERSONAS, type Persona } from '../data/personas';

/**
 * Signs every persona in once, through the API, and saves the session cookie.
 * UI tests start already authenticated: faster, and login itself is covered by auth.spec.ts.
 */
for (const persona of Object.keys(PERSONAS) as Persona[]) {
  setup(`authenticate as ${persona}`, async ({ playwright, baseURL }) => {
    const context = await playwright.request.newContext({ baseURL });
    const res = await context.post('/api/auth/login', { data: { email: PERSONAS[persona], password: PASSWORD } });
    expect(res.status(), await res.text()).toBe(200);
    await context.storageState({ path: authFile(persona) });
    await context.dispose();
  });
}

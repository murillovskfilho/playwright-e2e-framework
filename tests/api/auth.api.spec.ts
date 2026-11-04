import { LOCKED_EMAIL, PASSWORD, PERSONAS, personaUser } from '../data/personas';
import { expect, test } from '../fixtures';
import { errorSchema, expectSchema } from './schemas';

test.use({ persona: 'anonymous' });

test.describe('Auth API', () => {
  test('issues a token and an HttpOnly session cookie', async ({ api }) => {
    const res = await api.login(PERSONAS.admin, PASSWORD);

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual(personaUser('admin'));
    expect(body.token).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(res.headers()['set-cookie']).toMatch(/session=.+; HttpOnly; Path=\/; SameSite=Lax/);
  });

  test('accepts the bearer token on protected endpoints', async ({ api }) => {
    const { token } = await (await api.login(PERSONAS.viewer, PASSWORD)).json();

    const res = await api.request.get('/api/me', { headers: { authorization: `Bearer ${token}` } });

    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({
      user: { role: 'viewer', tenant: 'acme' },
      permissions: { createShipment: false, cancelShipment: false },
    });
  });

  for (const [name, headers] of [
    ['no credentials', {}],
    ['a malformed token', { authorization: 'Bearer not-a-token' }],
    ['a tampered token', { authorization: 'Bearer eyJyb2xlIjoiYWRtaW4ifQ.forged-signature' }],
  ] as const) {
    test(`rejects ${name} with 401`, async ({ api }) => {
      const res = await api.request.get('/api/shipments', { headers });

      expect(res.status()).toBe(401);
      expectSchema(await res.json(), errorSchema);
    });
  }

  test('rejects a token whose payload was edited to escalate the role', async ({ api }) => {
    const { token } = await (await api.login(PERSONAS.viewer, PASSWORD)).json();
    const [payload, signature] = token.split('.');
    const escalated = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), role: 'admin' }),
    ).toString('base64url');

    const res = await api.request.get('/api/me', { headers: { authorization: `Bearer ${escalated}.${signature}` } });

    expect(res.status()).toBe(401);
  });

  const failures = [
    { name: 'missing password', data: { email: PERSONAS.admin }, status: 400 },
    { name: 'wrong password', data: { email: PERSONAS.admin, password: 'nope' }, status: 401 },
    { name: 'unknown user', data: { email: 'ghost@acme.test', password: PASSWORD }, status: 401 },
    { name: 'locked user', data: { email: LOCKED_EMAIL, password: PASSWORD }, status: 423 },
  ];
  for (const { name, data, status } of failures) {
    test(`login fails with ${status} for ${name}`, async ({ api }) => {
      const res = await api.request.post('/api/auth/login', { data });

      expect(res.status()).toBe(status);
      expectSchema(await res.json(), errorSchema);
      expect(res.headers()['set-cookie']).toBeUndefined();
    });
  }

  test('does not reveal whether an email exists', async ({ api }) => {
    const known = await (await api.login(PERSONAS.admin, 'wrong')).json();
    const unknown = await (await api.login('ghost@acme.test', 'wrong')).json();

    expect(known).toEqual(unknown);
  });
});

import express, { type NextFunction, type Request, type Response } from 'express';
import { join } from 'node:path';
import { can, issueToken, verifyToken, type Session } from './auth';
import { CARRIERS, DEMO_PASSWORD, SERVICE_LEVELS, STATUSES, USERS, seedShipments, type Shipment } from './seed';

/**
 * "ShipDesk": a small multi-tenant shipment portal that exists only to be tested.
 * In-memory store, deterministic seed, HMAC-signed session tokens, role-based permissions.
 */
const shipments: Shipment[] = seedShipments();
let nextId = 5000;

const app = express();
app.use(express.json({ limit: '100kb' }));

type AuthedRequest = Request & { session: Session };

function readToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = req.headers.cookie
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('session='));
  return cookie?.slice('session='.length);
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = verifyToken(readToken(req));
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  (req as AuthedRequest).session = session;
  next();
}

const view = (s: Shipment) => {
  const { tenant: _tenant, ...rest } = s;
  return rest;
};

// Shipments of other tenants are reported as "not found", never "forbidden": no existence leak.
const findOwn = (session: Session, id: string) => shipments.find((s) => s.id === id && s.tenant === session.tenant);

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  const user = USERS.find((u) => u.email === email.trim().toLowerCase());
  if (!user || password !== DEMO_PASSWORD) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  if (user.locked) {
    res.status(423).json({ error: 'This account is locked. Contact your administrator.' });
    return;
  }
  const { locked: _locked, ...profile } = user;
  const token = issueToken(profile);
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; SameSite=Lax`);
  res.json({ token, user: profile });
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  res.status(204).end();
});

app.get('/api/me', requireAuth, (req, res) => {
  const { exp: _exp, ...user } = (req as AuthedRequest).session;
  res.json({
    user,
    permissions: { createShipment: can(user.role, 'createShipment'), cancelShipment: can(user.role, 'cancelShipment') },
  });
});

app.get('/api/shipments', requireAuth, (req, res) => {
  const { session } = req as AuthedRequest;
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '');
  const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 10, 1), 50);

  const matching = shipments
    .filter((s) => s.tenant === session.tenant)
    .filter((s) => !status || s.status === status)
    .filter(
      (s) =>
        !q || [s.id, s.reference, s.recipientName, s.destinationZip].some((field) => field.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
  res.json({
    items: matching.slice((page - 1) * pageSize, page * pageSize).map(view),
    page,
    pageSize,
    total: matching.length,
    totalPages,
  });
});

app.get('/api/shipments/:id', requireAuth, (req, res) => {
  const shipment = findOwn((req as AuthedRequest).session, req.params.id);
  if (!shipment) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }
  res.json(view(shipment));
});

function validate(body: Record<string, unknown>, tenant: string): Record<string, string> {
  const errors: Record<string, string> = {};
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (!reference) errors.reference = 'Reference is required';
  else if (!/^[A-Za-z0-9-]{3,40}$/.test(reference)) errors.reference = 'Use 3-40 letters, digits or dashes';
  else if (shipments.some((s) => s.tenant === tenant && s.reference.toLowerCase() === reference.toLowerCase())) {
    errors.reference = 'Reference already exists';
  }
  if (!(CARRIERS as readonly unknown[]).includes(body.carrier)) errors.carrier = 'Choose a carrier';
  if (!(SERVICE_LEVELS as readonly unknown[]).includes(body.serviceLevel)) errors.serviceLevel = 'Choose a service level';
  if (typeof body.recipientName !== 'string' || body.recipientName.trim().length < 2) {
    errors.recipientName = 'Recipient name is required';
  }
  if (typeof body.destinationZip !== 'string' || !/^\d{5}$/.test(body.destinationZip)) {
    errors.destinationZip = 'ZIP must be 5 digits';
  }
  const weight = Number(body.weightOz);
  if (body.weightOz === '' || body.weightOz == null || !Number.isFinite(weight) || weight < 0.1 || weight > 2400) {
    errors.weightOz = 'Weight must be between 0.1 and 2400 oz';
  }
  return errors;
}

app.post('/api/shipments', requireAuth, (req, res) => {
  const { session } = req as AuthedRequest;
  if (!can(session.role, 'createShipment')) {
    res.status(403).json({ error: 'You do not have permission to create shipments' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const errors = validate(body, session.tenant);
  if (Object.keys(errors).length > 0) {
    res.status(422).json({ error: 'Validation failed', errors });
    return;
  }
  const shipment: Shipment = {
    id: `SHP-${nextId++}`,
    tenant: session.tenant,
    reference: String(body.reference).trim(),
    carrier: body.carrier as Shipment['carrier'],
    serviceLevel: body.serviceLevel as Shipment['serviceLevel'],
    recipientName: String(body.recipientName).trim(),
    destinationZip: String(body.destinationZip),
    weightOz: Math.round(Number(body.weightOz) * 10) / 10,
    status: 'LABEL_CREATED',
    createdAt: new Date().toISOString(),
    createdBy: session.email,
  };
  shipments.push(shipment);
  res.status(201).json(view(shipment));
});

app.post('/api/shipments/:id/cancel', requireAuth, (req, res) => {
  const { session } = req as AuthedRequest;
  const shipment = findOwn(session, req.params.id);
  if (!shipment) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }
  if (!can(session.role, 'cancelShipment')) {
    res.status(403).json({ error: 'You do not have permission to cancel shipments' });
    return;
  }
  if (shipment.status !== 'LABEL_CREATED') {
    res.status(409).json({ error: `A shipment in status ${shipment.status} cannot be cancelled` });
    return;
  }
  shipment.status = 'CANCELLED';
  res.json(view(shipment));
});

app.get('/api/meta', (_req, res) => {
  res.json({ carriers: CARRIERS, serviceLevels: SERVICE_LEVELS, statuses: STATUSES });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(express.static(join(__dirname, '..', 'public'), { extensions: ['html'] }));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`ShipDesk listening on http://localhost:${port}`));

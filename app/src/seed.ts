export type Role = 'admin' | 'operator' | 'viewer';
export type Status = 'LABEL_CREATED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export const CARRIERS = ['UPS', 'FEDEX', 'USPS', 'DHL'] as const;
export const SERVICE_LEVELS = ['GROUND', '2DAY', 'OVERNIGHT'] as const;
export const STATUSES: Status[] = ['LABEL_CREATED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];

export interface User {
  email: string;
  name: string;
  role: Role;
  tenant: string;
  locked?: boolean;
}

export interface Shipment {
  id: string;
  tenant: string;
  reference: string;
  carrier: (typeof CARRIERS)[number];
  serviceLevel: (typeof SERVICE_LEVELS)[number];
  recipientName: string;
  destinationZip: string;
  weightOz: number;
  status: Status;
  createdAt: string;
  createdBy: string;
}

/** Demo-only credentials for this local, throwaway app. Shared with the test suite. */
export const DEMO_PASSWORD = 'Demo-Passw0rd!';

export const USERS: User[] = [
  { email: 'admin@acme.test', name: 'Ada Admin', role: 'admin', tenant: 'acme' },
  { email: 'operator@acme.test', name: 'Otto Operator', role: 'operator', tenant: 'acme' },
  { email: 'viewer@acme.test', name: 'Vera Viewer', role: 'viewer', tenant: 'acme' },
  { email: 'operator@globex.test', name: 'Gus Globex', role: 'operator', tenant: 'globex' },
  { email: 'locked@acme.test', name: 'Lou Locked', role: 'operator', tenant: 'acme', locked: true },
];

/** Deterministic starting data: 30 shipments per tenant. */
export function seedShipments(): Shipment[] {
  const names = ['Alice Moore', 'Bruno Silva', 'Chen Wei', 'Dana Scott', 'Eli Cohen', 'Fatima Khan'];
  const out: Shipment[] = [];
  let n = 1000;
  for (const tenant of ['acme', 'globex']) {
    for (let i = 0; i < 30; i++) {
      n++;
      out.push({
        id: `SHP-${n}`,
        tenant,
        reference: `${tenant.toUpperCase()}-PO-${String(i + 1).padStart(4, '0')}`,
        carrier: CARRIERS[i % CARRIERS.length],
        serviceLevel: SERVICE_LEVELS[i % SERVICE_LEVELS.length],
        recipientName: names[i % names.length],
        destinationZip: String(10001 + i * 37).padStart(5, '0'),
        weightOz: 8 + ((i * 13) % 150),
        status: STATUSES[i % 3], // seeds never start cancelled
        createdAt: new Date(Date.UTC(2026, 0, 1 + i, 12)).toISOString(),
        createdBy: 'seed',
      });
    }
  }
  return out;
}

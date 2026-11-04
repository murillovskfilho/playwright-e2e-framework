import { randomBytes } from 'node:crypto';
import { buildShipment } from '../data/factories';
import { expect, test } from '../fixtures';
import { errorSchema, expectSchema, shipmentPageSchema, shipmentSchema } from './schemas';

test.describe('Shipments API', () => {
  test.describe('contract', () => {
    test('list matches the schema and never exposes the tenant', async ({ api }) => {
      const res = await api.listShipments({ pageSize: 50 });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expectSchema(body, shipmentPageSchema);
      expect(body.items.length).toBeGreaterThan(0);
    });

    test('created shipment matches the schema and echoes the input', async ({ api }) => {
      const input = buildShipment({ weightOz: 10.25 });

      const res = await api.createShipment(input);

      expect(res.status()).toBe(201);
      const body = await res.json();
      expectSchema(body, shipmentSchema);
      expect(body).toMatchObject({ ...input, weightOz: 10.3, status: 'LABEL_CREATED', createdBy: 'operator@acme.test' });
      expect(Date.now() - Date.parse(body.createdAt)).toBeLessThan(60_000);
    });
  });

  test.describe('validation', () => {
    test('returns every field error with 422', async ({ api }) => {
      const res = await api.createShipment({});

      expect(res.status()).toBe(422);
      const body = await res.json();
      expectSchema(body, errorSchema);
      expect(body.errors).toEqual({
        reference: 'Reference is required',
        carrier: 'Choose a carrier',
        serviceLevel: 'Choose a service level',
        recipientName: 'Recipient name is required',
        destinationZip: 'ZIP must be 5 digits',
        weightOz: 'Weight must be between 0.1 and 2400 oz',
      });
    });

    // Boundary values for weight: 0.1 and 2400 are the inclusive limits.
    for (const [weight, ok] of [[0.09, false], [0.1, true], [2400, true], [2400.01, false], [-1, false]] as const) {
      test(`weight ${weight} is ${ok ? 'accepted' : 'rejected'}`, async ({ api }) => {
        const res = await api.createShipment(buildShipment({ weightOz: weight }));
        expect(res.status()).toBe(ok ? 201 : 422);
      });
    }

    for (const [reference, ok] of [['AB', false], ['ABC', true], ['A'.repeat(40), true], ['A'.repeat(41), false]] as const) {
      test(`reference of length ${reference.length} is ${ok ? 'accepted' : 'rejected'}`, async ({ api }) => {
        // Make valid references unique per run without changing their length.
        const unique = ok ? randomBytes(32).toString('hex').slice(0, reference.length).toUpperCase() : reference;
        const res = await api.createShipment(buildShipment({ reference: unique }));
        expect(res.status(), await res.text()).toBe(ok ? 201 : 422);
      });
    }

    test('treats references as case-insensitive duplicates', async ({ api }) => {
      const first = await api.createShipmentOk(buildShipment());

      const res = await api.createShipment(buildShipment({ reference: first.reference.toLowerCase() }));

      expect(res.status()).toBe(422);
      expect((await res.json()).errors).toEqual({ reference: 'Reference already exists' });
    });
  });

  test.describe('listing', () => {
    test('clamps page size and page number', async ({ api }) => {
      const big = await (await api.listShipments({ pageSize: 500 })).json();
      expect(big.pageSize).toBe(50);

      const beyond = await (await api.listShipments({ q: 'ACME-PO', page: 999 })).json();
      expect(beyond).toMatchObject({ page: 3, totalPages: 3, total: 30 });
      expect(beyond.items).toHaveLength(10);
    });

    test('returns the newest shipments first', async ({ api }) => {
      const created = await api.createShipmentOk(buildShipment());

      const { items } = await (await api.listShipments()).json();

      const dates = items.map((s: { createdAt: string }) => s.createdAt);
      expect(dates).toEqual([...dates].sort().reverse());
      expect(items.map((s: { id: string }) => s.id)).toContain(created.id);
    });

    test('searches by id, reference, recipient and ZIP', async ({ api }) => {
      const s = await api.createShipmentOk(buildShipment({ recipientName: 'Margaret Hamilton', destinationZip: '02139' }));

      for (const q of [s.id, s.reference.toLowerCase(), 'margaret hamilton']) {
        const { items } = await (await api.listShipments({ q })).json();
        expect(items.map((i: { id: string }) => i.id), `q=${q}`).toContain(s.id);
      }
    });
  });

  test.describe('cancellation', () => {
    test.use({ persona: 'admin' });

    test('moves LABEL_CREATED to CANCELLED, then refuses with 409', async ({ api }) => {
      const s = await api.createShipmentOk(buildShipment());

      const first = await api.cancelShipment(s.id);
      expect(first.status()).toBe(200);
      expect((await first.json()).status).toBe('CANCELLED');

      const second = await api.cancelShipment(s.id);
      expect(second.status()).toBe(409);
      expect(await second.json()).toEqual({ error: 'A shipment in status CANCELLED cannot be cancelled' });
    });

    test('returns 404 for an unknown shipment', async ({ api }) => {
      expect((await api.cancelShipment('SHP-0')).status()).toBe(404);
    });
  });

  test('returns JSON 404 for unknown API routes', async ({ api }) => {
    const res = await api.request.get('/api/does-not-exist');
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});

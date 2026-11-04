import { buildShipment } from '../data/factories';
import { expect, test } from '../fixtures';

test.use({ persona: 'globexOperator' });

test.describe('Tenant isolation', () => {
  test("never lists another tenant's shipments", async ({ apiAs, shipmentsPage }) => {
    const acmeShipment = await (await apiAs('operator')).createShipmentOk(buildShipment());

    await shipmentsPage.goto();
    await expect(shipmentsPage.currentUser).toHaveText('Gus Globex');

    for (const term of [acmeShipment.reference, acmeShipment.id, 'ACME-PO']) {
      await shipmentsPage.searchFor(term);
      await expect(shipmentsPage.emptyState, `search "${term}" leaked data`).toBeVisible();
    }
  });

  test('treats a direct link to another tenant as not found', async ({ api, apiAs, shipmentPage }) => {
    const acmeShipment = await (await apiAs('operator')).createShipmentOk(buildShipment());

    await shipmentPage.goto(acmeShipment.id);

    await expect(shipmentPage.heading).toHaveText('Shipment not found');
    await expect(shipmentPage.page.getByText(acmeShipment.reference)).toHaveCount(0);
    // 404 rather than 403: the API must not even confirm the shipment exists.
    expect((await api.getShipment(acmeShipment.id)).status()).toBe(404);
    expect((await api.cancelShipment(acmeShipment.id)).status()).toBe(404);
  });

  test('allows the same reference in different tenants', async ({ api, apiAs }) => {
    const acme = await (await apiAs('operator')).createShipmentOk(buildShipment());

    const res = await api.createShipment(buildShipment({ reference: acme.reference }));

    expect(res.status()).toBe(201);
  });
});

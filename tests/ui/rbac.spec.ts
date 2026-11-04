import { buildShipment } from '../data/factories';
import { expect, test } from '../fixtures';

/**
 * Role-based access as a data-driven matrix: one row per role, the same assertions for each.
 * Every capability is checked twice: in the UI (what is offered) and in the API (what is enforced).
 */
const MATRIX = [
  { persona: 'admin', canCreate: true, canCancel: true },
  { persona: 'operator', canCreate: true, canCancel: false },
  { persona: 'viewer', canCreate: false, canCancel: false },
] as const;

for (const { persona, canCreate, canCancel } of MATRIX) {
  test.describe(`Permissions for ${persona}`, () => {
    test.use({ persona });

    test(`shows the ${persona} role`, async ({ shipmentsPage }) => {
      await shipmentsPage.goto();
      await expect(shipmentsPage.currentRole).toHaveText(persona);
    });

    test(`${canCreate ? 'can' : 'cannot'} create shipments`, async ({ api, shipmentsPage, newShipmentPage }) => {
      await shipmentsPage.goto();
      await expect(shipmentsPage.newShipment).toBeVisible({ visible: canCreate });

      await newShipmentPage.goto();
      await expect(newShipmentPage.submit).toBeVisible({ visible: canCreate });
      await expect(newShipmentPage.forbidden).toBeVisible({ visible: !canCreate });

      const res = await api.createShipment(buildShipment());
      expect(res.status()).toBe(canCreate ? 201 : 403);
    });

    test(`${canCancel ? 'can' : 'cannot'} cancel shipments`, async ({ api, apiAs, shipmentPage }) => {
      const shipment = await (await apiAs('admin')).createShipmentOk(buildShipment());

      await shipmentPage.goto(shipment.id);
      await expect(shipmentPage.detail('Status')).toHaveText('Label created');
      await expect(shipmentPage.cancel).toBeVisible({ visible: canCancel });

      // Hiding a button is not security: the API must refuse on its own.
      const res = await api.cancelShipment(shipment.id);
      expect(res.status()).toBe(canCancel ? 200 : 403);
    });
  });
}

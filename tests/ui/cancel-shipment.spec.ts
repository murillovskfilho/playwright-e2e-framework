import { buildShipment } from '../data/factories';
import { expect, test } from '../fixtures';

test.use({ persona: 'admin' });

test.describe('Cancel shipment', () => {
  test('cancels after the user confirms', async ({ page, api, shipmentPage }) => {
    const shipment = await api.createShipmentOk(buildShipment());
    await shipmentPage.goto(shipment.id);

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toBe(`Cancel shipment ${shipment.id}? This cannot be undone.`);
      await dialog.accept();
    });
    await shipmentPage.cancel.click();

    await expect(shipmentPage.notice).toHaveText('Shipment cancelled.');
    await expect(shipmentPage.detail('Status')).toHaveText('Cancelled');
    await expect(shipmentPage.cancel).toBeHidden();
    expect((await (await api.getShipment(shipment.id)).json()).status).toBe('CANCELLED');
  });

  test('keeps the shipment when the user dismisses the confirmation', async ({ page, api, shipmentPage }) => {
    const shipment = await api.createShipmentOk(buildShipment());
    await shipmentPage.goto(shipment.id);

    page.once('dialog', (dialog) => dialog.dismiss());
    await shipmentPage.cancel.click();

    await expect(shipmentPage.detail('Status')).toHaveText('Label created');
    await expect(shipmentPage.cancel).toBeVisible();
    expect((await (await api.getShipment(shipment.id)).json()).status).toBe('LABEL_CREATED');
  });

  test('is not offered once the shipment is in transit', async ({ shipmentPage }) => {
    await shipmentPage.goto('SHP-1002'); // seeded, in transit

    await expect(shipmentPage.detail('Status')).toHaveText('In transit');
    await expect(shipmentPage.cancel).toBeHidden();
  });

  test('explains the conflict when someone else cancelled it first', async ({ page, api, shipmentPage }) => {
    const shipment = await api.createShipmentOk(buildShipment());
    await shipmentPage.goto(shipment.id);
    await expect(shipmentPage.cancel).toBeVisible();

    await api.cancelShipmentOk(shipment.id); // a colleague, in another tab

    page.once('dialog', (dialog) => dialog.accept());
    await shipmentPage.cancel.click();

    await expect(shipmentPage.error).toHaveText('A shipment in status CANCELLED cannot be cancelled');
  });
});

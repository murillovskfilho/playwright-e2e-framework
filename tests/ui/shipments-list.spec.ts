import { buildShipment } from '../data/factories';
import { expect, test } from '../fixtures';

test.describe('Shipments list', () => {
  test('finds a shipment created through the API by its reference', async ({ page, api, shipmentsPage }) => {
    // Arrange through the API (fast, precise), assert through the UI (what the user sees).
    const input = buildShipment({ carrier: 'DHL', recipientName: 'Katherine Johnson' });
    const shipment = await api.createShipmentOk(input);

    await shipmentsPage.goto();
    await shipmentsPage.searchFor(input.reference);

    await expect(shipmentsPage.rows).toHaveCount(1);
    await expect(shipmentsPage.row(input.reference).getByRole('cell')).toHaveText([
      shipment.id,
      input.reference,
      'Katherine Johnson',
      'DHL',
      'Label created',
      /^\d{4}-\d{2}-\d{2}$/,
    ]);
    await expect(shipmentsPage.summary).toHaveText('1 shipment');
    await expect(page).toHaveURL(new RegExp(`q=${input.reference}`));
  });

  test('filters by status', async ({ shipmentsPage }) => {
    await shipmentsPage.goto();

    await shipmentsPage.status.selectOption({ label: 'Delivered' });

    await expect(shipmentsPage.page).toHaveURL(/status=DELIVERED/);
    // Poll: the previous (unfiltered) rows stay on screen until the new response renders.
    await expect.poll(async () => new Set(await shipmentsPage.columnValues('Status'))).toEqual(new Set(['Delivered']));
  });

  test('restores filters from a deep link', async ({ shipmentsPage }) => {
    await shipmentsPage.goto({ status: 'IN_TRANSIT', q: 'ACME-PO' });

    await expect(shipmentsPage.status).toHaveValue('IN_TRANSIT');
    await expect(shipmentsPage.search).toHaveValue('ACME-PO');
    await expect(shipmentsPage.rows.first()).toBeVisible();
    for (const status of await shipmentsPage.columnValues('Status')) expect(status).toBe('In transit');
  });

  test('shows an empty state when nothing matches', async ({ shipmentsPage }) => {
    await shipmentsPage.goto();

    await shipmentsPage.searchFor('NO-SUCH-REFERENCE-XYZ');

    await expect(shipmentsPage.emptyState).toBeVisible();
    await expect(shipmentsPage.table).toBeHidden();
    await expect(shipmentsPage.next).toBeHidden();
  });

  test('paginates through results', async ({ shipmentsPage }) => {
    await shipmentsPage.goto({ q: 'ACME-PO' }); // the 30 seeded shipments: exactly 3 pages

    await expect(shipmentsPage.pageInfo).toHaveText('Page 1 of 3');
    await expect(shipmentsPage.previous).toBeDisabled();
    const firstPage = await shipmentsPage.columnValues('ID');
    expect(firstPage).toHaveLength(10);

    await shipmentsPage.next.click();
    await expect(shipmentsPage.pageInfo).toHaveText('Page 2 of 3');
    await expect.poll(() => shipmentsPage.columnValues('ID')).not.toEqual(firstPage);

    await shipmentsPage.next.click();
    await expect(shipmentsPage.pageInfo).toHaveText('Page 3 of 3');
    await expect(shipmentsPage.next).toBeDisabled();
  });

  test('opens the shipment detail from the list', async ({ page, api, shipmentsPage, shipmentPage }) => {
    const shipment = await api.createShipmentOk(buildShipment());
    await shipmentsPage.goto({ q: shipment.reference });

    await shipmentsPage.openShipment(shipment.id);

    await expect(page).toHaveURL(`/shipment?id=${shipment.id}`);
    await expect(shipmentPage.heading).toHaveText(`Shipment ${shipment.id}`);
    await expect(shipmentPage.detail('Reference')).toHaveText(shipment.reference);
  });
});

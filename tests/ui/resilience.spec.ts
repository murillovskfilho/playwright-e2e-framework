import { buildShipment } from '../data/factories';
import { expect, test } from '../fixtures';

const LIST = '**/api/shipments?*';

/** Network-level tests: failures and timing are forced with page.route, not hoped for. */
test.describe('Resilience of the shipments list', () => {
  test('shows an error and recovers on retry after a server failure', async ({ page, shipmentsPage }) => {
    await page.route(LIST, (route) => route.fulfill({ status: 500, json: { error: 'boom' } }), { times: 1 });

    await shipmentsPage.goto();

    await expect(shipmentsPage.loadError).toBeVisible();
    await expect(shipmentsPage.table).toBeHidden();

    await shipmentsPage.retry.click();

    await expect(shipmentsPage.loadError).toBeHidden();
    await expect(shipmentsPage.rows.first()).toBeVisible();
  });

  test('shows an error when the network drops', async ({ page, shipmentsPage }) => {
    await page.route(LIST, (route) => route.abort('internetdisconnected'));

    await shipmentsPage.goto();

    await expect(shipmentsPage.loadError).toBeVisible();
  });

  test('shows a loading state while the API is slow', async ({ page, shipmentsPage }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(LIST, async (route) => {
      await gate;
      await route.continue();
    });

    await shipmentsPage.goto();
    const loading = page.getByRole('status').filter({ hasText: 'Loading shipments…' });
    await expect(loading).toBeVisible();

    release();

    await expect(loading).toBeHidden();
    await expect(shipmentsPage.rows.first()).toBeVisible();
  });

  test('ignores a slow, stale response that arrives after a newer search', async ({ page, api, shipmentsPage }) => {
    const shipment = await api.createShipmentOk(buildShipment());
    await page.route('**/api/shipments?*q=STALE*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });
    await shipmentsPage.goto();

    const staleRequest = page.waitForRequest((r) => r.url().includes('q=STALE'));
    const staleResponse = page.waitForResponse((r) => r.url().includes('q=STALE'));
    await shipmentsPage.searchFor('STALE');
    await staleRequest;
    await shipmentsPage.searchFor(shipment.reference);

    await expect(shipmentsPage.row(shipment.reference)).toBeVisible();
    await staleResponse; // the old, empty result lands now...
    await expect(shipmentsPage.row(shipment.reference)).toBeVisible(); // ...and must not overwrite the new one
    await expect(shipmentsPage.emptyState).toBeHidden();
  });

  test('renders a mocked API response exactly', async ({ page, shipmentsPage }) => {
    const items = ['SHP-9001', 'SHP-9002', 'SHP-9003'].map((id, i) => ({
      id,
      reference: `MOCK-${i + 1}`,
      carrier: 'USPS',
      serviceLevel: 'GROUND',
      recipientName: `Mock Person ${i + 1}`,
      destinationZip: '00501',
      weightOz: 1,
      status: 'DELIVERED',
      createdAt: '2026-02-0' + (i + 1) + 'T00:00:00.000Z',
      createdBy: 'mock',
    }));
    await page.route(LIST, (route) =>
      route.fulfill({ json: { items, page: 1, pageSize: 10, total: 3, totalPages: 1 } }),
    );

    await shipmentsPage.goto();

    await expect(shipmentsPage.rows).toHaveCount(3);
    expect(await shipmentsPage.columnValues('Reference')).toEqual(['MOCK-1', 'MOCK-2', 'MOCK-3']);
    expect(await shipmentsPage.columnValues('Created')).toEqual(['2026-02-01', '2026-02-02', '2026-02-03']);
    await expect(shipmentsPage.summary).toHaveText('3 shipments');
    await expect(shipmentsPage.pageInfo).toHaveText('Page 1 of 1');
    await expect(shipmentsPage.previous).toBeDisabled();
    await expect(shipmentsPage.next).toBeDisabled();
  });

  test('escapes HTML coming from the API', async ({ page, shipmentsPage }) => {
    const xss = '<img src=x onerror="window.__xss=1">';
    await page.route(LIST, (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: 'SHP-9100', reference: 'XSS-1', carrier: 'UPS', serviceLevel: 'GROUND', recipientName: xss,
              destinationZip: '00501', weightOz: 1, status: 'DELIVERED', createdAt: '2026-02-01T00:00:00.000Z', createdBy: 'mock',
            },
          ],
          page: 1, pageSize: 10, total: 1, totalPages: 1,
        },
      }),
    );

    await shipmentsPage.goto();

    await expect(shipmentsPage.row('XSS-1')).toContainText(xss);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });
});

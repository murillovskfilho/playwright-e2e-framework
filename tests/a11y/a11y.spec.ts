import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { buildShipment } from '../data/factories';
import { expect, test } from '../fixtures';

/** WCAG 2.1 A/AA scan with axe-core. Any violation fails, with a readable summary. */
async function expectNoA11yViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = violations.map((v) => `${v.impact}: ${v.id} (${v.nodes.length} nodes) ${v.helpUrl}`);
  expect(summary, summary.join('\n')).toEqual([]);
}

test.describe('Accessibility (axe, WCAG 2.1 AA)', () => {
  test.describe('anonymous', () => {
    test.use({ persona: 'anonymous' });

    test('login page, also with an error shown', async ({ loginPage }) => {
      await loginPage.goto();
      await expectNoA11yViolations(loginPage.page);

      await loginPage.signIn('nobody@acme.test', 'wrong');
      await expect(loginPage.error).toBeVisible();
      await expectNoA11yViolations(loginPage.page);
    });
  });

  test('shipments list', async ({ shipmentsPage }) => {
    await shipmentsPage.goto();
    await expect(shipmentsPage.rows.first()).toBeVisible();
    await expectNoA11yViolations(shipmentsPage.page);
  });

  test('new shipment form with validation errors', async ({ newShipmentPage }) => {
    await newShipmentPage.goto();
    await expectNoA11yViolations(newShipmentPage.page);

    await newShipmentPage.submit.click();
    await expect(newShipmentPage.formError).toBeVisible();
    await expectNoA11yViolations(newShipmentPage.page);
  });

  test('shipment detail', async ({ api, shipmentPage }) => {
    const shipment = await api.createShipmentOk(buildShipment());
    await shipmentPage.goto(shipment.id);
    await expect(shipmentPage.detail('Status')).toBeVisible();
    await expectNoA11yViolations(shipmentPage.page);
  });
});

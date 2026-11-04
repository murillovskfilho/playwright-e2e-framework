import type { Locator, Page } from '@playwright/test';

export class ShipmentDetailPage {
  readonly heading: Locator;
  readonly notice: Locator;
  readonly error: Locator;
  readonly cancel: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.notice = page.getByRole('status');
    this.error = page.getByRole('alert');
    this.cancel = page.getByRole('button', { name: 'Cancel shipment' });
  }

  async goto(id: string): Promise<void> {
    await this.page.goto(`/shipment?id=${encodeURIComponent(id)}`);
  }

  /** The value shown next to a label in the details list, e.g. detail('Status'). */
  detail(term: string): Locator {
    return this.page.locator('dl > dt').filter({ hasText: new RegExp(`^${term}$`) }).locator('xpath=following-sibling::dd[1]');
  }
}

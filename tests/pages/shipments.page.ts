import type { Locator, Page } from '@playwright/test';

export class ShipmentsPage {
  readonly heading: Locator;
  readonly search: Locator;
  readonly status: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly summary: Locator;
  readonly emptyState: Locator;
  readonly loadError: Locator;
  readonly retry: Locator;
  readonly previous: Locator;
  readonly next: Locator;
  readonly pageInfo: Locator;
  readonly newShipment: Locator;
  readonly currentUser: Locator;
  readonly currentRole: Locator;
  readonly signOut: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Shipments' });
    this.search = page.getByRole('searchbox', { name: 'Search' });
    this.status = page.getByLabel('Status');
    this.table = page.getByRole('table');
    this.rows = this.table.locator('tbody').getByRole('row');
    this.summary = this.table.locator('caption');
    this.emptyState = page.getByText('No shipments match your filters.');
    this.loadError = page.getByRole('alert').filter({ hasText: 'Could not load shipments.' });
    this.retry = page.getByRole('button', { name: 'Try again' });
    const pagination = page.getByRole('navigation', { name: 'Pagination' });
    this.previous = pagination.getByRole('button', { name: 'Previous' });
    this.next = pagination.getByRole('button', { name: 'Next' });
    this.pageInfo = pagination.getByText(/^Page \d+ of \d+$/);
    this.newShipment = page.getByRole('link', { name: 'New shipment' });
    this.currentUser = page.getByTestId('current-user');
    this.currentRole = page.getByTestId('current-role');
    this.signOut = page.getByRole('button', { name: 'Sign out' });
  }

  async goto(query: Record<string, string> = {}): Promise<void> {
    const qs = new URLSearchParams(query).toString();
    await this.page.goto(qs ? `/?${qs}` : '/');
    await this.heading.waitFor();
  }

  async searchFor(text: string): Promise<void> {
    await this.search.fill(text);
  }

  /** A table row identified by any unique text in it (id, reference, ...). */
  row(text: string): Locator {
    return this.rows.filter({ hasText: text });
  }

  /** Values of one column, in display order. */
  async columnValues(header: 'ID' | 'Reference' | 'Recipient' | 'Carrier' | 'Status' | 'Created'): Promise<string[]> {
    const headers = await this.table.locator('thead th').allInnerTexts();
    const index = headers.findIndex((h) => h.trim() === header);
    return this.rows.locator(`td:nth-child(${index + 1})`).allInnerTexts();
  }

  async openShipment(id: string): Promise<void> {
    await this.page.getByRole('link', { name: id, exact: true }).click();
  }
}

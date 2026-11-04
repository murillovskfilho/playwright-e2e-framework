import type { Locator, Page } from '@playwright/test';
import type { ShipmentInput } from '../data/factories';

export type ShipmentField = keyof ShipmentInput;

const LABELS: Record<ShipmentField, string> = {
  reference: 'Reference',
  carrier: 'Carrier',
  serviceLevel: 'Service level',
  recipientName: 'Recipient name',
  destinationZip: 'Destination ZIP',
  weightOz: 'Weight (oz)',
};

export class NewShipmentPage {
  readonly heading: Locator;
  readonly submit: Locator;
  readonly formError: Locator;
  readonly forbidden: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'New shipment' });
    this.submit = page.getByRole('button', { name: 'Create shipment' });
    this.formError = page.getByRole('alert').filter({ hasText: 'Please fix the errors below.' });
    this.forbidden = page.getByRole('alert').filter({ hasText: 'You do not have permission to create shipments.' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/new');
    await this.heading.waitFor();
  }

  field(name: ShipmentField): Locator {
    return this.page.getByLabel(LABELS[name], { exact: true });
  }

  async fill(input: Partial<ShipmentInput>): Promise<void> {
    for (const [name, value] of Object.entries(input) as [ShipmentField, string | number][]) {
      const field = this.field(name);
      if (name === 'carrier' || name === 'serviceLevel') await field.selectOption(String(value));
      else await field.fill(String(value));
    }
  }

  async create(input: Partial<ShipmentInput>): Promise<void> {
    await this.fill(input);
    await this.submit.click();
  }
}

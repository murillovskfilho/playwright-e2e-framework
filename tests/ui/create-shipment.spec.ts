import { buildShipment, type ShipmentInput } from '../data/factories';
import { personaUser } from '../data/personas';
import type { ShipmentField } from '../pages/new-shipment.page';
import { expect, test } from '../fixtures';

test.describe('Create shipment', () => {
  test('creates a shipment and shows it', async ({ page, api, newShipmentPage, shipmentPage }) => {
    const input = buildShipment({ carrier: 'FEDEX', serviceLevel: 'OVERNIGHT', weightOz: '12.5' });

    await newShipmentPage.goto();
    await newShipmentPage.create(input);

    await expect(page).toHaveURL(/\/shipment\?id=SHP-\d+&created=1$/);
    await expect(shipmentPage.notice).toHaveText('Shipment created.');
    const expected: Record<string, string> = {
      Status: 'Label created',
      Reference: input.reference,
      Carrier: 'FEDEX',
      'Service level': 'OVERNIGHT',
      Recipient: input.recipientName,
      'Destination ZIP': input.destinationZip,
      Weight: '12.5 oz',
      'Created by': personaUser('operator').email,
    };
    for (const [term, value] of Object.entries(expected)) await expect(shipmentPage.detail(term)).toHaveText(value);

    // And the backend agrees with the UI.
    const id = new URL(page.url()).searchParams.get('id')!;
    const res = await api.getShipment(id);
    expect(await res.json()).toMatchObject({ reference: input.reference, weightOz: 12.5, status: 'LABEL_CREATED' });
  });

  const invalid: { name: string; field: ShipmentField; value: string; message: string }[] = [
    { name: 'missing reference', field: 'reference', value: '', message: 'Reference is required' },
    { name: 'reference with spaces', field: 'reference', value: 'PO 123', message: 'Use 3-40 letters, digits or dashes' },
    { name: 'too-short recipient', field: 'recipientName', value: 'A', message: 'Recipient name is required' },
    { name: '4-digit ZIP', field: 'destinationZip', value: '9410', message: 'ZIP must be 5 digits' },
    { name: 'ZIP with letters', field: 'destinationZip', value: '94I05', message: 'ZIP must be 5 digits' },
    { name: 'zero weight', field: 'weightOz', value: '0', message: 'Weight must be between 0.1 and 2400 oz' },
    { name: 'weight above limit', field: 'weightOz', value: '2400.1', message: 'Weight must be between 0.1 and 2400 oz' },
    { name: 'non-numeric weight', field: 'weightOz', value: 'heavy', message: 'Weight must be between 0.1 and 2400 oz' },
  ];
  for (const { name, field, value, message } of invalid) {
    test(`rejects ${name}`, async ({ page, newShipmentPage }) => {
      await newShipmentPage.goto();
      await newShipmentPage.create(buildShipment({ [field]: value } as Partial<ShipmentInput>));

      await expect(newShipmentPage.formError).toBeVisible();
      await expect(newShipmentPage.field(field)).toHaveAttribute('aria-invalid', 'true');
      // The message is wired to the input for screen readers, not just painted next to it.
      await expect(newShipmentPage.field(field)).toHaveAccessibleDescription(message);
      await expect(page).toHaveURL('/new');
    });
  }

  test('reports every invalid field at once', async ({ newShipmentPage }) => {
    await newShipmentPage.goto();
    await newShipmentPage.submit.click();

    await expect(newShipmentPage.formError).toBeVisible();
    for (const field of ['reference', 'carrier', 'serviceLevel', 'recipientName', 'destinationZip', 'weightOz'] as const) {
      await expect(newShipmentPage.field(field)).toHaveAttribute('aria-invalid', 'true');
    }
  });

  test('rejects a reference that already exists in the tenant', async ({ api, newShipmentPage }) => {
    const existing = await api.createShipmentOk(buildShipment());

    await newShipmentPage.goto();
    await newShipmentPage.create(buildShipment({ reference: existing.reference.toLowerCase() }));

    await expect(newShipmentPage.field('reference')).toHaveAccessibleDescription('Reference already exists');
  });

  test('clears an error once the field is fixed', async ({ newShipmentPage }) => {
    const input = buildShipment({ destinationZip: '123' });
    await newShipmentPage.goto();
    await newShipmentPage.create(input);
    await expect(newShipmentPage.field('destinationZip')).toHaveAttribute('aria-invalid', 'true');

    await newShipmentPage.create({ destinationZip: '12345' });

    await expect(newShipmentPage.page).toHaveURL(/created=1/);
  });
});

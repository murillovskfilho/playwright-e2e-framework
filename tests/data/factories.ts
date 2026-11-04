import { randomBytes } from 'node:crypto';

export interface ShipmentInput {
  reference: string;
  carrier: string;
  serviceLevel: string;
  recipientName: string;
  destinationZip: string;
  weightOz: string | number;
}

/**
 * Unique reference per call, so every test owns its data and tests can run in parallel against
 * one shared server without resets. Everything else is fixed, so failures are reproducible.
 */
export const uniqueReference = (prefix = 'E2E') =>
  `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`.toUpperCase();

export function buildShipment(overrides: Partial<ShipmentInput> = {}): ShipmentInput {
  return {
    reference: uniqueReference(),
    carrier: 'UPS',
    serviceLevel: 'GROUND',
    recipientName: 'Grace Hopper',
    destinationZip: '94105',
    weightOz: 24,
    ...overrides,
  };
}

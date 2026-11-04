import Ajv, { type JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';
import { expect } from '@playwright/test';
import type { Shipment } from '../fixtures/api-client';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// additionalProperties: false makes the contract strict: new or leaked fields (like `tenant`) fail.
export const shipmentSchema: JSONSchemaType<Shipment> = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'reference', 'carrier', 'serviceLevel', 'recipientName', 'destinationZip', 'weightOz', 'status', 'createdAt', 'createdBy'],
  properties: {
    id: { type: 'string', pattern: '^SHP-\\d+$' },
    reference: { type: 'string', minLength: 3, maxLength: 40 },
    carrier: { type: 'string', enum: ['UPS', 'FEDEX', 'USPS', 'DHL'] },
    serviceLevel: { type: 'string', enum: ['GROUND', '2DAY', 'OVERNIGHT'] },
    recipientName: { type: 'string', minLength: 2 },
    destinationZip: { type: 'string', pattern: '^\\d{5}$' },
    weightOz: { type: 'number', exclusiveMinimum: 0, maximum: 2400 },
    status: { type: 'string', enum: ['LABEL_CREATED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] },
    createdAt: { type: 'string', format: 'date-time' },
    createdBy: { type: 'string' },
  },
};

export const shipmentPageSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'page', 'pageSize', 'total', 'totalPages'],
  properties: {
    items: { type: 'array', items: shipmentSchema },
    page: { type: 'integer', minimum: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 50 },
    total: { type: 'integer', minimum: 0 },
    totalPages: { type: 'integer', minimum: 1 },
  },
};

export const errorSchema = {
  type: 'object',
  required: ['error'],
  properties: { error: { type: 'string' }, errors: { type: 'object', additionalProperties: { type: 'string' } } },
  additionalProperties: false,
};

/** Asserts a payload matches a JSON schema and prints every violation if not. */
export function expectSchema(payload: unknown, schema: object): void {
  const validate = ajv.compile(schema);
  const valid = validate(payload);
  expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
}

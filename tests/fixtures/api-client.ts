import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { ShipmentInput } from '../data/factories';

export interface Shipment {
  id: string;
  reference: string;
  carrier: string;
  serviceLevel: string;
  recipientName: string;
  destinationZip: string;
  weightOz: number;
  status: 'LABEL_CREATED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
  createdBy: string;
}

/**
 * Thin typed client over the ShipDesk API. Raw methods return the APIResponse (for API tests that
 * assert status codes); the *Ok helpers assert success and return the body (for test arrangement).
 */
export class ShipDeskApi {
  constructor(readonly request: APIRequestContext) {}

  login(email: string, password: string): Promise<APIResponse> {
    return this.request.post('/api/auth/login', { data: { email, password } });
  }

  me(): Promise<APIResponse> {
    return this.request.get('/api/me');
  }

  listShipments(params: Record<string, string | number> = {}): Promise<APIResponse> {
    return this.request.get('/api/shipments', { params });
  }

  getShipment(id: string): Promise<APIResponse> {
    return this.request.get(`/api/shipments/${encodeURIComponent(id)}`);
  }

  createShipment(input: Partial<ShipmentInput> | Record<string, unknown>): Promise<APIResponse> {
    return this.request.post('/api/shipments', { data: input });
  }

  cancelShipment(id: string): Promise<APIResponse> {
    return this.request.post(`/api/shipments/${encodeURIComponent(id)}/cancel`);
  }

  async createShipmentOk(input: ShipmentInput): Promise<Shipment> {
    const res = await this.createShipment(input);
    expect(res.status(), await res.text()).toBe(201);
    return res.json();
  }

  async cancelShipmentOk(id: string): Promise<Shipment> {
    const res = await this.cancelShipment(id);
    expect(res.status(), await res.text()).toBe(200);
    return res.json();
  }
}

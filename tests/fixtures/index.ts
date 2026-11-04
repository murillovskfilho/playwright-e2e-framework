import { test as base, expect } from '@playwright/test';
import { authFile, type Persona } from '../data/personas';
import { LoginPage } from '../pages/login.page';
import { NewShipmentPage } from '../pages/new-shipment.page';
import { ShipmentDetailPage } from '../pages/shipment-detail.page';
import { ShipmentsPage } from '../pages/shipments.page';
import { ShipDeskApi } from './api-client';

interface Options {
  /** Who the test runs as. Override per file or describe block with test.use({ persona: 'viewer' }). */
  persona: Persona | 'anonymous';
}

interface Fixtures {
  /** API client signed in as the current persona. */
  api: ShipDeskApi;
  /** API client for any persona, e.g. arrange data as admin while the browser is a viewer. */
  apiAs: (persona: Persona | 'anonymous') => Promise<ShipDeskApi>;
  loginPage: LoginPage;
  shipmentsPage: ShipmentsPage;
  newShipmentPage: NewShipmentPage;
  shipmentPage: ShipmentDetailPage;
}

const EMPTY_STATE = { cookies: [], origins: [] };

export const test = base.extend<Options & Fixtures>({
  persona: ['operator', { option: true }],

  // Browser sessions reuse the state saved by the setup project: no UI login per test.
  storageState: async ({ persona }, use) => {
    await use(persona === 'anonymous' ? EMPTY_STATE : authFile(persona));
  },

  apiAs: async ({ playwright, baseURL }, use) => {
    const contexts: Awaited<ReturnType<typeof playwright.request.newContext>>[] = [];
    await use(async (persona) => {
      const context = await playwright.request.newContext({
        baseURL,
        storageState: persona === 'anonymous' ? EMPTY_STATE : authFile(persona),
      });
      contexts.push(context);
      return new ShipDeskApi(context);
    });
    await Promise.all(contexts.map((c) => c.dispose()));
  },

  api: async ({ apiAs, persona }, use) => {
    await use(await apiAs(persona));
  },

  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  shipmentsPage: async ({ page }, use) => use(new ShipmentsPage(page)),
  newShipmentPage: async ({ page }, use) => use(new NewShipmentPage(page)),
  shipmentPage: async ({ page }, use) => use(new ShipmentDetailPage(page)),
});

export { expect };

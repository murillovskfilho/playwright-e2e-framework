import { LOCKED_EMAIL, PASSWORD, PERSONAS, personaUser } from '../data/personas';
import { expect, test } from '../fixtures';

test.use({ persona: 'anonymous' });

test.describe('Authentication', () => {
  test('signs in and lands on the shipments page', async ({ page, loginPage, shipmentsPage }) => {
    const operator = personaUser('operator');

    await loginPage.goto();
    await loginPage.signIn(operator.email, PASSWORD);

    await expect(page).toHaveURL('/');
    await expect(shipmentsPage.heading).toBeVisible();
    await expect(shipmentsPage.currentUser).toHaveText(operator.name);
    await expect(shipmentsPage.currentRole).toHaveText('operator');
  });

  test('sends anonymous visitors to the login page and back where they were going', async ({
    page,
    loginPage,
    newShipmentPage,
  }) => {
    await page.goto('/new');
    await expect(page).toHaveURL('/login?next=%2Fnew');

    await loginPage.signIn(PERSONAS.operator, PASSWORD);

    await expect(page).toHaveURL('/new');
    await expect(newShipmentPage.heading).toBeVisible();
  });

  test('does not follow an open redirect in the next parameter', async ({ page, loginPage }) => {
    await loginPage.goto('//evil.example.com');
    await loginPage.signIn(PERSONAS.operator, PASSWORD);

    await expect(page).toHaveURL('/');
  });

  const invalid = [
    { name: 'wrong password', email: PERSONAS.operator, password: 'not-the-password', message: 'Invalid email or password' },
    { name: 'unknown email', email: 'nobody@acme.test', password: PASSWORD, message: 'Invalid email or password' },
    { name: 'empty fields', email: '', password: '', message: 'Email and password are required' },
    {
      name: 'locked account',
      email: LOCKED_EMAIL,
      password: PASSWORD,
      message: 'This account is locked. Contact your administrator.',
    },
  ];
  for (const { name, email, password, message } of invalid) {
    test(`rejects ${name}`, async ({ page, loginPage }) => {
      await loginPage.goto();
      await loginPage.signIn(email, password);

      await expect(loginPage.error).toHaveText(message);
      await expect(page).toHaveURL('/login');
    });
  }

  test('signs out and protects pages afterwards', async ({ page, loginPage, shipmentsPage }) => {
    await loginPage.goto();
    await loginPage.signIn(PERSONAS.viewer, PASSWORD);
    await expect(shipmentsPage.heading).toBeVisible();

    await shipmentsPage.signOut.click();

    await expect(page).toHaveURL('/login');
    await page.goto('/');
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});

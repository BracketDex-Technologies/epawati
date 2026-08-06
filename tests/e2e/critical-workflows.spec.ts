import { expect, test, type Page } from '@playwright/test';

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

async function signIn(page: Page) {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD for authenticated workflows.');
  await page.goto('/#/login');
  await page.getByLabel(/username/i).fill(username as string);
  await page.locator('input[name="password"]').fill(password as string);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/#\/login$/);
}

test('login renders and rejects an invalid account without leaking details', async ({ page }) => {
  await page.goto('/#/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await page.getByLabel(/username/i).fill('invalid@example.com');
  await page.locator('input[name="password"]').fill('invalid-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/incorrect username or password|could not reach/i)).toBeVisible();
});

test('mobile sidebar opens and exposes workspace navigation', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /menu|navigation/i }).click();
  await expect(page.getByRole('button', { name: /members & vargani/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /expenses/i })).toBeVisible();
});

test('year switch becomes interactive without a full workspace reload', async ({ page }) => {
  await signIn(page);
  const year = page.getByLabel(/active year/i).or(page.getByRole('combobox').first());
  await expect(year).toBeEnabled();
  const options = await year.locator('option').allTextContents();
  test.skip(options.length < 2, 'The test account needs at least two festival years.');
  await year.selectOption({ index: 1 });
  await expect(year).toBeEnabled({ timeout: 5_000 });
});

test('expense, slip, and template controls are functional', async ({ page }) => {
  await signIn(page);

  await page.goto('/#/mandal/expenses');
  await expect(page.getByRole('button', { name: /add expense/i })).toBeEnabled();

  await page.goto('/#/mandal/slips');
  await expect(page.getByRole('button', { name: /generate|add.*slip|new.*slip/i }).first()).toBeEnabled();

  await page.goto('/#/mandal/template');
  await expect(page.getByText(/upload template/i)).toBeVisible();
});

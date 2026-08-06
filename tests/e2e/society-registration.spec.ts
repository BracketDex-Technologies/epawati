import { expect, test, type Route } from '@playwright/test';

test('public society registration form stores society data', async ({ page }) => {
  let submittedBody: Record<string, unknown> | null = null;

  await page.route('**/api/v1/society-registrations', async (route) => {
    submittedBody = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
    return json(route, {
      id: '99999999-9999-4999-8999-999999999999',
      ok: true,
      societyName: submittedBody.societyName,
    });
  });

  await page.goto('/#/society-registration');
  await expect(page.getByRole('heading', { name: 'Society Registration' })).toBeVisible();

  await page.getByLabel(/society name/i).fill('Sai Residency CHS');
  await page.getByLabel(/no\. of flats/i).fill('72');
  await page.getByLabel(/society address/i).fill('Main Road, Natubag, Pune');
  await page.getByLabel(/chairman name/i).fill('Amit Patil');
  await page.getByLabel(/secretary name/i).fill('Neha Shah');
  await page.getByLabel(/chairman mobile/i).fill('9876543210');
  await page.getByLabel(/secretary mobile/i).fill('9876543211');
  await page.getByLabel(/email id/i).fill('society@example.com');
  await page.getByLabel(/no, continue without template/i).check();
  await page.getByRole('button', { name: /submit registration/i }).click();

  await expect(page.getByText(/registration saved for sai residency chs/i)).toBeVisible();
  expect(submittedBody).toMatchObject({
    chairmanMobile: '9876543210',
    chairmanName: 'Amit Patil',
    email: 'society@example.com',
    numberOfFlats: 72,
    secretaryMobile: '9876543211',
    secretaryName: 'Neha Shah',
    societyAddress: 'Main Road, Natubag, Pune',
    societyName: 'Sai Residency CHS',
    templateAvailable: false,
  });
});

function json(route: Route, body: unknown) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status: 200,
  });
}

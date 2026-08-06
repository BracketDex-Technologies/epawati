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

test('public society registration validates mobile numbers before submit', async ({ page }) => {
  let submitCount = 0;

  await page.route('**/api/v1/society-registrations', async (route) => {
    submitCount += 1;
    return json(route, { ok: true });
  });

  await page.goto('/#/society-registration');
  await page.getByLabel(/society name/i).fill('Sai Residency CHS');
  await page.getByLabel(/no\. of flats/i).fill('72');
  await page.getByLabel(/society address/i).fill('Main Road, Natubag, Pune');
  await page.getByLabel(/chairman mobile/i).fill('98765');
  await page.getByLabel(/no, continue without template/i).check();
  await page.getByRole('button', { name: /submit registration/i }).click();

  await expect(page.locator('.notice', { hasText: /chairman mobile number must be exactly 10 digits/i })).toBeVisible();
  expect(submitCount).toBe(0);

  await page.getByLabel(/chairman mobile/i).fill('9876543210');
  await page.getByLabel(/secretary mobile/i).fill('12345');
  await page.getByRole('button', { name: /submit registration/i }).click();

  await expect(page.locator('.notice', { hasText: /secretary mobile number must be exactly 10 digits/i })).toBeVisible();
  expect(submitCount).toBe(0);
});

test('super admin society data link shows submitted registrations', async ({ page }) => {
  const ownerSession = {
    accessToken: 'owner-access-token',
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      mandalId: null,
      name: 'Owner Admin',
      role: 'SUPER_ADMIN',
    },
  };

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');

    if (path === '/auth/login' || path === '/auth/refresh') return json(route, ownerSession);
    if (path === '/workspace/bootstrap') {
      return json(route, {
        generatedAt: new Date().toISOString(),
        kind: 'OWNER',
        mandals: { items: [], meta: { limit: 25, page: 1, total: 0, totalPages: 0 } },
        metrics: { totalMandals: 0, totalMembers: 0, totalSlips: 0 },
        partners: [],
        user: ownerSession.user,
      });
    }
    if (path === '/mandals/whatsapp/templates') {
      return json(route, { defaultWid: null, items: [] });
    }
    if (path === '/society-registrations') {
      return json(route, {
        items: [{
          chairmanMobile: '+919876543210',
          chairmanName: 'Amit Patil',
          createdAt: '2026-08-06T12:00:00.000Z',
          email: 'society@example.com',
          id: '99999999-9999-4999-8999-999999999999',
          numberOfFlats: 72,
          secretaryMobile: '+919876543211',
          secretaryName: 'Neha Shah',
          societyAddress: 'Main Road, Natubag, Pune',
          societyName: 'Sai Residency CHS',
          templateAvailable: false,
        }],
        meta: { limit: 100, page: 1, total: 1, totalPages: 1 },
      });
    }

    return json(route, { ok: true });
  });

  await page.goto('/#/super-admin/login');
  await page.getByLabel(/username/i).fill('owner@example.com');
  await page.locator('input[name="password"]').fill('valid-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  if (test.info().project.name.includes('mobile')) {
    await page.getByLabel('Open navigation menu').click();
  }
  await page.getByRole('button', { name: 'Society Data' }).click();

  await expect(page.getByRole('heading', { name: 'Society Data' })).toBeVisible();
  await expect(page.getByText('Sai Residency CHS')).toBeVisible();
  await expect(page.getByText('Amit Patil')).toBeVisible();
  await expect(page.getByText('+919876543210')).toBeVisible();
  await expect(page.getByText('72')).toBeVisible();
});

function json(route: Route, body: unknown) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status: 200,
  });
}

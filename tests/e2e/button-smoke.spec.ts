import { expect, test, type Page, type Route } from '@playwright/test';

const session = {
  accessToken: 'e2e-access-token',
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    mandalId: '22222222-2222-4222-8222-222222222222',
    name: 'E2E Admin',
    role: 'MANDAL_ADMIN',
  },
};

const festival = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Ganpati Festival 2026',
  startDate: '2026-08-01T00:00:00.000Z',
  status: 'ACTIVE',
  type: 'GANPATI',
};

const mandal = {
  additionalMembers: '',
  address: 'Main Road',
  adhyakshName: 'E2E Admin',
  city: 'Pune',
  contactPhone: '9876543210',
  id: session.user.mandalId,
  khajindarName: 'Treasurer',
  locality: 'Natubag',
  name: 'E2E Mandal',
  slipLimit: 5000,
  status: 'ACTIVE',
  whatsappMode: 'AUTO_API',
};

const group = {
  _count: { members: 1, slips: 1 },
  areaName: 'Main Road',
  id: '44444444-4444-4444-8444-444444444444',
  leader: { id: session.user.id, name: 'E2E Admin' },
  members: [],
  name: 'Main Road Team',
};

const member = {
  areaName: 'Main Road',
  displayName: 'Amit Collector',
  group,
  groupId: group.id,
  id: '55555555-5555-4555-8555-555555555555',
  phone: '9876543210',
  status: 'ACTIVE',
  user: {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Amit Collector',
    phone: '9876543210',
    role: 'MEMBER',
    status: 'ACTIVE',
  },
};

const paidSlip = {
  amount: 1500,
  areaName: 'Main Road',
  collectedByUserId: session.user.id,
  collector: { id: session.user.id, name: session.user.name },
  contributorAddress: 'Main Road, Pune',
  contributorName: 'Mahesh Traders',
  contributorPhone: '9876543210',
  createdAt: '2026-08-06T10:00:00.000Z',
  customData: {},
  groupId: group.id,
  id: '77777777-7777-4777-8777-777777777777',
  paymentMode: 'UPI',
  receiptImageUrl: 'https://cdn.example.com/slip.jpg',
  shopName: 'Mahesh Traders',
  slipNumber: 'DM-GAN-2026-000001',
  status: 'ACTIVE',
};

const pendingSlip = {
  ...paidSlip,
  amount: 700,
  contributorName: 'Pending Donor',
  id: '88888888-8888-4888-8888-888888888888',
  receiptImageUrl: null,
  slipNumber: 'DM-GAN-2026-000002',
  status: 'PENDING',
};

function workspace() {
  return {
    activeForm: { customFields: [], festival, member: null },
    auditEvents: [{
      action: 'deleted',
      actor: { id: session.user.id, name: session.user.name, role: 'MANDAL_ADMIN' },
      actorUserId: session.user.id,
      before: paidSlip,
      createdAt: '2026-08-06T11:00:00.000Z',
      entityId: paidSlip.id,
      entityType: 'vargani_slip',
      id: 'audit-delete-slip',
      mandalId: session.user.mandalId,
      metadata: null,
    }],
    expenses: [{
      amount: 250,
      createdAt: '2026-08-06T09:00:00.000Z',
      creator: { id: session.user.id, name: session.user.name },
      expenseDate: '2026-08-06T00:00:00.000Z',
      id: '99999999-9999-4999-8999-999999999999',
      notes: 'Decoration',
      status: 'APPROVED',
      vendorName: 'Local Vendor',
    }],
    generatedAt: new Date().toISOString(),
    groups: [{ ...group, members: [member] }],
    kind: 'MANDAL',
    mandal,
    members: [member],
    metrics: {
      balance: 1250,
      slipPaidAmount: 1500,
      slipPaidCount: 1,
      slipPendingAmount: 700,
      slipPendingCount: 1,
      slipTotalCount: 2,
      totalExpenses: 250,
    },
    report: {
      balance: 1250,
      slipCount: 2,
      totalCollection: 1500,
      totalExpenses: 250,
    },
    slips: { items: [paidSlip, pendingSlip], meta: { limit: 25, page: 1, total: 2, totalPages: 1 } },
    tasks: [{
      assignee: { id: session.user.id, name: session.user.name, role: 'MANDAL_ADMIN' },
      assigneeUserId: session.user.id,
      dueDate: '2026-08-10T00:00:00.000Z',
      group,
      groupId: group.id,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      notes: 'Check market route',
      priority: 'HIGH',
      status: 'OPEN',
      title: 'Collect pending route',
    }],
    templates: [{
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Default Template',
      status: 'ACTIVE',
      versions: [{
        backgroundFileUrl: '/templates/default-vargani-receipt.svg',
        canvasHeight: 800,
        canvasWidth: 1328,
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        isActive: true,
        renderConfig: { fields: {} },
        version: 1,
      }],
    }],
    user: session.user,
  };
}

async function mockApi(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.route('**/_vercel/**', (route) => route.fulfill({ body: '', status: 204 }));

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method();

    if (path === '/auth/login' || path === '/auth/refresh') return json(route, session);
    if (path === '/workspace/bootstrap') return json(route, workspace());
    if (path === '/workspace/summary') return json(route, { kind: 'MANDAL', metrics: workspace().metrics });
    if (path === '/translation/marathi/transliterate') return json(route, { text: 'मराठी मजकूर' });
    if (path.includes('/reports/collections.xlsx')) return file(route, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    if (path.includes('/reports/collections.pdf')) return file(route, 'application/pdf');
    if (path.includes('/reports/vargani-slips.pdf')) return file(route, 'application/pdf');
    if (method === 'GET' && path.endsWith('/vargani/slips')) return json(route, workspace().slips);
    if (method === 'GET' && path.endsWith('/expenses')) return json(route, workspace().expenses);
    if (method === 'GET' && path.endsWith('/tasks')) return json(route, workspace().tasks);
    if (method === 'POST' && path === '/vargani/slips') {
      const body = JSON.parse(request.postData() || '{}') as { status?: string };
      return json(route, {
        ...paidSlip,
        id: `new-${body.status === 'PENDING' ? 'pending' : 'paid'}`,
        receiptImageUrl: null,
        slipNumber: body.status === 'PENDING' ? 'DM-GAN-2026-000004' : 'DM-GAN-2026-000003',
        status: body.status === 'PENDING' ? 'PENDING' : 'ACTIVE',
      });
    }
    if (method === 'POST' && path.includes('/receipt-image-file')) {
      return json(route, {
        ok: true,
        receiptImageUrl: 'https://cdn.example.com/new-slip.jpg',
        share: { whatsapp: { ok: false, reason: 'auto_share_failed', status: 'failed' } },
        storage: 'inline',
      });
    }
    if (method === 'POST' && path.endsWith('/share')) {
      return json(route, {
        auditEventId: 'audit-1',
        expiresAt: '2026-09-06T00:00:00.000Z',
        ok: true,
        receiptUrl: 'https://example.com/receipt',
        sharedAt: '2026-08-06T10:00:00.000Z',
        whatsapp: { ok: true, status: 'sent' },
      });
    }
    if (method === 'POST' && path.includes('/expenses')) {
      return json(route, workspace().expenses[0]);
    }
    if (method === 'POST' && path.includes('/groups')) {
      return json(route, { ...group, id: 'new-group-id', name: 'North Lane Team' });
    }
    if (method === 'POST' && path.includes('/tasks')) {
      return json(route, {
        assignee: { id: session.user.id, name: session.user.name, role: 'MANDAL_ADMIN' },
        id: 'new-task-id',
        priority: 'MEDIUM',
        status: 'OPEN',
        title: 'New route task',
      });
    }
    if (method === 'PATCH' && path.includes('/tasks/')) {
      return json(route, { ...workspace().tasks[0], status: 'DONE' });
    }
    if (method === 'POST' && path.includes('/custom-fields')) {
      return json(route, {
        dashboardFilter: false,
        id: 'new-field-id',
        key: 'donor_type',
        label: 'Donor Type',
        options: [],
        printOnSlip: true,
        required: false,
        sortOrder: 1,
        type: 'TEXT',
      });
    }

    return json(route, { ok: true });
  });
}

async function openAdminScreen(page: Page, name: RegExp) {
  if ((page.viewportSize()?.width ?? 1280) < 760) {
    await page.getByRole('button', { name: /open navigation menu/i }).click();
  }
  await page.getByRole('button', { name }).click();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    console.error(`PAGEERROR: ${error.message}`);
    errors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error(`CONSOLE_ERROR: ${message.text()}`);
      errors.push(message.text());
    }
  });
  await mockApi(page);
  await page.goto('/#/login');
  await page.getByLabel(/username/i).fill('admin@example.com');
  await page.locator('input[name="password"]').fill('valid-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await openAdminScreen(page, /vargani slips/i);
  await expect(page.getByRole('heading', { level: 1, name: 'Vargani Slips' })).toBeVisible();
  test.info().attach('client-errors', { body: errors.join('\n'), contentType: 'text/plain' });
});

test('admin slip buttons perform their duties without client errors', async ({ page }) => {
  await page.getByRole('button', { name: /download excel/i }).click();
  await expect(page.getByText(/excel sheet downloaded successfully/i)).toBeVisible();

  await page.getByRole('button', { name: /accounting pdf/i }).click();
  await expect(page.getByText(/accounting pdf downloaded successfully/i)).toBeVisible();

  await page.getByRole('button', { name: /complete slips pdf/i }).click();
  await expect(page.getByText(/all vargani slips pdf downloaded successfully/i)).toBeVisible();

  await page.getByRole('button', { name: /^paid/i }).click();
  await expect(page.getByText('Mahesh Traders').first()).toBeVisible();
  await page.getByRole('button', { name: /^pending/i }).click();
  await expect(page.getByText('Pending Donor')).toBeVisible();
  await page.getByPlaceholder(/search by name/i).fill('Mahesh');
  await page.getByRole('button', { name: /^all \(/i }).click();
  await expect(page.getByText('Mahesh Traders').first()).toBeVisible();

  await page.getByRole('button', { name: /new vargani entry/i }).click();
  const paidCard = page.locator('.payment-card.paid.active');
  await expect(paidCard).toBeVisible();
  await expect(paidCard).toHaveCSS('border-color', 'rgb(22, 163, 74)');
  await page.getByLabel(/^Name \*/).fill('Fresh Paid Donor');
  await page.getByLabel(/^Amount \*/).fill('1200');
  await page.getByLabel(/whatsapp number/i).fill('9876543210');
  await page.getByRole('button', { name: /confirm & generate slip/i }).click();
  await expect(page.getByText(/slip dm-gan-2026-000003 generated/i)).toBeVisible();

  await page.getByRole('button', { name: /new vargani entry/i }).click();
  await page.locator('.payment-card.pending').click();
  await page.getByLabel(/^Name \*/).fill('Fresh Pending Donor');
  await page.getByLabel(/^Amount \*/).fill('500');
  const pendingRequest = page.waitForRequest((request) =>
    request.method() === 'POST' &&
    request.url().includes('/api/v1/vargani/slips') &&
    request.postData()?.includes('"status":"PENDING"'),
  );
  await page.getByRole('button', { name: /save as pending/i }).click();
  await pendingRequest;
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('admin navigation and creation buttons open, submit, and close smoothly', async ({ page }) => {
  await openAdminScreen(page, /^expenses$/i);
  await page.getByRole('button', { name: /add expense/i }).click();
  await page.getByLabel(/description/i).fill('Stage lights');
  await page.getByLabel(/amount/i).fill('300');
  const expenseRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/api/v1/mandals/') && request.url().includes('/expenses'),
  );
  await page.getByRole('button', { name: /save expense/i }).click();
  await expenseRequest;
  await expect(page.getByRole('dialog')).toBeHidden();

  await openAdminScreen(page, /^tasks$/i);
  await page.getByRole('button', { name: /add task/i }).click();
  await page.getByLabel(/task name/i).fill('Check donation booth');
  const taskRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/api/v1/mandals/') && request.url().includes('/tasks'),
  );
  await page.getByRole('button', { name: /create task/i }).click();
  await taskRequest;
  await expect(page.getByRole('dialog')).toBeHidden();
  const taskDoneRequest = page.waitForRequest((request) =>
    request.method() === 'PATCH' && request.url().includes('/api/v1/mandals/') && request.url().includes('/tasks/'),
  );
  await page.locator('.tasks-table .row-actions button').first().click();
  await taskDoneRequest;

  await openAdminScreen(page, /members & vargani/i);
  await page.getByRole('button', { name: /add group/i }).click();
  await page.getByLabel(/group name/i).fill('North Lane Team');
  const groupRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/api/v1/mandals/') && request.url().includes('/groups'),
  );
  await page.getByRole('button', { name: /create group/i }).click();
  await groupRequest;
  await expect(page.getByRole('dialog')).toBeHidden();

  await openAdminScreen(page, /form management/i);
  await page.getByLabel(/question label/i).fill('Donor Type');
  const fieldRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && request.url().includes('/api/v1/mandals/') && request.url().includes('/custom-fields'),
  );
  await page.getByRole('button', { name: /add question/i }).click();
  await fieldRequest;
  await expect(page.getByText('Donor Type')).toBeVisible();

  await openAdminScreen(page, /system logs/i);
  await expect(page.getByText('VARGANI SLIP DELETED')).toBeVisible();
  await expect(page.getByText(/Slip DM-GAN-2026-000001/)).toBeVisible();
});

function json(route: Route, body: unknown) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status: 200,
  });
}

function file(route: Route, contentType: string) {
  return route.fulfill({
    body: Buffer.from('e2e file'),
    contentType,
    headers: { 'Content-Disposition': 'attachment; filename="e2e-file"' },
    status: 200,
  });
}

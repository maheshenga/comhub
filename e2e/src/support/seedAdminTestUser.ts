import { expect, type Page, request } from '@playwright/test';

/**
 * Admin e2e test user.
 *
 * The shared `seedTestUser()` creates `e2e-test@lobehub.com` without a role,
 * so the admin layout (`isAdminRole` gate) would redirect it away from
 * /settings/admin. Admin scenarios therefore seed a dedicated full admin
 * (role = 'admin', capabilities = '*') and sign in through the auth API.
 *
 * Both records are upserted (`ON CONFLICT DO NOTHING/UPDATE`) so repeated
 * runs and parallel workers are safe; cleanup deletes only rows we own.
 */
export const ADMIN_TEST_USER = {
  email: 'e2e-admin@lobehub.com',
  fullName: 'E2E Admin User',
  id: 'user_e2e_admin_001',
  password: 'TestPassword123!',
  role: 'admin',
  username: 'e2e_admin',
};

export const ADMIN_TEST_USER_ACCOUNT_ID = 'e2e_test_admin_account_001';

const hashPassword = async (password: string): Promise<string> => {
  const { default: bcrypt } = await import('bcryptjs');
  return bcrypt.hash(password, 10);
};

export async function seedAdminTestUser(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to seed the admin test user');
  }

  // Dynamic import keeps parity with seedTestUser.ts
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    const now = new Date().toISOString();
    const onboarding = JSON.stringify({ finishedAt: now, version: 1 });
    const passwordHash = await hashPassword(ADMIN_TEST_USER.password);

    await client.query(
      `INSERT INTO users (id, email, normalized_email, username, full_name, email_verified, role, onboarding, created_at, updated_at, last_active_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $8, $8)
       ON CONFLICT (id) DO UPDATE SET role = $7, onboarding = $8, updated_at = $8`,
      [
        ADMIN_TEST_USER.id,
        ADMIN_TEST_USER.email,
        ADMIN_TEST_USER.email.toLowerCase(),
        ADMIN_TEST_USER.username,
        ADMIN_TEST_USER.fullName,
        true,
        ADMIN_TEST_USER.role,
        onboarding,
      ],
    );

    await client.query(
      `INSERT INTO accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT DO NOTHING`,
      [
        ADMIN_TEST_USER_ACCOUNT_ID,
        ADMIN_TEST_USER.id,
        ADMIN_TEST_USER.email,
        'credential',
        passwordHash,
        now,
      ],
    );

    console.log(
      `✅ Admin test user seeded: ${ADMIN_TEST_USER.email} (role=${ADMIN_TEST_USER.role})`,
    );
  } finally {
    await client.end();
  }
}

/**
 * Sign in through the auth API and copy the session cookies into the browser
 * context — same approach as `Given('I am logged in with a session')`.
 */
export async function loginAdminUser(page: Page): Promise<void> {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3006;
  const baseURL = process.env.BASE_URL || `http://localhost:${PORT}`;
  const api = await request.newContext({ baseURL });

  try {
    const response = await api.post('/api/auth/sign-in/email', {
      data: {
        email: ADMIN_TEST_USER.email,
        password: ADMIN_TEST_USER.password,
      },
    });

    expect(
      response.ok(),
      `Admin auth API sign-in failed: ${response.status()} ${await response.text()}`,
    ).toBe(true);

    await page.context().addCookies((await api.storageState()).cookies);
  } finally {
    await api.dispose();
  }
}

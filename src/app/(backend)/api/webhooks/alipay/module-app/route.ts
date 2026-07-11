import { ModuleAppPaymentService } from '@/business/server/module-apps/payments/service';
import { getServerDB } from '@/database/server';
import { createConfiguredModuleAppAlipayClient } from '@/server/services/moduleAppPayments/alipay/client';

const plainText = (body: 'failure' | 'success') =>
  new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' }, status: 200 });

export const createAlipayModuleAppWebhookHandler = (dependencies: {
  handleNotification: (input: {
    body: string;
    headers: Record<string, string>;
  }) => Promise<unknown>;
}) => async (request: Request) => {
  const body = await request.text();
  try {
    await dependencies.handleNotification({
      body,
      headers: Object.fromEntries(request.headers.entries()),
    });
    return plainText('success');
  } catch {
    return plainText('failure');
  }
};

export const POST = createAlipayModuleAppWebhookHandler({
  handleNotification: async (input) => {
    const db = await getServerDB();
    return new ModuleAppPaymentService(
      db,
      createConfiguredModuleAppAlipayClient(),
    ).handleNotification(input);
  },
});

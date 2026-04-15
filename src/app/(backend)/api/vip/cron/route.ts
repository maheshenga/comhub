import type { NextRequest } from 'next/server';

import { getServerDB } from '@/database/core/db-adaptor';
import { CreditTransactionModel } from '@/database/models/creditTransaction';
import { NotificationModel } from '@/database/models/notification';
import { SiteConfigModel } from '@/database/models/siteConfig';
import { UserCreditsModel } from '@/database/models/userCredits';
import { UserSubscriptionModel } from '@/database/models/userSubscription';

/**
 * VIP Cron endpoint — called periodically (e.g. daily) to:
 * 1. Auto-expire overdue subscriptions
 * 2. Grant monthly credits to active VIP users
 * 3. Send expiration reminder notifications (3-day and 1-day warnings)
 *
 * Auth: Bearer ${CRON_SECRET} (from site_config DB or env var)
 * Method: GET
 */
export async function GET(request: NextRequest) {
  const db = await getServerDB();

  // Read CRON_SECRET from DB first, then fall back to env var
  let cronSecret = process.env.CRON_SECRET;
  try {
    const siteConfigModel = new SiteConfigModel(db);
    const dbSecret = await siteConfigModel.getValue('cron_secret');
    if (dbSecret) cronSecret = dbSecret;
  } catch { /* table might not exist yet */ }

  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const subscriptionModel = new UserSubscriptionModel(db);
  const creditsModel = new UserCreditsModel(db);
  const txModel = new CreditTransactionModel(db);

  const stats = {
    creditsGranted: 0,
    expired: 0,
    reminders3d: 0,
    reminders1d: 0,
  };

  // ── 1. Auto-expire overdue subscriptions ──────────────────────
  stats.expired = await subscriptionModel.expireOverdue();

  // ── 2. Monthly credit grants ─────────────────────────────────
  // Grant credits to all active subscribers based on their plan's creditsPerMonth.
  // Deduplication: use referenceId = "monthly_grant_{subscriptionId}_{YYYY-MM}"
  // so the same grant is never applied twice in the same month.
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const activeSubscriptions = await subscriptionModel.getAllActiveWithPlan();

  for (const sub of activeSubscriptions) {
    const plan = (sub as any).plan;
    if (!plan || !plan.creditsPerMonth || plan.creditsPerMonth <= 0) continue;

    const referenceId = `monthly_grant_${sub.id}_${yearMonth}`;

    // Check if already granted this month
    const existing = await txModel.findByReferenceId(sub.userId, referenceId);
    if (existing) continue;

    // Grant credits
    await creditsModel.addCredits(sub.userId, plan.creditsPerMonth);
    await txModel.create({
      userId: sub.userId,
      amount: plan.creditsPerMonth,
      type: 'subscription_grant',
      description: `${plan.name} 月度积分发放 (${yearMonth})`,
      referenceId,
    });

    stats.creditsGranted++;
  }

  // ── 3. Expiration reminders ──────────────────────────────────
  // Send notifications for subscriptions expiring within 3 days
  const expiring3d = await subscriptionModel.getExpiringSoon(3);
  for (const sub of expiring3d) {
    const plan = (sub as any).plan;
    const planName = plan?.name || 'VIP';
    const expiresDate = sub.expiresAt
      ? new Date(sub.expiresAt).toLocaleDateString('zh-CN')
      : '';

    const notifModel = new NotificationModel(db, sub.userId);
    const result = await notifModel.create({
      category: 'subscription',
      type: 'vip_expiring_3d',
      title: `${planName} 即将到期`,
      content: `您的 ${planName} 会员将于 ${expiresDate} 到期，届时将无法继续使用 VIP 模型服务。请及时续费以确保服务不中断。`,
      dedupeKey: `vip_expiring_3d_${sub.id}_${yearMonth}`,
      actionUrl: '/settings/vip',
    });
    if (result) stats.reminders3d++;
  }

  // Send notifications for subscriptions expiring within 1 day
  const expiring1d = await subscriptionModel.getExpiringSoon(1);
  for (const sub of expiring1d) {
    const plan = (sub as any).plan;
    const planName = plan?.name || 'VIP';
    const expiresDate = sub.expiresAt
      ? new Date(sub.expiresAt).toLocaleDateString('zh-CN')
      : '';

    const notifModel = new NotificationModel(db, sub.userId);
    const result = await notifModel.create({
      category: 'subscription',
      type: 'vip_expiring_1d',
      title: `${planName} 明天到期`,
      content: `您的 ${planName} 会员将于 ${expiresDate} 到期，仅剩不到 24 小时。请尽快续费，避免服务中断。`,
      dedupeKey: `vip_expiring_1d_${sub.id}_${yearMonth}`,
      actionUrl: '/settings/vip',
    });
    if (result) stats.reminders1d++;
  }

  return Response.json({
    ok: true,
    stats,
    timestamp: now.toISOString(),
  });
}

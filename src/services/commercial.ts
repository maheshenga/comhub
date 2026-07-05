import { lambdaClient } from '@/libs/trpc/client';
import {
  type BindReferralCodeParams,
  type QueryCommercialListParams,
  type QueryCreditLedgerParams,
  type UpdateReferralCodeParams,
} from '@/types/business';

class CommercialService {
  getOverview = async () => {
    return lambdaClient.subscription.getOverview.query();
  };

  getSubscriptionSummary = async () => {
    return lambdaClient.subscription.getSummary.query();
  };

  getPendingSubscriptionChangeRequest = async () => {
    return lambdaClient.subscription.getPendingChangeRequest.query();
  };

  listSubscriptionChangeRequests = async (params?: QueryCommercialListParams) => {
    return lambdaClient.subscription.listChangeRequests.query(params ?? {});
  };

  listPlanCatalog = async () => {
    return lambdaClient.subscription.listPlanCatalog.query();
  };

  listPlanFaq = async () => {
    return lambdaClient.subscription.listPlanFaq.query();
  };

  getCreditAccountSummary = async () => {
    return lambdaClient.spend.getAccountSummary.query();
  };

  listCreditLedger = async (params?: QueryCreditLedgerParams) => {
    return lambdaClient.spend.listLedger.query(params ?? {});
  };

  getReferralOverview = async () => {
    return lambdaClient.referral.getOverview.query();
  };

  activateReferralReward = async () => {
    return lambdaClient.referral.activateReward.mutate();
  };

  updateReferralCode = async (params: UpdateReferralCodeParams) => {
    return lambdaClient.referral.updateCode.mutate(params);
  };

  bindReferralCode = async (params: BindReferralCodeParams) => {
    return lambdaClient.referral.bindCode.mutate(params);
  };

  listReferralHistory = async (params?: QueryCommercialListParams) => {
    return lambdaClient.referral.listHistory.query(params ?? {});
  };

  getTopUpPackages = async () => {
    return lambdaClient.spend.listTopUpPackages.query();
  };

  listTopUpOrders = async (params?: QueryCommercialListParams) => {
    return lambdaClient.spend.listTopUpOrders.query(params ?? {});
  };

  redeemCode = async (code: string) => {
    return lambdaClient.redemption.redeem.mutate({ code });
  };

  previewCode = async (code: string) => {
    return lambdaClient.redemption.preview.query({ code });
  };
}

export const commercialService = new CommercialService();

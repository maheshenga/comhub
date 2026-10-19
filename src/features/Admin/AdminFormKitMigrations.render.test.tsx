import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClientDataSWR } from '@/libs/swr';
import { adminCommercialService } from '@/services/adminCommercial';
import { SkillSorts } from '@/types/discover';

import AdminExpertPlazaPage from './AdminExpertPlazaPage';
import AdminModelPolicyPage from './AdminModelPolicyPage';
import AdminOperationsPage from './AdminOperationsPage';
import AdminRecommendationsPage from './AdminRecommendationsPage';
import AdminSettingsPage from './AdminSettingsPage';
import AdminTopUpPackagesPage from './AdminTopUpPackagesPage';
import ChannelSettings from './PaymentChannels/ChannelSettings';

vi.mock('@/libs/swr', () => ({
  mutate: vi.fn(() => Promise.resolve()),
  useClientDataSWR: vi.fn(),
}));

vi.mock('@/services/adminCommercial', () => ({
  adminCommercialService: {
    getSettingsSection: vi.fn(),
    listPackages: vi.fn(),
    setAppSettingsBatch: vi.fn(),
    upsertPackage: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) =>
      typeof options === 'string' ? options : (options?.defaultValue ?? key),
  }),
}));

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => vi.fn(),
}));

const operationsData = {
  operationsConfig: {
    announcement: { content: '', enabled: false, title: '', type: 'info' },
    creatorRewardBannerEnabled: true,
    featuredAssistants: { enabled: true, pageSize: 12, title: '' },
    featuredMcps: { enabled: true, pageSize: 12, title: '' },
    featuredSkills: {
      category: '',
      enabled: false,
      pageSize: 8,
      sort: SkillSorts.InstallCount,
      title: '',
    },
  },
};

const recommendationsData = {
  recommendationConfig: {
    assistantTags: [],
    assistantTitle: '为你推荐的助理',
    assistantsEnabled: true,
    enabled: false,
    generalSkillCategories: [],
    generalSkillsEnabled: true,
    generalSkillTitle: '通用推荐技能',
    hotSkillSort: SkillSorts.InstallCount,
    hotSkillsEnabled: true,
    hotSkillTitle: '热门技能',
    mcpCategories: [],
    mcpsEnabled: true,
    mcpTitle: '推荐 MCP / 工具',
    selectedTags: [],
    skillCategories: [],
    skillsEnabled: true,
    skillTitle: '推荐技能',
  },
};

const modelPolicyData = {
  modelPolicyConfig: {
    allowlistText: '',
    applyToEmbeddings: true,
    applyToGenerateObject: true,
    blocklistText: '',
    defaultModelFallback: '',
    deniedMessage: 'denied',
    enabled: false,
    mode: 'blocklist',
  },
  sharedHealth: { enabledNewapiModels: [] },
};

const paymentsData = {
  paymentConfig: {
    alipay: { certMode: 'public_key', enabled: false },
    enabled: false,
    moduleAppEnabled: false,
    subscriptionEnabled: false,
    topUpEnabled: false,
  },
  paymentGatewayStatus: { configured: false, enabled: false, methods: [] },
};

const expertPlazaData = {
  expertPlazaConfig: {
    cards: [],
    categories: [],
    description: '',
    enabled: false,
    name: '专家广场',
  },
};

const sectionData: Record<string, unknown> = {
  'expert-plaza': expertPlazaData,
  'file-storage': { storageS3PublicDomain: '' },
  'model-policy': modelPolicyData,
  'operations': operationsData,
  'payments': paymentsData,
  'recommendations': recommendationsData,
  'settings': {},
};

const setBatch = vi.mocked(adminCommercialService.setAppSettingsBatch);

beforeEach(() => {
  vi.clearAllMocks();
  setBatch.mockResolvedValue({ ok: true } as any);
  vi.mocked(adminCommercialService.upsertPackage).mockResolvedValue({ ok: true } as any);
  vi.mocked(useClientDataSWR).mockImplementation((key: any) => {
    const section = Array.isArray(key) ? key[2] : key;
    return {
      data: typeof section === 'string' ? sectionData[section] : undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as any;
  });
});

describe('Admin FormKit migrations (baseline pages)', () => {
  it('saves a changed brand name from the settings page', async () => {
    render(<AdminSettingsPage />);

    const input = await screen.findByLabelText('品牌名称', { exact: false });
    fireEvent.change(input, { target: { value: '新品牌' } });
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }));

    await waitFor(() => {
      expect(setBatch).toHaveBeenCalledWith({
        updates: expect.arrayContaining([{ key: 'brand.name', value: '新品牌' }]),
      });
    });
  });

  it('saves the announcement content from the operations page', async () => {
    render(<AdminOperationsPage />);

    const textarea = await screen.findByLabelText('公告内容', { exact: false });
    fireEvent.change(textarea, { target: { value: '新公告' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(setBatch).toHaveBeenCalledWith({
        updates: expect.arrayContaining([
          { key: 'community.homeAnnouncement.content', value: '新公告' },
        ]),
      });
    });
  });

  it('splits recommendation tags before saving', async () => {
    render(<AdminRecommendationsPage />);

    const textarea = await screen.findByLabelText('用户选择标签', { exact: false });
    fireEvent.change(textarea, { target: { value: 'coding, writing' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(setBatch).toHaveBeenCalledWith({
        updates: expect.arrayContaining([
          { key: 'recommendation.selectedTags', value: ['coding', 'writing'] },
        ]),
      });
    });
  });

  it('normalizes the model policy allowlist on blur and saves it', async () => {
    render(<AdminModelPolicyPage />);

    const textarea = (await screen.findAllByLabelText('允许列表', { exact: false })).find(
      (element) => element.tagName === 'TEXTAREA',
    );
    expect(textarea).toBeDefined();
    fireEvent.change(textarea!, { target: { value: 'openai:a, openai:b; openai:a' } });
    fireEvent.blur(textarea!);
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(setBatch).toHaveBeenCalledWith({
        updates: expect.arrayContaining([
          { key: 'model.policy.allowlist', value: 'openai:a\nopenai:b' },
        ]),
      });
    });
  });

  it('binds the top-up modal form and submits the package payload', async () => {
    render(<AdminTopUpPackagesPage />);

    fireEvent.click(screen.getByRole('button', { name: '新增充值套餐' }));
    fireEvent.change(await screen.findByLabelText('套餐 ID（如 starter-100）', { exact: false }), {
      target: { value: 'starter' },
    });
    fireEvent.change(screen.getByLabelText('套餐名称', { exact: false }), {
      target: { value: 'Starter' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(adminCommercialService.upsertPackage).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Starter', id: 'starter' }),
      );
    });
  });

  it('saves payment toggles and renders certificate fields from the watched mode', async () => {
    vi.mocked(useClientDataSWR).mockImplementation((key: any) => {
      const section = Array.isArray(key) ? key[2] : key;
      const data =
        section === 'payments'
          ? {
              ...paymentsData,
              paymentConfig: {
                ...paymentsData.paymentConfig,
                alipay: { certMode: 'certificate', enabled: false },
              },
            }
          : sectionData[section as string];
      return { data, error: undefined, isLoading: false, mutate: vi.fn() } as any;
    });

    render(<ChannelSettings onDirtyChange={vi.fn()} />);

    expect(
      await screen.findByLabelText('Alipay public-key certificate', { exact: false }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Enable unified payments', { exact: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Save payment settings' }));

    await waitFor(() => {
      expect(setBatch).toHaveBeenCalledWith({
        updates: expect.arrayContaining([{ key: 'payment.enabled', value: true }]),
      });
    });
  });

  it('adds a card through the expert plaza Form.List and saves it', async () => {
    render(<AdminExpertPlazaPage />);

    fireEvent.click(await screen.findByRole('button', { name: '添加卡片' }));
    fireEvent.change(await screen.findByLabelText('标题', { exact: false }), {
      target: { value: '财务顾问' },
    });
    fireEvent.change(screen.getByLabelText('描述', { exact: false }), {
      target: { value: '帮你做财务规划' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存专家广场' }));

    await waitFor(() => {
      expect(setBatch).toHaveBeenCalledWith({
        updates: expect.arrayContaining([
          {
            key: 'expertPlaza.cards',
            value: expect.arrayContaining([
              expect.objectContaining({ description: '帮你做财务规划', title: '财务顾问' }),
            ]),
          },
        ]),
      });
    });
  });
});

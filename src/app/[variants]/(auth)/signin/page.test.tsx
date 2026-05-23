import { describe, expect, it, vi } from 'vitest';

const MockSignInPageClient = vi.hoisted(() => function MockSignInPageClient() {
  return <div>signin client</div>;
});

vi.mock('@/components/Loading/BrandTextLoading', () => ({
  default: ({ debugId }: { debugId: string }) => <div>loading {debugId}</div>,
}));

vi.mock('@/server/services/brand', () => ({
  getServerBrand: vi.fn(async () => ({
    authTitle: 'Admin auth title',
    faviconUrl: null,
    name: 'XuanGuo AI',
  })),
}));

vi.mock('@/server/translation', () => ({
  translation: vi.fn(async () => ({
    t: (key: string) => key,
  })),
}));

vi.mock('@/utils/server/routeVariants', () => ({
  RouteVariants: {
    getLocale: vi.fn(async () => 'zh-CN'),
  },
}));

vi.mock('./SignInPageClient', () => ({
  default: MockSignInPageClient,
}));

vi.mock('./useSignIn', () => ({
  useSignIn: () => ({
    disableEmailPassword: false,
    email: '',
    form: {},
    handleBackToEmail: vi.fn(),
    handleCheckUser: vi.fn(),
    handleForgotPassword: vi.fn(),
    handleSignIn: vi.fn(),
    handleSocialSignIn: vi.fn(),
    isSocialOnly: false,
    lastAuthProvider: null,
    loading: false,
    oAuthSSOProviders: [],
    serverConfigInit: true,
    socialLoading: null,
    step: 'email',
  }),
}));

vi.mock('./SignInEmailStep', () => ({
  SignInEmailStep: () => <div>legacy email step</div>,
}));

vi.mock('./SignInPasswordStep', () => ({
  SignInPasswordStep: () => <div>legacy password step</div>,
}));

describe('signin page shell', () => {
  it('renders the client signin component through the server page shell', async () => {
    const { default: Page } = await import('./page');
    const element = Page();
    const childType = (element as any).props.children.type;

    expect(childType === MockSignInPageClient).toBe(true);
  });

  it('exports metadata for the signin route', async () => {
    const pageModule = await import('./page');

    expect(pageModule.generateMetadata).toEqual(expect.any(Function));
  });

  it('uses the runtime brand name for signin metadata', async () => {
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({} as any);

    expect(metadata.title).toBe('XuanGuo AI');
    expect(metadata.description).toBe('Admin auth title');
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        description: 'Admin auth title',
        siteName: 'XuanGuo AI',
        title: 'XuanGuo AI',
      }),
    );
  });
});

import { Alert, Button, Flexbox, Icon, Input, Skeleton, Text } from '@lobehub/ui';
import { type FormInstance, type InputRef } from 'antd';
import { Badge, Divider, Form } from 'antd';
import { createStaticStyles } from 'antd-style';
import { ChevronRight, Mail } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import AuthIcons from '@/components/AuthIcons';
import { PRIVACY_URL, TERMS_URL } from '@/const/url';
import { useBrand } from '@/features/Brand';

import AuthCard from '../../../../features/AuthCard';
import { AuthAgreement, useAuthAgreement } from '../_layout/AuthAgreement';

const styles = createStaticStyles(({ css, cssVar }) => ({
  inlineLink: css`
    cursor: pointer;
    color: ${cssVar.colorPrimary};
    text-decoration: underline;
  `,
}));

export const EMAIL_REGEX = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;
export const USERNAME_REGEX = /^\w+$/;

const getProviderName = (provider: string) =>
  provider.toLowerCase().replaceAll(/(^|[_-])([a-z])/g, (_, __, character) =>
    character.toUpperCase(),
  );

export interface SignInEmailStepProps {
  disableEmailPassword?: boolean;
  form: FormInstance<{ email: string }>;
  isSocialOnly: boolean;
  lastAuthProvider?: string | null;
  loading: boolean;
  oAuthSSOProviders: string[];
  onCheckUser: (values: { email: string }) => Promise<void>;
  onGoToSignup: () => void;
  onResetEmail: () => void;
  onSetPassword: () => void;
  onSocialSignIn: (provider: string) => void;
  serverConfigInit: boolean;
  socialLoading: string | null;
}

export const SignInEmailStep = ({
  disableEmailPassword,
  form,
  isSocialOnly,
  lastAuthProvider,
  loading,
  oAuthSSOProviders,
  serverConfigInit,
  socialLoading,
  onCheckUser,
  onGoToSignup,
  onResetEmail,
  onSetPassword,
  onSocialSignIn,
}: SignInEmailStepProps) => {
  const { t } = useTranslation('auth');
  const brand = useBrand();
  const { agreementChecked, continueWithAgreement, setAgreementChecked } = useAuthAgreement();
  const emailInputRef = useRef<InputRef>(null);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const divider = (
    <Divider>
      <Text fontSize={12} type={'secondary'}>
        {t('betterAuth.signin.orContinueWith')}
      </Text>
    </Divider>
  );

  const getProviderLabel = (provider: string) => {
    const normalized = getProviderName(provider);
    const normalizedKey = normalized.replaceAll(/[^\da-z]/gi, '');
    const key = `betterAuth.signin.continueWith${normalizedKey}`;
    return t(key, { defaultValue: `Continue with ${normalized}` });
  };

  const showEmailForm = !disableEmailPassword && !isSocialOnly;
  const footer = (
    <Text fontSize={13} type={'secondary'}>
      <Trans
        i18nKey={'footer.agreement'}
        ns={'auth'}
        components={{
          privacy: (
            <a
              href={PRIVACY_URL}
              style={{ color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {t('footer.privacy')}
            </a>
          ),
          terms: (
            <a
              href={TERMS_URL}
              style={{ color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {t('footer.terms')}
            </a>
          ),
        }}
      />
    </Text>
  );

  return (
    <AuthCard
      footer={footer}
      subtitle={t('signin.subtitle', { appName: brand.name })}
      title={brand.authTitle}
    >
      {!serverConfigInit && (
        <Flexbox gap={12}>
          <Skeleton.Button active block size="large" />
          <Skeleton.Button active block size="large" />
          {divider}
        </Flexbox>
      )}
      {serverConfigInit && oAuthSSOProviders.length > 0 && (
        <Flexbox gap={12}>
          {oAuthSSOProviders.map((provider) => {
            const button = (
              <Button
                block
                key={provider}
                loading={socialLoading === provider}
                size="large"
                icon={
                  <Icon
                    icon={AuthIcons(provider, 18)}
                    style={{ left: 12, position: 'absolute', top: 13 }}
                  />
                }
                onClick={() =>
                  continueWithAgreement(() => {
                    onSocialSignIn(provider);
                  })
                }
              >
                {getProviderLabel(provider)}
              </Button>
            );
            const showLastUsed =
              provider === lastAuthProvider &&
              (oAuthSSOProviders.length > 1 ||
                (oAuthSSOProviders.length === 1 && !disableEmailPassword));
            return showLastUsed ? (
              <Badge.Ribbon
                color="var(--ant-color-info-fill-tertiary)"
                key={provider}
                styles={{ content: { color: 'var(--ant-color-info)' } }}
                text={t('betterAuth.signin.lastUsed')}
              >
                {button}
              </Badge.Ribbon>
            ) : (
              button
            );
          })}
          {showEmailForm && divider}
        </Flexbox>
      )}
      {serverConfigInit && disableEmailPassword && oAuthSSOProviders.length === 0 && (
        <Alert showIcon description={t('betterAuth.signin.ssoOnlyNoProviders')} type="warning" />
      )}
      {showEmailForm && (
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) =>
            continueWithAgreement(() => {
              void onCheckUser(values as { email: string });
            })
          }
        >
          <Form.Item
            name="email"
            style={{ marginBottom: 0 }}
            rules={[
              { message: t('betterAuth.errors.emailRequired'), required: true },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  const trimmedValue = (value as string).trim();
                  if (EMAIL_REGEX.test(trimmedValue) || USERNAME_REGEX.test(trimmedValue)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('betterAuth.errors.emailInvalid')));
                },
              },
            ]}
          >
            <Input
              autoComplete="username"
              inputMode="email"
              placeholder={t('betterAuth.signin.emailPlaceholder')}
              ref={emailInputRef}
              size="large"
              prefix={<Icon icon={Mail} style={{ marginInline: 6 }} />}
              style={{ padding: 6 }}
              suffix={
                <Button
                  icon={ChevronRight}
                  loading={loading}
                  title={t('betterAuth.signin.nextStep')}
                  variant={'filled'}
                  onClick={() => form.submit()}
                />
              }
            />
          </Form.Item>
          <AuthAgreement checked={agreementChecked} onChange={setAgreementChecked} />
        </Form>
      )}
      {isSocialOnly && (
        <Alert
          showIcon
          style={{ marginTop: 12 }}
          type="info"
          description={
            <>
              {t('betterAuth.signin.socialOnlyHint')}{' '}
              <a
                className={styles.inlineLink}
                role="button"
                tabIndex={0}
                onClick={onSetPassword}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSetPassword();
                  }
                }}
              >
                {t('betterAuth.signin.setPassword')}
              </a>
            </>
          }
        />
      )}
      {isSocialOnly && (
        <Text align={'center'} fontSize={13} style={{ marginTop: 12 }} type={'secondary'}>
          <a
            className={styles.inlineLink}
            role="button"
            tabIndex={0}
            onClick={onResetEmail}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onResetEmail();
              }
            }}
          >
            {t('betterAuth.signin.emailSent.changeEmail')}
          </a>
        </Text>
      )}
      {!showEmailForm && <AuthAgreement />}
      {showEmailForm && (
        <Text align={'center'} fontSize={13} style={{ marginTop: 16 }} type={'secondary'}>
          {t('betterAuth.signin.noAccount')}{' '}
          <a
            className={styles.inlineLink}
            role="button"
            tabIndex={0}
            onClick={onGoToSignup}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onGoToSignup();
              }
            }}
          >
            {t('betterAuth.signin.signupLink')}
          </a>
        </Text>
      )}
    </AuthCard>
  );
};

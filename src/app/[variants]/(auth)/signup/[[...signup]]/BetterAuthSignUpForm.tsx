'use client';

import { Button, Icon, Input, InputPassword, Text } from '@lobehub/ui';
import { Form } from '@lobehub/ui/form';
import { Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '../../../../../features/AuthCard';
import { trackLoginOrSignupClicked } from '../../../../../features/User/UserLoginOrSignup/trackLoginOrSignupClicked';
import { AuthAgreement } from '../../_layout/AuthAgreement';
import { useSignUp } from './useSignUp';

// Mirrors @rc-component/async-validator's `type: 'email'` rule, which antd ran
// for the pre-migration `{ type: 'email' }` Form.Item rule (pattern + 320-char
// cap). Keeping the exact pattern preserves edge-case acceptance behavior.
const EMAIL_PATTERN =
  // eslint-disable-next-line regexp/no-unused-capturing-group, regexp/prefer-d, regexp/strict, regexp/use-ignore-case -- verbatim copy of @rc-component/async-validator's email pattern keeps the pre-migration `type: 'email'` rule semantics
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+\.)+[a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]{2,}))$/;

// antd Form.Item's default bottom margin (24px), preserved on FormKit Fields
// because Field has no spacing of its own.
const FIELD_STYLE = { gap: 0, paddingBlock: '0 24px' };

const BetterAuthSignUpForm = () => {
  const { agreementChecked, businessElement, form, loading, setAgreementChecked } = useSignUp();

  const { t } = useTranslation('auth');
  const searchParams = useSearchParams();

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const email = searchParams.get('email');
    if (email) {
      form.setValue('email', email);
      passwordInputRef.current?.focus();
    } else {
      emailInputRef.current?.focus();
    }
  }, [searchParams, form]);

  const footer = (
    <Text>
      {t('betterAuth.signup.hasAccount')}{' '}
      <Link
        href={`/signin?${searchParams.toString()}`}
        onClick={(event) => {
          event.preventDefault();
          void trackLoginOrSignupClicked({ spm: 'signup.go_to_signin.click' }).finally(() => {
            // auth 域是独立 SPA 入口（entry.auth.html），与主应用不共享路由实例；
            // 整页跳转保证 auth 会话状态从干净状态重建（与 useSignIn onSuccess 先例一致）。
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cross-entry auth SPA navigation requires a full page load
            window.location.href = `/signin?${searchParams.toString()}`;
          });
        }}
      >
        {t('betterAuth.signup.signinLink')}
      </Link>
    </Text>
  );

  return (
    <AuthCard
      footer={footer}
      subtitle={t('betterAuth.signup.subtitle')}
      title={t('betterAuth.signup.title')}
    >
      <Form form={form} gap={0} layout="vertical">
        <Form.Field
          name="email"
          style={FIELD_STYLE}
          validate={(value: string) => {
            if (!value) return t('betterAuth.errors.emailRequired');
            if (value.length > 320 || !EMAIL_PATTERN.test(value))
              return t('betterAuth.errors.emailInvalid');
          }}
        >
          <Input
            autoComplete="email"
            inputMode="email"
            placeholder={t('betterAuth.signup.emailPlaceholder')}
            ref={emailInputRef}
            size="large"
            type="email"
            prefix={
              <Icon
                icon={Mail}
                style={{
                  marginInline: 6,
                }}
              />
            }
          />
        </Form.Field>
        <Form.Field
          name="password"
          style={FIELD_STYLE}
          validate={(value: string) => {
            if (!value) return t('betterAuth.errors.passwordRequired');
            if (value.length < 8) return t('betterAuth.errors.passwordMinLength');
            if (value.length > 64) return t('betterAuth.errors.passwordMaxLength');
            if (!/[a-z]/i.test(value) || !/\d/.test(value))
              return t('betterAuth.errors.passwordFormat');
          }}
        >
          <InputPassword
            autoComplete="new-password"
            placeholder={t('betterAuth.signup.passwordPlaceholder')}
            ref={passwordInputRef}
            size="large"
            prefix={
              <Icon
                icon={Lock}
                style={{
                  marginInline: 6,
                }}
              />
            }
          />
        </Form.Field>
        {/* J4: antd's `dependencies={['password']}` re-validation maps to
            FormKit's `deps`; `values` is the live engine snapshot at validation
            time, so the cross-field comparison reads the same source. */}
        <Form.Field
          deps={['password']}
          name="confirmPassword"
          style={FIELD_STYLE}
          validate={(value: string, values: { password: string }) => {
            if (!value) return t('betterAuth.errors.confirmPasswordRequired');
            if (values.password !== value) return t('betterAuth.errors.passwordMismatch');
          }}
        >
          <InputPassword
            autoComplete="new-password"
            placeholder={t('betterAuth.signup.confirmPasswordPlaceholder')}
            size="large"
            prefix={
              <Icon
                icon={Lock}
                style={{
                  marginInline: 6,
                }}
              />
            }
          />
        </Form.Field>

        {businessElement}

        <AuthAgreement checked={agreementChecked} onChange={setAgreementChecked} />
        <Button block htmlType="submit" loading={loading} size="large" type="primary">
          {t('betterAuth.signup.submit')}
        </Button>
      </Form>
    </AuthCard>
  );
};

export default BetterAuthSignUpForm;

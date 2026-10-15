'use client';

import { Icon } from '@lobehub/ui';
import { Button, Input, InputPassword, Text } from '@lobehub/ui/base-ui';
// eslint-disable-next-line no-restricted-imports -- antd 受控 Form（Form.useForm/setFieldsValue/dependencies 跨字段校验）与受控字段绑定，无 base-ui 行为不变等价物；迁 FormKit 属另行立项。
import { Form } from 'antd';
import { Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '../../../../../features/AuthCard';
import { trackLoginOrSignupClicked } from '../../../../../features/User/UserLoginOrSignup/trackLoginOrSignupClicked';
import { AuthAgreement, useAuthAgreement } from '../../_layout/AuthAgreement';
import { useSignUp } from './useSignUp';

const BetterAuthSignUpForm = () => {
  const { form, loading, onSubmit, businessElement } = useSignUp();

  const { t } = useTranslation('auth');
  const searchParams = useSearchParams();
  const { agreementChecked, continueWithAgreement, setAgreementChecked } = useAuthAgreement();

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const email = searchParams.get('email');
    if (email) {
      form.setFieldsValue({ email });
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
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) =>
          continueWithAgreement(() => {
            void onSubmit(values);
          })
        }
      >
        <Form.Item
          name="email"
          rules={[
            { message: t('betterAuth.errors.emailRequired'), required: true },
            { message: t('betterAuth.errors.emailInvalid'), type: 'email' },
          ]}
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
        </Form.Item>
        <Form.Item
          name="password"
          rules={[
            { message: t('betterAuth.errors.passwordRequired'), required: true },
            { message: t('betterAuth.errors.passwordMinLength'), min: 8 },
            { max: 64, message: t('betterAuth.errors.passwordMaxLength') },
            {
              message: t('betterAuth.errors.passwordFormat'),
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                const hasLetter = /[a-z]/i.test(value);
                const hasNumber = /\d/.test(value);
                return hasLetter && hasNumber ? Promise.resolve() : Promise.reject();
              },
            },
          ]}
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
        </Form.Item>
        <Form.Item
          dependencies={['password']}
          name="confirmPassword"
          rules={[
            { message: t('betterAuth.errors.confirmPasswordRequired'), required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t('betterAuth.errors.passwordMismatch')));
              },
            }),
          ]}
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
        </Form.Item>

        {businessElement}

        <AuthAgreement checked={agreementChecked} onChange={setAgreementChecked} />
        <Form.Item>
          <Button block htmlType="submit" loading={loading} size="large" type="primary">
            {t('betterAuth.signup.submit')}
          </Button>
        </Form.Item>
      </Form>
    </AuthCard>
  );
};

export default BetterAuthSignUpForm;

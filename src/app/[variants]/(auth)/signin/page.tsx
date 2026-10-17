'use client';

import { Suspense } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';

import { SignInEmailSentStep } from './SignInEmailSentStep';
import { SignInEmailStep } from './SignInEmailStep';
import { SignInPasswordStep } from './SignInPasswordStep';
import { useSignIn } from './useSignIn';

const SignInPage = () => {
  const {
    agreementChecked,
    continueWithAgreement,
    disableEmailPassword,
    email,
    form,
    handleBackFromSent,
    handleBackToEmail,
    handleGoToSignup,
    handleForgotPassword,
    handleResendEmail,
    handleSocialSignIn,
    isSocialOnly,
    lastAuthProvider,
    loading,
    oAuthSSOProviders,
    serverConfigInit,
    setAgreementChecked,
    socialLoading,
    sending,
    sentInfo,
    step,
  } = useSignIn();

  return (
    <Suspense fallback={<Loading debugId={'Signin'} />}>
      {step === 'emailSent' && sentInfo ? (
        <SignInEmailSentStep
          email={sentInfo.email}
          sending={sending}
          type={sentInfo.type}
          onBack={handleBackFromSent}
          onResend={handleResendEmail}
        />
      ) : step === 'email' ? (
        <SignInEmailStep
          agreementChecked={agreementChecked}
          continueWithAgreement={continueWithAgreement}
          disableEmailPassword={disableEmailPassword}
          form={form as any}
          isSocialOnly={isSocialOnly}
          lastAuthProvider={lastAuthProvider}
          loading={loading}
          oAuthSSOProviders={oAuthSSOProviders}
          serverConfigInit={serverConfigInit}
          setAgreementChecked={setAgreementChecked}
          socialLoading={socialLoading}
          onGoToSignup={handleGoToSignup}
          onResetEmail={handleBackToEmail}
          onSetPassword={handleForgotPassword}
          onSocialSignIn={handleSocialSignIn}
        />
      ) : (
        <SignInPasswordStep
          email={email}
          forgotLoading={sending}
          form={form as any}
          loading={loading}
          onBackToEmail={handleBackToEmail}
          onForgotPassword={handleForgotPassword}
        />
      )}
    </Suspense>
  );
};

export default SignInPage;

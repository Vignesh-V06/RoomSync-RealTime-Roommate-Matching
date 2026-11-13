import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiCheckCircle, FiAlertCircle, FiLock, FiMail, FiRefreshCw, FiShield } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../api';
import AuthLayout from '../components/AuthLayout';

const getResetErrorMessage = (error, fallback) => {
  if (!error.response) {
    return 'Cannot reach the RoomSync backend. Start it with npm start in the backend folder and check VITE_API_BASE_URL.';
  }
  if (error.response.status === 404 && !error.response.data?.message) {
    return 'The password-reset API route was not found. Pull the latest branch and restart the backend server.';
  }
  if (error.response.status >= 500 && !error.response.data?.message) {
    return 'The RoomSync server failed to process this request. Check the backend terminal for the exact error.';
  }
  return error.response.data?.message || fallback;
};

const ForgotPassword = () => {
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [diagnostics, setDiagnostics] = useState(null);
  const [checkingDiagnostics, setCheckingDiagnostics] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState('');
  const navigate = useNavigate();

  const handleCheckSetup = async () => {
    setCheckingDiagnostics(true);
    setDiagnosticsError('');
    try {
      const { data } = await api.get('/auth/password-reset/diagnostics');
      setDiagnostics(data);
    } catch (err) {
      setDiagnostics(null);
      setDiagnosticsError(getResetErrorMessage(err, 'Could not run the local email setup check.'));
    } finally {
      setCheckingDiagnostics(false);
    }
  };

  const handleRequestOtp = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/password-reset/request-otp', {
        email: email.trim()
      });
      setStep('verify');
      setNotice(data.message || 'Verification code sent to ' + email.trim() + '. Check your inbox and spam folder.');
    } catch (err) {
      setError(getResetErrorMessage(err, 'We could not start password reset. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/password-reset/request-otp', {
        email: email.trim()
      });
      setNotice(data.message || 'A new verification code has been sent to ' + email.trim() + '. Check your inbox and spam folder.');
    } catch (err) {
      setError(getResetErrorMessage(err, 'We could not resend the code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (event) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the six-digit verification code from your email.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/password-reset/verify-otp', {
        email: email.trim(),
        otp,
        newPassword
      });
      toast.success('Password reset successfully. You can now sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(getResetErrorMessage(err, 'We could not verify the code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={step === 'request' ? 'Reset your password.' : 'Check your inbox.'}
      description={step === 'request'
        ? 'We will send a one-time verification code to your registered email.'
        : 'Enter the six-digit code and choose a new password.'}
      footer={<>Back to your account? <Link to="/login">Sign in</Link></>}
    >
      <div className="reset-step-indicator" aria-label={step === 'request' ? 'Step 1 of 2: Request a code' : 'Step 2 of 2: Verify and reset'}>
        <span className={step === 'request' ? 'is-current' : 'is-complete'}>1 <span>Request code</span></span>
        <i aria-hidden="true" />
        <span className={step === 'verify' ? 'is-current' : ''}>2 <span>Verify & reset</span></span>
      </div>
      <p className="reset-step-explainer">
        {step === 'request'
          ? 'After the email is sent successfully, this form will reveal the six-digit code field and your new-password field.'
          : 'Enter the six-digit code sent to ' + email + ' below, then choose your new password.'}
      </p>

      <div className="auth-security-notice" id="reset-security-note">
        <FiShield aria-hidden="true" />
        <p>
          <strong>Secure email verification</strong>
          <span>Codes expire after 10 minutes, can only be used once, and are locked after five incorrect attempts.</span>
        </p>
      </div>

      {import.meta.env.DEV && (
        <div className="reset-diagnostics">
          <button
            type="button"
            className="reset-diagnostics-trigger"
            onClick={handleCheckSetup}
            disabled={checkingDiagnostics}
          >
            <FiRefreshCw className={checkingDiagnostics ? 'is-spinning' : ''} />
            {checkingDiagnostics ? 'Checking local setup…' : 'Check email setup'}
          </button>
          {diagnosticsError && <p className="reset-diagnostics-error" role="alert">{diagnosticsError}</p>}
          {diagnostics && (
            <div className="reset-diagnostics-panel" aria-live="polite">
              <strong>Local password-reset readiness</strong>
              {[
                ['PostgreSQL is reachable', diagnostics.postgresConnected],
                ['OTP table exists', diagnostics.otpTableExists],
                ['OTP table columns are correct', diagnostics.otpColumnsReady],
                ['OTP secret is configured', diagnostics.otpSecretConfigured],
                ...(diagnostics.emailProvider === 'apps_script' ? [
                  ['Apps Script Web App URL is configured', diagnostics.appsScriptUrlConfigured],
                  ['Apps Script shared secret is configured', diagnostics.appsScriptSecretConfigured]
                ] : diagnostics.emailProvider === 'gmail' ? [
                  ['Gmail account is configured', diagnostics.gmailSmtpUserConfigured],
                  ['Google App Password is configured', diagnostics.gmailAppPasswordConfigured],
                  ...(diagnostics.smtpConnectionVerified === null ? [] : [
                    ['Gmail SMTP authentication works', diagnostics.smtpConnectionVerified]
                  ])
                ] : diagnostics.emailProvider === 'resend' ? [
                  ['Resend API key is configured', diagnostics.resendApiKeyConfigured],
                  ['Resend sender is configured', diagnostics.resendSenderConfigured]
                ] : [
                  ['Supported email provider selected', false]
                ])
              ].map(([label, ready]) => (
                <div className="reset-diagnostics-row" key={label}>
                  {ready ? <FiCheckCircle /> : <FiAlertCircle />}
                  <span>{label}</span>
                  <b>{ready ? 'Ready' : 'Missing'}</b>
                </div>
              ))}
              {diagnostics.missingOtpColumns?.length > 0 && (
                <p className="reset-diagnostics-error">Missing OTP columns: {diagnostics.missingOtpColumns.join(', ')}. Check the OTP migration.</p>
              )}
              {diagnostics.databaseErrorCode && (
                <p className="reset-diagnostics-error">PostgreSQL error: {diagnostics.databaseErrorCode}. Check DATABASE_URL and DB_SCHEMA.</p>
              )}
              {!diagnostics.postgresConnected && (
                <p className="reset-diagnostics-error">Confirm DATABASE_URL and DB_SCHEMA in the backend environment, and verify the Neon database is reachable.</p>
              )}
              {diagnostics.postgresConnected && !diagnostics.otpTableExists && (
                <p className="reset-diagnostics-error">Check that password_reset_otps exists in the configured PostgreSQL schema. See backend/schema.postgres.sql.</p>
              )}
              {diagnostics.emailProvider && (
                <p className="reset-diagnostics-hint">
                  Selected email provider: <strong>{diagnostics.emailProvider.toUpperCase()}</strong>
                </p>
              )}
              {diagnostics.notes?.map((note) => (
                <p className="reset-diagnostics-hint" key={note}>{note}</p>
              ))}
              <small>Only configuration status is shown. Secret values and API keys are never displayed.</small>
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={step === 'request' ? handleRequestOtp : handleVerifyAndReset}
        className="auth-form"
        noValidate
        aria-describedby="reset-security-note"
      >
        {error && <div className="auth-error" role="alert">{error}</div>}
        {notice && <div className="auth-success" role="status">{notice}</div>}

        <div className="auth-field">
          <label htmlFor="reset-email">Registered email address</label>
          <div className="auth-input-wrap">
            <FiMail aria-hidden="true" />
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              disabled={step === 'verify'}
              onChange={(event) => { setEmail(event.target.value); setError(''); }}
              placeholder="you@example.com"
            />
          </div>
        </div>

        {step === 'verify' && (
          <>
            <div className="auth-field">
              <label htmlFor="reset-otp">Six-digit verification code</label>
              <div className="auth-input-wrap">
                <FiShield aria-hidden="true" />
                <input
                  id="reset-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(event) => {
                    setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  placeholder="Enter the code from your email"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reset-new-password">New password</label>
              <div className="auth-input-wrap">
                <FiLock aria-hidden="true" />
                <input
                  id="reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={newPassword}
                  onChange={(event) => { setNewPassword(event.target.value); setError(''); }}
                  placeholder="At least 8 characters"
                />
              </div>
            </div>

            <div className="reset-secondary-actions">
              <button type="button" onClick={handleResendOtp} disabled={loading}>
                Resend code
              </button>
              <button type="button" onClick={() => { setStep('request'); setOtp(''); setNewPassword(''); setError(''); setNotice(''); }}>
                Change email
              </button>
            </div>
          </>
        )}

        <button
          type="submit"
          className="auth-submit"
          disabled={loading || !email.trim() || (step === 'verify' && (otp.length !== 6 || newPassword.length < 8))}
        >
          {loading
            ? <span>{step === 'request' ? 'Sending code…' : 'Verifying code…'}</span>
            : <><span>{step === 'request' ? 'Send verification code' : 'Reset password'}</span><FiArrowRight aria-hidden="true" /></>}
        </button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;

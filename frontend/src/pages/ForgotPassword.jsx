import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiLock, FiMail, FiShield } from 'react-icons/fi';
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
  const navigate = useNavigate();

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
      setNotice(data.message || 'If an account exists for that email, a verification code will be sent shortly.');
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
      setNotice(data.message || 'If an account exists for that email, a verification code will be sent shortly. Wait a minute before requesting another code.');
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
      <div className="auth-security-notice" id="reset-security-note">
        <FiShield aria-hidden="true" />
        <p>
          <strong>Secure email verification</strong>
          <span>Codes expire after 10 minutes, can only be used once, and are locked after five incorrect attempts.</span>
        </p>
      </div>

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
          <span>{loading
            ? (step === 'request' ? 'Sending code…' : 'Verifying code…')
            : (step === 'request' ? 'Send verification code' : 'Reset password')}</span>
          {!loading && <FiArrowRight aria-hidden="true" />}
        </button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;

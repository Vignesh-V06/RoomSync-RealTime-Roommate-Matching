import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiArrowRight, FiEye, FiEyeOff, FiLock, FiMail,
  FiPhone, FiShield, FiUser
} from 'react-icons/fi';
import api from '../api';
import AuthLayout from '../components/AuthLayout';

const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState('details');
  const [otp, setOtp] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const registrationPayload = () => ({
    name: formData.name.trim(),
    email: formData.email.trim(),
    password: formData.password,
    phone: formData.phone.trim()
  });

  const requestVerificationCode = async () => {
    const { data } = await api.post('/auth/register/request-otp', registrationPayload());
    setOtp('');
    setStep('otp');
    setResendCountdown(Number(data.resend_after_seconds) || 60);
    setError('');
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');

    if (formData.password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await requestVerificationCode();
    } catch (err) {
      setError(err.response?.data?.message || 'We could not send your verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the six-digit code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/register/verify-otp', {
        email: formData.email.trim(),
        otp
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/profile', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'We could not verify that code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError('');
    try {
      await requestVerificationCode();
    } catch (err) {
      if (err.response?.status === 429) setResendCountdown(60);
      setError(err.response?.data?.message || 'We could not resend your verification code.');
    } finally {
      setResending(false);
    }
  };

  const returnToDetails = () => {
    setStep('details');
    setOtp('');
    setError('');
    setResendCountdown(0);
  };

  return (
    <AuthLayout
      title={step === 'details' ? 'Create your account.' : 'Verify your email.'}
      description={step === 'details'
        ? 'Start with a few details. We will verify your email before creating your RoomSync account.'
        : 'Enter the six-digit code we sent to your inbox to finish creating your account.'}
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      <form
        onSubmit={step === 'details' ? handleRegister : handleVerifyOtp}
        className="auth-form auth-register-form"
        noValidate
      >
        {error && <div className="auth-error" role="alert">{error}</div>}

        {step === 'details' ? (
          <>
            <div className="auth-field">
              <label htmlFor="register-name">Full name</label>
              <div className="auth-input-wrap">
                <FiUser aria-hidden="true" />
                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={formData.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="Your name"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-phone">Phone number <span className="auth-optional">OPTIONAL</span></label>
              <div className="auth-input-wrap">
                <FiPhone aria-hidden="true" />
                <input
                  id="register-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={30}
                  value={formData.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-email">Email address</label>
              <div className="auth-input-wrap">
                <FiMail aria-hidden="true" />
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={formData.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-password">Password</label>
              <div className="auth-input-wrap">
                <FiLock aria-hidden="true" />
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              <small className="auth-field-hint">Use at least 8 characters.</small>
            </div>

            <div className="auth-field">
              <label htmlFor="register-confirm-password">Confirm password</label>
              <div className="auth-input-wrap">
                <FiLock aria-hidden="true" />
                <input
                  id="register-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={(event) => updateField('confirmPassword', event.target.value)}
                  placeholder="Enter your password again"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                >
                  {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={loading || !formData.name.trim() || !formData.email.trim() || !formData.password || !formData.confirmPassword}
            >
              <span>{loading ? 'Sending verification code…' : 'Continue to email verification'}</span>
              {!loading && <FiArrowRight aria-hidden="true" />}
            </button>
            <p className="auth-consent">We will email you a one-time code. Your account is created only after the code is verified.</p>
          </>
        ) : (
          <div className="register-otp-panel">
            <span className="register-otp-icon"><FiShield aria-hidden="true" /></span>
            <div className="register-otp-copy">
              <strong>Check your email</strong>
              <span>We sent a verification code to</span>
              <b>{formData.email.trim()}</b>
            </div>
            <div className="auth-field">
              <label htmlFor="register-otp">Email verification code</label>
              <div className="auth-input-wrap register-otp-input-wrap">
                <FiMail aria-hidden="true" />
                <input
                  id="register-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={otp}
                  onChange={(event) => {
                    setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  placeholder="Enter 6-digit code"
                  aria-describedby="register-otp-hint"
                />
              </div>
              <small className="auth-field-hint" id="register-otp-hint">The code expires in 10 minutes and can only be used once.</small>
            </div>
            <button type="submit" className="auth-submit" disabled={loading || otp.length !== 6}>
              <span>{loading ? 'Verifying…' : 'Verify email & create account'}</span>
              {!loading && <FiArrowRight aria-hidden="true" />}
            </button>
            <div className="register-otp-actions">
              <button type="button" className="register-otp-back" onClick={returnToDetails} disabled={loading || resending}>
                <FiArrowLeft aria-hidden="true" /> Edit details
              </button>
              <button type="button" className="register-otp-resend" onClick={handleResendOtp} disabled={loading || resending || resendCountdown > 0}>
                {resending ? 'Sending…' : resendCountdown > 0 ? 'Resend in ' + resendCountdown + 's' : 'Resend code'}
              </button>
            </div>
          </div>
        )}
      </form>
    </AuthLayout>
  );
};

export default Register;

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiAlertTriangle, FiLock, FiMail } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../api';
import AuthLayout from '../components/AuthLayout';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password-direct', { email: email.trim(), newPassword });
      toast.success('Password updated. You can now sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'We could not update the password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password."
      description="Update the password associated with your RoomSync account."
      footer={<>Back to your account? <Link to="/login">Sign in</Link></>}
    >
      <div className="auth-security-notice" id="reset-security-note">
        <FiAlertTriangle aria-hidden="true" />
        <p>
          <strong>Development reset flow</strong>
          <span>A verified email or OTP reset flow is not configured yet. The legacy email-only password-reset endpoint is disabled by default to protect accounts.</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form" noValidate aria-describedby="reset-security-note">
        {error && <div className="auth-error" role="alert">{error}</div>}

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
              onChange={(event) => { setEmail(event.target.value); setError(''); }}
              placeholder="you@example.com"
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
              required
              value={newPassword}
              onChange={(event) => { setNewPassword(event.target.value); setError(''); }}
              placeholder="At least 8 characters"
            />
          </div>
        </div>

        <button type="submit" className="auth-submit" disabled={loading || !email.trim() || !newPassword}>
          <span>{loading ? 'Updating password…' : 'Update password'}</span>
          {!loading && <FiArrowRight aria-hidden="true" />}
        </button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;

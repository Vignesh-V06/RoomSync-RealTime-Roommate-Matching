import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiMail, FiUser } from 'react-icons/fi';
import api from '../api';
import AuthLayout from '../components/AuthLayout';

const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
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
      // Do not send a client-selected role. New accounts are students by default.
      const { data } = await api.post('/auth/register', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/profile', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'We could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account."
      description="Start with a few details. You can add your living preferences to your profile next."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      <form onSubmit={handleRegister} className="auth-form auth-register-form" noValidate>
        {error && <div className="auth-error" role="alert">{error}</div>}

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
          <span>{loading ? 'Creating account…' : 'Create account'}</span>
          {!loading && <FiArrowRight aria-hidden="true" />}
        </button>
        <p className="auth-consent">By creating an account, you agree to use RoomSync respectfully and provide accurate profile details.</p>
      </form>
    </AuthLayout>
  );
};

export default Register;

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiMail } from 'react-icons/fi';
import api from '../api';
import AuthLayout from '../components/AuthLayout';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/profile', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'We could not sign you in. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back."
      description="Sign in to pick up where you left off."
      footer={<>New to RoomSync? <Link to="/register">Create an account</Link></>}
    >
      <form onSubmit={handleLogin} className="auth-form" noValidate>
        {error && <div className="auth-error" role="alert">{error}</div>}

        <div className="auth-field">
          <label htmlFor="login-email">Email address</label>
          <div className="auth-input-wrap">
            <FiMail aria-hidden="true" />
            <input
              id="login-email"
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
          <div className="auth-label-row">
            <label htmlFor="login-password">Password</label>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
          <div className="auth-input-wrap">
            <FiLock aria-hidden="true" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError(''); }}
              placeholder="Enter your password"
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
        </div>

        <button type="submit" className="auth-submit" disabled={loading || !email.trim() || !password}>
          <span>{loading ? 'Signing in…' : 'Sign in'}</span>
          {!loading && <FiArrowRight aria-hidden="true" />}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Login;

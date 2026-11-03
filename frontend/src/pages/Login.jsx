import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/register');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--pale-sky) 0%, var(--frozen-water) 100%)'
    }}>
      <div style={{
        background: 'var(--card-bg)',
        padding: '36px',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(27, 73, 101, 0.15)',
        width: '100%',
        maxWidth: '420px',
        border: '1px solid var(--pacific-blue)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: 'var(--yale-blue)', marginBottom: '8px' }}>Operator Portal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Automatic Parcel Sorting & Dispatch</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(230, 57, 70, 0.1)',
            color: 'var(--error)',
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '14px',
            border: '1px solid rgba(230, 57, 70, 0.3)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--yale-blue)' }}>
              Operator Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--yale-blue)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--yale-blue)',
              color: '#ffffff',
              padding: '12px',
              fontSize: '15px',
              marginTop: '8px'
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In as Operator'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;


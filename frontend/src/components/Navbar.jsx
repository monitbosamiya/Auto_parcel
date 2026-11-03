import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { label: 'Register & Validate (M1-2)', path: '/register' },
    { label: 'Incoming Queue (M3)', path: '/queue' }
  ];

  return (
    <header style={{
      background: 'var(--yale-blue)',
      color: '#fff',
      padding: '12px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Parcel Simulator</h1>
        <nav style={{ display: 'flex', gap: '8px' }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  background: isActive ? 'var(--pacific-blue)' : 'transparent',
                  color: isActive ? 'var(--yale-blue)' : 'var(--pale-sky)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span style={{ fontSize: '13px', color: 'var(--pale-sky)' }}>
          Operator: <strong>{user?.username}</strong>
        </span>
        <button
          onClick={logout}
          style={{
            background: 'transparent',
            border: '1px solid var(--frozen-water)',
            color: '#fff',
            padding: '5px 12px',
            fontSize: '12px'
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Navbar;


import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import { Link } from 'react-router-dom';

const IncomingQueue = () => {
  const [queueData, setQueueData] = useState({ size: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  const fetchQueue = async () => {
    try {
      const res = await api.get('/queue/status');
      if (res.data.success) {
        setQueueData(res.data.data);
      }
    } catch (err) {
      console.error('Fetch queue error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDequeue = async () => {
    setActionMsg('');
    try {
      const res = await api.post('/queue/dequeue');
      if (res.data.success) {
        setActionMsg(`✓ Dequeued: ${res.data.data.tracking_id} (Status advanced to Sorted)`);
        fetchQueue();
      }
    } catch (err) {
      setActionMsg(err.response?.data?.message || 'Dequeue failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      {/* Header */}
      <Navbar />

      {/* Main Content */}
      <main style={{ maxWidth: '880px', margin: '30px auto', padding: '0 16px' }}>
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: '10px',
          border: '1px solid var(--frozen-water)',
          boxShadow: '0 4px 14px rgba(27, 73, 101, 0.08)',
          padding: '24px'
        }}>
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h2 style={{ color: 'var(--yale-blue)', fontSize: '18px' }}>Warehouse Incoming Queue (Custom FIFO Queue)</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Parcels ordered by arrival time. Head is processed first.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{
                background: 'var(--pale-sky)',
                color: 'var(--yale-blue)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '13px'
              }}>
                Queue Size: {queueData.size}
              </span>
              <button
                onClick={handleDequeue}
                disabled={queueData.size === 0}
                style={{
                  background: queueData.size === 0 ? '#ccc' : 'var(--pacific-blue)',
                  color: 'var(--yale-blue)',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Dequeue Next (Safe FIFO)
              </button>
            </div>
          </div>

          {actionMsg && (
            <div style={{ background: 'rgba(42, 157, 143, 0.1)', color: 'var(--success)', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', border: '1px solid var(--success)' }}>
              {actionMsg}
            </div>
          )}

          {/* Visual Queue representation */}
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading queue state...</p>
          ) : queueData.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <p>The incoming queue is currently empty.</p>
              <Link to="/register" style={{ color: 'var(--pacific-blue)', fontSize: '13px', fontWeight: 600, display: 'inline-block', marginTop: '8px' }}>
                Register parcels to populate the queue &rarr;
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--frozen-water)', color: 'var(--yale-blue)' }}>
                    <th style={{ padding: '10px 12px' }}>Position</th>
                    <th style={{ padding: '10px 12px' }}>Tracking ID</th>
                    <th style={{ padding: '10px 12px' }}>Route ID</th>
                    <th style={{ padding: '10px 12px' }}>Arrival Time</th>
                    <th style={{ padding: '10px 12px' }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {queueData.items.map((item, idx) => (
                    <tr key={item.parcel_id} style={{ borderBottom: '1px solid #eef2f5' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--yale-blue)' }}>
                        {idx === 0 ? '🥇 FRONT (Next)' : `#${idx + 1}`}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--yale-blue)' }}>
                        {item.tracking_id}
                      </td>
                      <td style={{ padding: '10px 12px' }}>Route #{item.route_id}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        {new Date(item.arrival_time).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          background: idx === 0 ? 'var(--pacific-blue)' : 'var(--pale-sky)',
                          color: 'var(--yale-blue)',
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: 600
                        }}>
                          {idx === 0 ? 'Peek / Dequeue' : 'Waiting in FIFO'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default IncomingQueue;


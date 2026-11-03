
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import api from '../services/api';
import Navbar from '../components/Navbar';

const IncomingQueue = () => {
  const [queueData, setQueueData] = useState({
    size: 0,
    items: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchQueue = async () => {
    try {
      const res = await api.get('/queue/status');

      if (res.data.success) {
        setQueueData(res.data.data);
      }

      setError('');
    } catch (err) {
      console.error('Fetch queue error:', err);
      setError(
        err.response?.data?.message || 'Unable to fetch incoming queue.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();

    const interval = setInterval(fetchQueue, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-main)'
    }}>
      <Navbar />

      <main style={{
        maxWidth: '1000px',
        margin: '30px auto',
        padding: '0 16px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '10px',
          border: '1px solid var(--frozen-water)',
          padding: '24px'
        }}>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px',
            marginBottom: '22px'
          }}>
            <div>
              <h2 style={{
                color: 'var(--yale-blue)',
                fontSize: '20px'
              }}>
                Warehouse Incoming Queue
              </h2>

              <p style={{
                color: 'var(--text-muted)',
                fontSize: '13px',
                marginTop: '6px'
              }}>
                Parcels waiting for destination sorting, arranged by arrival time.
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{
                background: 'var(--pale-sky)',
                color: 'var(--yale-blue)',
                padding: '8px 12px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '13px'
              }}>
                Queue Size: {queueData.size}
              </span>

              <button
                onClick={fetchQueue}
                style={{
                  padding: '9px',
                  background: 'var(--frozen-water)',
                  color: 'var(--yale-blue)'
                }}
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {error && (
            <p style={{
              color: 'var(--error)',
              background: '#fff0f0',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '15px',
              fontSize: '13px'
            }}>
              {error}
            </p>
          )}

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>
              Loading queue...
            </p>
          ) : queueData.items.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 10px'
            }}>
              <h3 style={{ color: 'var(--yale-blue)' }}>
                Incoming Queue is Empty
              </h3>

              <p style={{
                color: 'var(--text-muted)',
                fontSize: '13px',
                marginTop: '8px'
              }}>
                Register parcels to populate the FIFO queue.
              </p>

              <Link
                to="/register"
                style={{
                  display: 'inline-block',
                  marginTop: '15px',
                  color: 'var(--yale-blue)',
                  fontWeight: 600
                }}
              >
                Register Parcels →
              </Link>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                  textAlign: 'left'
                }}>
                  <thead>
                    <tr style={{
                      background: 'var(--frozen-water)',
                      color: 'var(--yale-blue)'
                    }}>
                      {[
                        'Position',
                        'Tracking ID',
                        'Route ID',
                        'Arrival Time',
                        'Queue Status'
                      ].map((heading) => (
                        <th key={heading} style={{
                          padding: '12px'
                        }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {queueData.items.map((item, index) => (
                      <tr
                        key={item.parcel_id}
                        style={{
                          borderBottom: '1px solid #eef2f5'
                        }}
                      >
                        <td style={{ padding: '12px' }}>
                          {index === 0 ? 'HEAD (Next)' : `#${index + 1}`}
                        </td>

                        <td style={{
                          padding: '12px',
                          fontFamily: 'monospace',
                          fontWeight: 600
                        }}>
                          {item.tracking_id}
                        </td>

                        <td style={{ padding: '12px' }}>
                          Route #{item.route_id}
                        </td>

                        <td style={{
                          padding: '12px',
                          color: 'var(--text-muted)'
                        }}>
                          {new Date(item.arrival_time).toLocaleString()}
                        </td>

                        <td style={{ padding: '12px' }}>
                          <span style={{
                            background: index === 0
                              ? 'var(--pacific-blue)'
                              : 'var(--pale-sky)',
                            padding: '5px 9px',
                            borderRadius: '5px',
                            fontSize: '11px',
                            fontWeight: 600
                          }}>
                            {index === 0 ? 'Next to Sort' : 'Waiting'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '20px'
              }}>
                <Link
                  to="/sorting"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--yale-blue)',
                    color: 'white',
                    padding: '11px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  Go to Destination Sorting
                  <ArrowRight size={16} />
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default IncomingQueue;

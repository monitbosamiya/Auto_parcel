
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  ArrowRight,
  Package,
  Truck,
  Layers,
  Search,
  ArrowDownToLine,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

import api from '../services/api';
import Navbar from '../components/Navbar';

const DestinationGroups = () => {
  const [groups, setGroups] = useState([]);
  const [queueSize, setQueueSize] = useState(0);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');

  // Fetch destination groups and incoming queue status
  const fetchData = useCallback(async () => {
    try {
      setError('');

      const [groupsResponse, queueResponse] = await Promise.all([
        api.get('/sorting/groups'),
        api.get('/queue/status')
      ]);

      if (groupsResponse.data.success) {
        setGroups(groupsResponse.data.data || []);
      }

      if (queueResponse.data.success) {
        setQueueSize(queueResponse.data.data.size || 0);
      }
    } catch (err) {
      console.error('Destination sorting fetch error:', err);
      setError(
        err.response?.data?.message ||
        'Unable to load destination sorting data.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Process the next parcel from FIFO queue
  const handleProcessNext = async () => {
    if (processing || queueSize === 0) return;

    setProcessing(true);
    setMessage(null);
    setError('');

    try {
      const response = await api.post('/sorting/process-next');

      if (response.data.success) {
        const parcel = response.data.data.parcel;

        setMessage({
          type: 'success',
          text: `${parcel.tracking_id} successfully added to ${response.data.data.group_name}.`
        });

        await fetchData();
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to process the next parcel.'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Process all parcels from FIFO queue
  const handleProcessAll = async () => {
    if (processing || queueSize === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to sort all ${queueSize} waiting parcels?`
    );

    if (!confirmed) return;

    setProcessing(true);
    setMessage(null);
    setError('');

    try {
      const response = await api.post('/sorting/process-all');

      if (response.data.success) {
        setMessage({
          type: 'success',
          text: response.data.message
        });

        await fetchData();
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to process all parcels.'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Search destination groups and parcels
  const filteredGroups = groups.filter((group) => {
    const query = search.toLowerCase();

    const groupMatches =
      String(group.route_id).includes(query) ||
      (group.group_name || '').toLowerCase().includes(query);

    const parcelMatches = (group.parcels || []).some((parcel) =>
      (parcel.tracking_id || '').toLowerCase().includes(query) ||
      (parcel.destination || '').toLowerCase().includes(query) ||
      (parcel.origin || '').toLowerCase().includes(query)
    );

    return groupMatches || parcelMatches;
  });

  const totalSorted = groups.reduce(
    (total, group) => total + (group.parcel_count || 0),
    0
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-main)'
    }}>
      <Navbar />

      <main style={{
        maxWidth: '1200px',
        margin: '30px auto',
        padding: '0 20px'
      }}>

        {/* Page heading */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
          marginBottom: '24px'
        }}>
          <div>
            <h2 style={{
              fontSize: '24px',
              color: 'var(--yale-blue)',
              marginBottom: '6px'
            }}>
              Destination Sorting
            </h2>

            <p style={{
              color: 'var(--text-muted)',
              fontSize: '14px'
            }}>
              Organize incoming parcels into route-wise destination groups.
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 15px',
              background: 'white',
              color: 'var(--yale-blue)',
              border: '1px solid var(--frozen-water)'
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Statistics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <StatCard
            title="Waiting for Sorting"
            value={queueSize}
            icon={<Package size={23} />}
            color="#e9a23b"
          />

          <StatCard
            title="Destination Groups"
            value={groups.length}
            icon={<Layers size={23} />}
            color="#5fa8d3"
          />

          <StatCard
            title="Parcels Sorted"
            value={totalSorted}
            icon={<Truck size={23} />}
            color="#2a9d8f"
          />
        </div>

        {/* Process queue panel */}
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--frozen-water)',
          borderRadius: '10px',
          padding: '22px',
          marginBottom: '24px',
          boxShadow: '0 4px 14px rgba(27,73,101,0.05)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <div>
              <h3 style={{
                fontSize: '17px',
                color: 'var(--yale-blue)',
                marginBottom: '6px'
              }}>
                Incoming Queue Processing
              </h3>

              <p style={{
                fontSize: '13px',
                color: 'var(--text-muted)'
              }}>
                Process parcels in their FIFO arrival order.
              </p>

              <p style={{
                fontSize: '13px',
                marginTop: '8px',
                fontWeight: 600,
                color: 'var(--yale-blue)'
              }}>
                {queueSize} parcel(s) waiting in queue
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={handleProcessNext}
                disabled={processing || loading || queueSize === 0}
                style={{
                  padding: '10px 16px',
                  background: 'var(--pacific-blue)',
                  color: 'var(--yale-blue)',
                  opacity: processing || queueSize === 0 ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px'
                }}
              >
                <ArrowDownToLine size={16} />
                {processing ? 'Processing...' : 'Process Next'}
              </button>

              <button
                onClick={handleProcessAll}
                disabled={processing || loading || queueSize === 0}
                style={{
                  padding: '10px 16px',
                  background: 'var(--yale-blue)',
                  color: 'white',
                  opacity: processing || queueSize === 0 ? 0.5 : 1
                }}
              >
                Process All
              </button>
            </div>
          </div>

          {message && (
            <div style={{
              marginTop: '18px',
              padding: '12px',
              borderRadius: '6px',
              background: 'rgba(42,157,143,0.1)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px'
            }}>
              <CheckCircle size={17} />
              {message.text}
            </div>
          )}

          {error && (
            <div style={{
              marginTop: '18px',
              padding: '12px',
              borderRadius: '6px',
              background: 'rgba(230,57,70,0.08)',
              color: 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px'
            }}>
              <AlertCircle size={17} />
              {error}
            </div>
          )}
        </div>

        {/* Destination groups heading and search */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '18px'
        }}>
          <div>
            <h3 style={{
              color: 'var(--yale-blue)',
              fontSize: '18px'
            }}>
              Destination Groups
            </h3>

            <p style={{
              color: 'var(--text-muted)',
              fontSize: '13px',
              marginTop: '4px'
            }}>
              Parcels organized according to their destination routes.
            </p>
          </div>

          <div style={{
            position: 'relative',
            width: '280px',
            maxWidth: '100%'
          }}>
            <Search
              size={17}
              style={{
                position: 'absolute',
                left: '11px',
                top: '11px',
                color: 'var(--text-muted)'
              }}
            />

            <input
              type="text"
              placeholder="Search route or tracking ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '36px'
              }}
            />
          </div>
        </div>

        {/* Groups list */}
        {loading ? (
          <div style={{
            background: 'white',
            padding: '40px',
            textAlign: 'center',
            borderRadius: '10px'
          }}>
            Loading destination groups...
          </div>
        ) : filteredGroups.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '45px 20px',
            textAlign: 'center',
            borderRadius: '10px',
            border: '1px solid var(--frozen-water)'
          }}>
            <Layers
              size={40}
              color="var(--text-muted)"
              style={{ marginBottom: '12px' }}
            />

            <h3 style={{ color: 'var(--yale-blue)' }}>
              {search ? 'No matching groups found' : 'No destination groups'}
            </h3>

            <p style={{
              color: 'var(--text-muted)',
              fontSize: '13px',
              marginTop: '8px'
            }}>
              {search
                ? 'Try another tracking ID or destination.'
                : 'Process parcels from the incoming queue to create destination groups.'}
            </p>

            {queueSize > 0 && !search && (
              <button
                onClick={handleProcessNext}
                disabled={processing}
                style={{
                  marginTop: '18px',
                  padding: '10px 16px',
                  background: 'var(--pacific-blue)',
                  color: 'var(--yale-blue)'
                }}
              >
                Start Sorting
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '18px'
          }}>
            {filteredGroups.map((group) => (
              <DestinationGroupCard
                key={group.route_id}
                group={group}
              />
            ))}
          </div>
        )}

        {/* Next module */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: '28px'
        }}>
          <Link
            to="/routes"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--yale-blue)',
              fontWeight: 600,
              fontSize: '14px'
            }}
          >
            Continue to Fleet Management
            <ArrowRight size={17} />
          </Link>
        </div>

      </main>
    </div>
  );
};


// Statistics card
const StatCard = ({ title, value, icon, color }) => (
  <div style={{
    background: 'white',
    padding: '20px',
    borderRadius: '10px',
    border: '1px solid var(--frozen-water)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }}>
    <div>
      <p style={{
        color: 'var(--text-muted)',
        fontSize: '13px',
        marginBottom: '8px'
      }}>
        {title}
      </p>

      <h2 style={{
        color: 'var(--yale-blue)',
        fontSize: '26px'
      }}>
        {value}
      </h2>
    </div>

    <div style={{
      width: '45px',
      height: '45px',
      borderRadius: '10px',
      background: `${color}20`,
      color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {icon}
    </div>
  </div>
);


// Individual destination group card
const DestinationGroupCard = ({ group }) => {
  const parcels = group.parcels || [];

  return (
    <div style={{
      background: 'white',
      border: '1px solid var(--frozen-water)',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 3px 12px rgba(27,73,101,0.04)'
    }}>
      {/* Group header */}
      <div style={{
        background: 'var(--frozen-water)',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div>
          <p style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            marginBottom: '5px'
          }}>
            ROUTE #{group.route_id}
          </p>

          <h3 style={{
            color: 'var(--yale-blue)',
            fontSize: '16px'
          }}>
            {group.group_name || `Route ${group.route_id}`}
          </h3>
        </div>

        <span style={{
          background: 'white',
          color: 'var(--yale-blue)',
          padding: '6px 10px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 700,
          whiteSpace: 'nowrap'
        }}>
          {group.parcel_count} Parcels
        </span>
      </div>

      {/* Parcel list */}
      <div style={{ padding: '15px' }}>
        {parcels.length === 0 ? (
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '13px',
            textAlign: 'center',
            padding: '15px'
          }}>
            No parcels in this group.
          </p>
        ) : (
          parcels.map((parcel, index) => (
            <div
              key={parcel.parcel_id}
              style={{
                padding: '12px',
                borderBottom: index !== parcels.length - 1
                  ? '1px solid #edf2f5'
                  : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
                alignItems: 'center'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: '13px',
                  color: 'var(--yale-blue)',
                  overflowWrap: 'anywhere'
                }}>
                  {parcel.tracking_id}
                </p>

                <p style={{
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  marginTop: '5px'
                }}>
                  {parcel.origin && parcel.destination
                    ? `${parcel.origin} → ${parcel.destination}`
                    : `Parcel ID: ${parcel.parcel_id}`}
                </p>

                <p style={{
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  marginTop: '4px'
                }}>
                  Weight: {parcel.weight ?? 'N/A'} kg
                  {' · '}
                  Urgency: {parcel.urgency || 'Normal'}
                </p>
              </div>

              <span style={{
                background: 'rgba(42,157,143,0.12)',
                color: 'var(--success)',
                padding: '5px 8px',
                borderRadius: '5px',
                fontSize: '10px',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}>
                Awaiting Dispatch
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DestinationGroups;

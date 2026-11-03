
import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Route as RouteIcon } from 'lucide-react';
import api from '../services/api';
import Navbar from '../components/Navbar';

const Routes = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    origin: '',
    destination: '',
    estimated_travel_hours: '',
    processing_buffer_hours: '0'
  });

  const fetchRoutes = async () => {
    try {
      const res = await api.get('/fleet/routes');
      if (res.data.success) setRoutes(res.data.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load routes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.post('/fleet/routes', {
        ...form,
        estimated_travel_hours: Number(form.estimated_travel_hours),
        processing_buffer_hours: Number(form.processing_buffer_hours)
      });

      setSuccess(res.data.message || 'Route created successfully.');

      setForm({
        origin: '',
        destination: '',
        estimated_travel_hours: '',
        processing_buffer_hours: '0'
      });

      await fetchRoutes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create route.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Navbar />

      <main style={styles.main}>
        <div style={styles.heading}>
          <div>
            <h2>Routes Management</h2>
            <p>Create and manage delivery routes.</p>
          </div>

          <button style={styles.refresh} onClick={fetchRoutes}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <div style={styles.stats}>
          <div style={styles.statCard}>
            <RouteIcon size={24} />
            <div>
              <p>Total Routes</p>
              <h2>{routes.length}</h2>
            </div>
          </div>
        </div>

        <section style={styles.card}>
          <h3>Create New Route</h3>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label>Origin City</label>
              <input
                name="origin"
                value={form.origin}
                onChange={handleChange}
                placeholder="e.g. Ahmedabad"
                required
              />
            </div>

            <div style={styles.field}>
              <label>Destination City</label>
              <input
                name="destination"
                value={form.destination}
                onChange={handleChange}
                placeholder="e.g. Delhi"
                required
              />
            </div>

            <div style={styles.field}>
              <label>Estimated Travel Hours</label>
              <input
                type="number"
                name="estimated_travel_hours"
                value={form.estimated_travel_hours}
                onChange={handleChange}
                min="0.01"
                step="0.01"
                placeholder="e.g. 16"
                required
              />
            </div>

            <div style={styles.field}>
              <label>Processing Buffer Hours</label>
              <input
                type="number"
                name="processing_buffer_hours"
                value={form.processing_buffer_hours}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
              />
            </div>

            <button disabled={saving} style={styles.primaryButton}>
              <Plus size={17} />
              {saving ? 'Creating...' : 'Create Route'}
            </button>
          </form>

          {error && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}
        </section>

        <section style={styles.card}>
          <h3>Registered Routes</h3>

          {loading ? (
            <p>Loading routes...</p>
          ) : routes.length === 0 ? (
            <p style={styles.empty}>No routes registered yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Route ID</th>
                    <th>Origin</th>
                    <th>Destination</th>
                    <th>Travel Hours</th>
                    <th>Buffer Hours</th>
                    <th>Destination Group</th>
                  </tr>
                </thead>

                <tbody>
                  {routes.map((route) => (
                    <tr key={route.route_id}>
                      <td>#{route.route_id}</td>
                      <td>{route.origin}</td>
                      <td>{route.destination}</td>
                      <td>{route.estimated_travel_hours} hrs</td>
                      <td>{route.processing_buffer_hours} hrs</td>
                      <td>{route.group_name || 'Not created'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const styles = {
  main: { maxWidth: 1150, margin: '30px auto', padding: '0 20px' },
  heading: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap', gap: 15, marginBottom: 22
  },
  refresh: {
    display: 'flex', gap: 8, alignItems: 'center',
    padding: '10px 15px', background: 'white',
    color: 'var(--yale-blue)', border: '1px solid var(--frozen-water)'
  },
  stats: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
    gap: 15, marginBottom: 20
  },
  statCard: {
    display: 'flex', gap: 15, alignItems: 'center',
    background: 'white', padding: 20, borderRadius: 9,
    border: '1px solid var(--frozen-water)', color: 'var(--yale-blue)'
  },
  card: {
    background: 'white', padding: 22, borderRadius: 10,
    border: '1px solid var(--frozen-water)', marginBottom: 22
  },
  form: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
    gap: 16, marginTop: 20, alignItems: 'end'
  },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  primaryButton: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 11, background: 'var(--yale-blue)', color: 'white'
  },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 18, fontSize: 13 },
  error: { color: 'var(--error)', marginTop: 15, fontSize: 13 },
  success: { color: 'var(--success)', marginTop: 15, fontSize: 13 },
  empty: { color: 'var(--text-muted)', marginTop: 18, fontSize: 13 }
};

export default Routes;

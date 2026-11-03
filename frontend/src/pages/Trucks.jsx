
import React, { useEffect, useState } from 'react';
import { Plus, Truck, RefreshCw } from 'lucide-react';
import api from '../services/api';
import Navbar from '../components/Navbar';

const Trucks = () => {
  const [trucks, setTrucks] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    truck_number: '',
    route_id: '',
    capacity: '',
    availability_status: 'Available'
  });

  const fetchData = async () => {
    try {
      const [truckRes, routeRes] = await Promise.all([
        api.get('/fleet/trucks'),
        api.get('/fleet/routes')
      ]);

      if (truckRes.data.success) setTrucks(truckRes.data.data);
      if (routeRes.data.success) setRoutes(routeRes.data.data);

      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load fleet data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.post('/fleet/trucks', {
        ...form,
        route_id: Number(form.route_id),
        capacity: Number(form.capacity)
      });

      setSuccess(res.data.message || 'Truck registered successfully.');

      setForm({
        truck_number: '',
        route_id: '',
        capacity: '',
        availability_status: 'Available'
      });

      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register truck.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (truckId, status) => {
    setError('');
    setSuccess('');

    try {
      const res = await api.patch(
        `/fleet/trucks/${truckId}/status`,
        { availability_status: status }
      );

      setSuccess(res.data.message || 'Truck status updated.');
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update truck status.');
    }
  };

  const availableCount = trucks.filter(
    (truck) => truck.availability_status === 'Available'
  ).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Navbar />

      <main style={styles.main}>
        <div style={styles.heading}>
          <div>
            <h2>Fleet Management</h2>
            <p>Register trucks and manage their availability.</p>
          </div>

          <button style={styles.refresh} onClick={fetchData}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <div style={styles.stats}>
          <Stat title="Total Trucks" value={trucks.length} />
          <Stat title="Available" value={availableCount} />
          <Stat title="In Transit" value={trucks.filter(t => t.availability_status === 'In Transit').length} />
          <Stat title="Maintenance" value={trucks.filter(t => t.availability_status === 'Maintenance').length} />
        </div>

        <section style={styles.card}>
          <h3>Register New Truck</h3>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label>Truck Number</label>
              <input
                value={form.truck_number}
                onChange={(e) => setForm({ ...form, truck_number: e.target.value })}
                placeholder="e.g. GJ-01-AX-2001"
                required
              />
            </div>

            <div style={styles.field}>
              <label>Assigned Route</label>
              <select
                value={form.route_id}
                onChange={(e) => setForm({ ...form, route_id: e.target.value })}
                required
              >
                <option value="">Select route</option>
                {routes.map(route => (
                  <option key={route.route_id} value={route.route_id}>
                    #{route.route_id} - {route.origin} to {route.destination}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label>Capacity (kg)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                placeholder="e.g. 1000"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving || routes.length === 0}
              style={styles.primaryButton}
            >
              <Plus size={17} />
              {saving ? 'Registering...' : 'Register Truck'}
            </button>
          </form>

          {routes.length === 0 && (
            <p style={styles.note}>
              Create a route before registering a truck.
            </p>
          )}

          {error && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}
        </section>

        <section style={styles.card}>
          <h3>Registered Trucks</h3>

          {loading ? (
            <p>Loading trucks...</p>
          ) : trucks.length === 0 ? (
            <p style={styles.empty}>No trucks registered yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Truck ID</th>
                    <th>Truck Number</th>
                    <th>Route</th>
                    <th>Capacity</th>
                    <th>Availability</th>
                  </tr>
                </thead>

                <tbody>
                  {trucks.map(truck => (
                    <tr key={truck.truck_id}>
                      <td>#{truck.truck_id}</td>
                      <td><strong>{truck.truck_number}</strong></td>
                      <td>{truck.origin} → {truck.destination}</td>
                      <td>{truck.capacity} kg</td>
                      <td>
                        <select
                          value={truck.availability_status}
                          onChange={(e) => updateStatus(truck.truck_id, e.target.value)}
                          style={styles.statusSelect}
                        >
                          <option value="Available">Available</option>
                          <option value="In Transit">In Transit</option>
                          <option value="Maintenance">Maintenance</option>
                        </select>
                      </td>
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

const Stat = ({ title, value }) => (
  <div style={styles.statCard}>
    <Truck size={21} />
    <div>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  </div>
);

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
    display: 'flex', gap: 13, alignItems: 'center',
    background: 'white', padding: 18, borderRadius: 9,
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
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    gap: 8, padding: 11, background: 'var(--yale-blue)', color: 'white'
  },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 18, fontSize: 13 },
  statusSelect: { minWidth: 130, padding: 7 },
  error: { color: 'var(--error)', marginTop: 15, fontSize: 13 },
  success: { color: 'var(--success)', marginTop: 15, fontSize: 13 },
  empty: { color: 'var(--text-muted)', marginTop: 18, fontSize: 13 },
  note: { color: 'var(--text-muted)', marginTop: 12, fontSize: 12 }
};

export default Trucks;

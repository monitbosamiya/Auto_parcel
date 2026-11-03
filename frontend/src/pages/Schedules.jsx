
import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, CalendarClock, Clock } from 'lucide-react';
import api from '../services/api';
import Navbar from '../components/Navbar';

const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const Schedules = () => {
  const [schedules, setSchedules] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [departures, setDepartures] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    truck_id: '',
    departure_time: '',
    departure_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    is_active: true
  });

  const fetchData = async () => {
    try {
      const [scheduleRes, truckRes, departureRes] = await Promise.all([
        api.get('/fleet/schedules'),
        api.get('/fleet/trucks'),
        api.get('/fleet/upcoming-departures')
      ]);

      if (scheduleRes.data.success) {
        setSchedules(scheduleRes.data.data);
      }

      if (truckRes.data.success) {
        setTrucks(truckRes.data.data);
      }

      if (departureRes.data.success) {
        setDepartures(departureRes.data.data);
      }

      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load schedule data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleDay = (day) => {
    setForm(prev => ({
      ...prev,
      departure_days: prev.departure_days.includes(day)
        ? prev.departure_days.filter(d => d !== day)
        : [...prev.departure_days, day]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.departure_days.length === 0) {
      setError('Select at least one departure day.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.post('/fleet/schedules', {
        truck_id: Number(form.truck_id),
        departure_time: form.departure_time,
        departure_days: WEEK_DAYS
          .filter(day => form.departure_days.includes(day))
          .join(','),
        is_active: form.is_active
      });

      setSuccess(res.data.message || 'Schedule created successfully.');

      setForm({
        truck_id: '',
        departure_time: '',
        departure_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        is_active: true
      });

      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create schedule.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';

    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Navbar />

      <main style={styles.main}>
        <div style={styles.heading}>
          <div>
            <h2>Schedule Management</h2>
            <p>Configure recurring truck departures and view upcoming slots.</p>
          </div>

          <button style={styles.refresh} onClick={fetchData}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <div style={styles.stats}>
          <Stat title="Total Schedules" value={schedules.length} />
          <Stat
            title="Active Schedules"
            value={schedules.filter(s => Number(s.is_active) === 1 || s.is_active === true).length}
          />
          <Stat title="Upcoming Candidates" value={departures.length} />
        </div>

        <section style={styles.card}>
          <h3>Create Departure Schedule</h3>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label>Select Truck</label>
              <select
                value={form.truck_id}
                onChange={e => setForm({ ...form, truck_id: e.target.value })}
                required
              >
                <option value="">Select truck</option>
                {trucks.map(truck => (
                  <option
                    key={truck.truck_id}
                    value={truck.truck_id}
                    disabled={truck.availability_status === 'Maintenance'}
                  >
                    {truck.truck_number} - {truck.origin} to {truck.destination}
                    {' '}({truck.availability_status})
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label>Departure Time</label>
              <input
                type="time"
                value={form.departure_time}
                onChange={e => setForm({ ...form, departure_time: e.target.value })}
                required
              />
            </div>

            <div style={styles.field}>
              <label>Schedule Status</label>
              <select
                value={String(form.is_active)}
                onChange={e => setForm({
                  ...form,
                  is_active: e.target.value === 'true'
                })}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div style={styles.daysSection}>
              <label>Departure Days</label>

              <div style={styles.days}>
                {WEEK_DAYS.map(day => (
                  <label key={day} style={styles.dayLabel}>
                    <input
                      type="checkbox"
                      checked={form.departure_days.includes(day)}
                      onChange={() => toggleDay(day)}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || trucks.length === 0}
              style={styles.primaryButton}
            >
              <Plus size={17} />
              {saving ? 'Creating...' : 'Create Schedule'}
            </button>
          </form>

          {trucks.length === 0 && (
            <p style={styles.note}>Register a truck before creating its schedule.</p>
          )}

          {error && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}
        </section>

        <section style={styles.card}>
          <h3>Configured Schedules</h3>

          {loading ? (
            <p>Loading schedules...</p>
          ) : schedules.length === 0 ? (
            <p style={styles.empty}>No schedules configured yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Schedule ID</th>
                    <th>Truck</th>
                    <th>Route</th>
                    <th>Departure Time</th>
                    <th>Departure Days</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {schedules.map(schedule => (
                    <tr key={schedule.schedule_id}>
                      <td>#{schedule.schedule_id}</td>
                      <td>{schedule.truck_number}</td>
                      <td>{schedule.origin} → {schedule.destination}</td>
                      <td>{String(schedule.departure_time).slice(0, 5)}</td>
                      <td>{schedule.departure_days}</td>
                      <td>
                        <span style={statusStyle(schedule.is_active)}>
                          {Number(schedule.is_active) === 1 || schedule.is_active === true
                            ? 'Active'
                            : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeading}>
            <div>
              <h3>Upcoming Departure Candidates</h3>
              <p style={styles.subtitle}>
                Available departure slots supplied to the M6 Scheduling Engine.
              </p>
            </div>
            <CalendarClock size={25} color="var(--yale-blue)" />
          </div>

          {loading ? (
            <p>Loading upcoming departures...</p>
          ) : departures.length === 0 ? (
            <p style={styles.empty}>
              No upcoming departure candidates found. Check truck availability
              and active schedules.
            </p>
          ) : (
            <div style={styles.candidateGrid}>
              {departures.map((item, index) => (
                <div
                  key={`${item.truck.truck_id}-${item.departure.schedule_id}`}
                  style={styles.candidate}
                >
                  <div style={styles.candidateTop}>
                    <strong>Candidate #{index + 1}</strong>
                    <span style={statusStyle(!item.departure.already_batched)}>
                      {item.departure.already_batched
                        ? 'Already Batched'
                        : 'Available Slot'}
                    </span>
                  </div>

                  <h4>{item.origin} → {item.destination}</h4>

                  <p>Truck: {item.truck.truck_number}</p>
                  <p>Capacity: {item.truck.capacity} kg</p>
                  <p>Travel: {item.estimated_travel_hours} hours</p>
                  <p>Processing buffer: {item.processing_buffer_hours} hours</p>

                  <div style={styles.departureTime}>
                    <Clock size={16} />
                    {formatDate(item.departure.scheduled_departure)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const Stat = ({ title, value }) => (
  <div style={styles.statCard}>
    <CalendarClock size={21} />
    <div>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  </div>
);

const statusStyle = (active) => ({
  background: active ? 'rgba(42,157,143,0.12)' : 'rgba(230,57,70,0.1)',
  color: active ? 'var(--success)' : 'var(--error)',
  padding: '5px 9px',
  borderRadius: 5,
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: 'nowrap'
});

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
  daysSection: { gridColumn: '1 / -1' },
  days: { display: 'flex', flexWrap: 'wrap', gap: 13, marginTop: 10 },
  dayLabel: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 13, cursor: 'pointer'
  },
  primaryButton: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    gap: 8, padding: 11, background: 'var(--yale-blue)', color: 'white'
  },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 18, fontSize: 13 },
  error: { color: 'var(--error)', marginTop: 15, fontSize: 13 },
  success: { color: 'var(--success)', marginTop: 15, fontSize: 13 },
  empty: { color: 'var(--text-muted)', marginTop: 18, fontSize: 13 },
  note: { color: 'var(--text-muted)', marginTop: 12, fontSize: 12 },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, marginTop: 5 },
  sectionHeading: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  candidateGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
    gap: 15, marginTop: 18
  },
  candidate: {
    border: '1px solid var(--frozen-water)', borderRadius: 8,
    padding: 16, background: 'var(--bg-main)'
  },
  candidateTop: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: 8, marginBottom: 15, fontSize: 12
  },
  departureTime: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginTop: 15, paddingTop: 12,
    borderTop: '1px solid var(--frozen-water)',
    color: 'var(--yale-blue)', fontWeight: 600, fontSize: 12
  }
};

export default Schedules;

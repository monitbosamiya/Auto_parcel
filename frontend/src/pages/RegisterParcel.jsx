import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';

const RegisterParcel = () => {
  const [routes, setRoutes] = useState([]);
  const [formData, setFormData] = useState({
    sender_name: '',
    receiver_name: '',
    origin: '',
    destination: '',
    weight: '',
    urgency: 'Normal',
    deadline: '',
    max_wait_hours: 48
  });

  const [validationState, setValidationState] = useState({ isValid: null, errors: [], validating: false });
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api.get('/fleet/routes').then((res) => {
      if (res.data.success && res.data.data.length > 0) {
        setRoutes(res.data.data);
        setFormData((prev) => ({
          ...prev,
          origin: res.data.data[0].origin,
          destination: res.data.data[0].destination
        }));
      }
    }).catch(console.error);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setValidationState({ isValid: null, errors: [], validating: false });
  };

  const handleRouteSelect = (e) => {
    const route = routes.find((r) => r.route_id === parseInt(e.target.value, 10));
    if (route) {
      setFormData((prev) => ({ ...prev, origin: route.origin, destination: route.destination }));
      setValidationState({ isValid: null, errors: [], validating: false });
    }
  };

  // Module 2: Pre-check validation against business & truck rules
  const handleValidateOnly = async () => {
    setValidationState({ isValid: null, errors: [], validating: true });
    setErrorMsg('');
    try {
      const res = await api.post('/parcels/validate', {
        ...formData,
        weight: parseFloat(formData.weight),
        max_wait_hours: parseInt(formData.max_wait_hours, 10),
        deadline: formData.deadline || null
      });
      if (res.data.success) {
        setValidationState({ isValid: true, errors: [], validating: false });
      }
    } catch (err) {
      setValidationState({
        isValid: false,
        errors: err.response?.data?.errors || [err.response?.data?.message || 'Validation failed'],
        validating: false
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessResult(null);
    setSubmitting(true);

    try {
      const res = await api.post('/parcels/register', {
        ...formData,
        weight: parseFloat(formData.weight),
        max_wait_hours: parseInt(formData.max_wait_hours, 10),
        deadline: formData.deadline || null
      });
      if (res.data.success) {
        setSuccessResult(res.data.data);
        setValidationState({ isValid: null, errors: [], validating: false });
        setFormData((prev) => ({ ...prev, sender_name: '', receiver_name: '', weight: '', deadline: '' }));
      }
    } catch (err) {
      const msg = err.response?.data?.errors?.join(', ') || err.response?.data?.message || 'Registration failed';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      {/* Top Header */}
      <Navbar />

      {/* Main Form */}
      <main style={{ maxWidth: '780px', margin: '30px auto', padding: '0 16px' }}>
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: '10px',
          border: '1px solid var(--frozen-water)',
          boxShadow: '0 4px 14px rgba(27, 73, 101, 0.08)',
          padding: '26px'
        }}>
          <h2 style={{ color: 'var(--yale-blue)', fontSize: '20px', marginBottom: '6px' }}>
            Parcel Registration & Validation
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
            Validates route feasibility, capacity limits, and deadline constraints before database insertion.
          </p>

          {/* Validation Feedback Banner */}
          {validationState.isValid === true && (
            <div style={{ background: 'rgba(42, 157, 143, 0.1)', color: 'var(--success)', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', border: '1px solid var(--success)' }}>
              ✓ <strong>Module 2 Validation Passed:</strong> Route exists, scheduled trucks available, weight fits capacity, and deadline is feasible.
            </div>
          )}

          {validationState.isValid === false && (
            <div style={{ background: 'rgba(230, 57, 70, 0.1)', color: 'var(--error)', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', border: '1px solid var(--error)' }}>
              <strong>Validation Issues:</strong>
              <ul style={{ marginLeft: '18px', marginTop: '4px' }}>
                {validationState.errors.map((e, idx) => <li key={idx}>{e}</li>)}
              </ul>
            </div>
          )}

          {errorMsg && (
            <div style={{ background: 'rgba(230, 57, 70, 0.1)', color: 'var(--error)', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}

          {successResult && (
            <div style={{ background: 'rgba(42, 157, 143, 0.1)', color: 'var(--success)', padding: '14px', borderRadius: '6px', marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '4px' }}>✓ Parcel Registered & Validated!</h4>
              <p style={{ fontSize: '13px' }}>Tracking ID: <strong style={{ fontFamily: 'monospace' }}>{successResult.tracking_id}</strong> | Status: <strong>{successResult.status}</strong></p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--yale-blue)', marginBottom: '4px' }}>Sender *</label>
              <input type="text" name="sender_name" value={formData.sender_name} onChange={handleChange} required style={{ width: '100%' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--yale-blue)', marginBottom: '4px' }}>Receiver *</label>
              <input type="text" name="receiver_name" value={formData.receiver_name} onChange={handleChange} required style={{ width: '100%' }} />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--yale-blue)', marginBottom: '4px' }}>Shipping Route *</label>
              <select onChange={handleRouteSelect} style={{ width: '100%' }}>
                {routes.map((r) => (
                  <option key={r.route_id} value={r.route_id}>{r.origin} → {r.destination} (Travel: {r.estimated_travel_hours}h, Buffer: {r.processing_buffer_hours}h)</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--yale-blue)', marginBottom: '4px' }}>Weight (kg) *</label>
              <input type="number" step="0.1" min="0.1" name="weight" value={formData.weight} onChange={handleChange} required style={{ width: '100%' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--yale-blue)', marginBottom: '4px' }}>Urgency *</label>
              <select name="urgency" value={formData.urgency} onChange={handleChange} style={{ width: '100%' }}>
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--yale-blue)', marginBottom: '4px' }}>Deadline (Optional)</label>
              <input type="datetime-local" name="deadline" value={formData.deadline} onChange={handleChange} style={{ width: '100%' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--yale-blue)', marginBottom: '4px' }}>Max Wait (Hours)</label>
              <input type="number" min="1" name="max_wait_hours" value={formData.max_wait_hours} onChange={handleChange} required style={{ width: '100%' }} />
            </div>

            {/* Action Buttons: Validate & Submit */}
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={handleValidateOnly}
                disabled={validationState.validating}
                style={{
                  flex: 1,
                  background: 'var(--pale-sky)',
                  color: 'var(--yale-blue)',
                  padding: '12px',
                  fontSize: '14px',
                  border: '1px solid var(--pacific-blue)'
                }}
              >
                {validationState.validating ? 'Checking Rules...' : 'Validate Parcel (Module 2)'}
              </button>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  flex: 1,
                  background: 'var(--pacific-blue)',
                  color: 'var(--yale-blue)',
                  padding: '12px',
                  fontSize: '14px'
                }}
              >
                {submitting ? 'Registering...' : 'Register Parcel'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default RegisterParcel;

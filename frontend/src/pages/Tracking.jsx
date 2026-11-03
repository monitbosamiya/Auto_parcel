
import React, { useState } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import './Tracking.css';

function Tracking() {
  const [trackingId, setTrackingId] = useState('');
  const [parcel, setParcel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e) => {
    e.preventDefault();

    if (!trackingId.trim()) {
      setError('Please enter a tracking ID.');
      return;
    }

    setLoading(true);
    setError('');
    setParcel(null);

    try {
      const response = await api.get(
        `/tracking/${encodeURIComponent(trackingId.trim())}`
      );

      setParcel(response.data.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to find parcel. Please check the tracking ID.'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Not available';

    return new Date(date).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const getStatusClass = (status) => {
    return String(status || '')
      .toLowerCase()
      .replace(/\s+/g, '-');
  };

  const statusSteps = [
    'Registered',
    'Queued',
    'Sorted',
    'Batched',
    'Dispatched',
    'Delivered'
  ];

  const currentStatusIndex = parcel
    ? statusSteps.indexOf(parcel.current_status)
    : -1;

  return (
    <>
      <Navbar />

      <div className="tracking-page">
        <div className="tracking-header">
          <h1>Parcel Tracking</h1>
          <p>Search a parcel and view its complete delivery journey.</p>
        </div>

        <div className="tracking-search-card">
          <form onSubmit={handleTrack}>
            <label htmlFor="trackingId">Enter Tracking ID</label>

            <div className="tracking-search-row">
              <input
                id="trackingId"
                type="text"
                placeholder="Example: TRK-20261103-1234"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
              />

              <button type="submit" disabled={loading}>
                {loading ? 'Searching...' : 'Track Parcel'}
              </button>
            </div>
          </form>

          {error && (
            <div className="tracking-error">{error}</div>
          )}
        </div>

        {loading && (
          <div className="tracking-empty">
            Searching parcel information...
          </div>
        )}

        {parcel && (
          <div className="tracking-results">

            <div className="tracking-parcel-card">
              <div className="tracking-parcel-heading">
                <div>
                  <span className="tracking-label">Tracking ID</span>
                  <h2>{parcel.tracking_id}</h2>
                </div>

                <span className={`tracking-status ${getStatusClass(parcel.current_status)}`}>
                  {parcel.current_status}
                </span>
              </div>

              <div className="tracking-route">
                <div>
                  <span>Origin</span>
                  <strong>{parcel.origin}</strong>
                </div>

                <div className="tracking-route-arrow">→</div>

                <div>
                  <span>Destination</span>
                  <strong>{parcel.destination}</strong>
                </div>
              </div>

              <div className="tracking-details-grid">
                <div>
                  <span>Sender</span>
                  <strong>{parcel.sender_name}</strong>
                </div>

                <div>
                  <span>Receiver</span>
                  <strong>{parcel.receiver_name}</strong>
                </div>

                <div>
                  <span>Weight</span>
                  <strong>{parcel.weight} kg</strong>
                </div>

                <div>
                  <span>Urgency</span>
                  <strong>{parcel.urgency}</strong>
                </div>

                <div>
                  <span>Arrival Time</span>
                  <strong>{formatDate(parcel.arrival_time)}</strong>
                </div>

                <div>
                  <span>Delivery Deadline</span>
                  <strong>{formatDate(parcel.deadline)}</strong>
                </div>
              </div>
            </div>

            <div className="tracking-progress-card">
              <h2>Delivery Progress</h2>

              <div className="tracking-progress">
                {statusSteps.map((step, index) => {
                  const completed = currentStatusIndex >= index;

                  return (
                    <div
                      className={`tracking-progress-step ${completed ? 'completed' : ''}`}
                      key={step}
                    >
                      <div className="tracking-step-circle">
                        {completed ? '✓' : index + 1}
                      </div>

                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>

              {currentStatusIndex === -1 && (
                <p className="tracking-note">
                  Current status: {parcel.current_status}. This status is not
                  included in the standard progress stages.
                </p>
              )}

              {parcel.current_status === 'Exception' && (
                <p className="tracking-note">
                  This parcel has an exception status. Check the status history
                  for more information.
                </p>
              )}
            </div>

            <div className="tracking-batch-card">
              <h2>Dispatch Information</h2>

              {parcel.batch ? (
                <div className="tracking-details-grid">
                  <div>
                    <span>Batch Code</span>
                    <strong>{parcel.batch.batch_code}</strong>
                  </div>

                  <div>
                    <span>Truck Number</span>
                    <strong>{parcel.batch.truck_number || 'Not assigned'}</strong>
                  </div>

                  <div>
                    <span>Scheduled Departure</span>
                    <strong>{formatDate(parcel.batch.scheduled_departure)}</strong>
                  </div>

                  <div>
                    <span>Actual Departure</span>
                    <strong>{formatDate(parcel.batch.actual_departure)}</strong>
                  </div>

                  <div>
                    <span>Batch Status</span>
                    <strong>{parcel.batch.batch_status}</strong>
                  </div>
                </div>
              ) : (
                <p className="tracking-note">
                  This parcel has not yet been assigned to a dispatch batch.
                </p>
              )}
            </div>

            <div className="tracking-history-card">
              <div className="tracking-history-heading">
                <h2>Status History</h2>

                <span>
                  {parcel.history?.length || 0} Records
                </span>
              </div>

              {!parcel.history || parcel.history.length === 0 ? (
                <p className="tracking-note">
                  No status history available.
                </p>
              ) : (
                <div className="tracking-timeline">
                  {parcel.history.map((item, index) => (
                    <div className="tracking-history-item" key={index}>
                      <div className="tracking-history-dot" />

                      <div className="tracking-history-content">
                        <strong>
                          {item.previous_status || 'Initial'} → {item.new_status}
                        </strong>

                        <span>{formatDate(item.changed_at)}</span>

                        {item.remarks && (
                          <p>{item.remarks}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="tracking-cache-info">
              Lookup method: {parcel.from_cache ? 'Hash Table Cache' : 'Database'}
            </p>

          </div>
        )}
      </div>
    </>
  );
}

export default Tracking;

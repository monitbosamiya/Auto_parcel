
import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Package,
  Truck,
  CalendarClock,
  Weight,
  Plus,
  Eye,
  X,
  CheckCircle,
  AlertTriangle,
  Layers
} from 'lucide-react';

import api from '../services/api';
import Navbar from '../components/Navbar';

const Batches = () => {
  const [batches, setBatches] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [candidates, setCandidates] = useState([]);

  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState('All');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generationResult, setGenerationResult] = useState(null);

  // Load batches, routes and departure candidates
  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const [batchRes, routeRes, departureRes] = await Promise.all([
        api.get('/batches'),
        api.get('/fleet/routes'),
        api.get('/fleet/upcoming-departures')
      ]);

      if (batchRes.data.success) {
        setBatches(batchRes.data.data || []);
      }

      if (routeRes.data.success) {
        const routeData = routeRes.data.data || [];
        setRoutes(routeData);

        setSelectedRoute(previous => {
          if (previous && routeData.some(
            route => String(route.route_id) === String(previous)
          )) {
            return previous;
          }

          return routeData.length ? String(routeData[0].route_id) : '';
        });
      }

      if (departureRes.data.success) {
        setCandidates(departureRes.data.data || []);
      }
    } catch (err) {
      console.error('Batch fetch error:', err);
      setError(
        err.response?.data?.message || 'Unable to load batch information.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Find the upcoming departure for the selected route
  const selectedCandidate = candidates.find(
    item => String(item.route_id) === String(selectedRoute)
  );

  // Generate batch using the M6 scheduling engine
  const handleGenerateBatch = async () => {
    if (!selectedRoute) {
      setError('Please select a route.');
      return;
    }

    if (!selectedCandidate) {
      setError('No upcoming departure found for this route.');
      return;
    }

    if (selectedCandidate.departure.already_batched) {
      setError('This departure already has a batch.');
      return;
    }

    const confirmed = window.confirm(
      `Generate a batch for Route ${selectedRoute}?\n\n` +
      `Truck: ${selectedCandidate.truck.truck_number}\n` +
      `Departure: ${formatDate(selectedCandidate.departure.scheduled_departure)}`
    );

    if (!confirmed) return;

    setGenerating(true);
    setError('');
    setSuccess('');
    setGenerationResult(null);

    try {
      const response = await api.post('/batches/auto-generate', {
        route_id: Number(selectedRoute)
      });

      if (response.data.success) {
        const result = response.data.data;

        setGenerationResult(result);
        setSuccess(response.data.message || 'Batch generated successfully.');

        await fetchData();
      }
    } catch (err) {
      console.error('Batch generation error:', err);

      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Unable to generate batch.'
      );

      // Backend may return evaluation information when no parcels are allocated
      if (err.response?.data?.evaluation) {
        setGenerationResult({
          evaluation: err.response.data.evaluation
        });
      }
    } finally {
      setGenerating(false);
    }
  };

  // Load individual batch details
  const handleViewBatch = async (batchId) => {
    setDetailsLoading(true);
    setError('');

    try {
      const response = await api.get(`/batches/${batchId}`);

      if (response.data.success) {
        setSelectedBatch(response.data.data);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 'Unable to load batch details.'
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredBatches = statusFilter === 'All'
    ? batches
    : batches.filter(batch => batch.batch_status === statusFilter);

  const totalWeight = batches.reduce(
    (sum, batch) => sum + Number(batch.total_weight || 0),
    0
  );

  const totalParcels = batches.reduce(
    (sum, batch) => sum + Number(batch.parcel_count || 0),
    0
  );

  const readyCount = batches.filter(
    batch => batch.batch_status === 'Ready'
  ).length;

  const formatDate = (value) => {
    if (!value) return 'N/A';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'N/A';

    return date.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const formatWeight = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : '0.00';
  };

  return (
    <div style={styles.page}>
      <Navbar />

      <main style={styles.main}>

        {/* Heading */}
        <div style={styles.heading}>
          <div>
            <h2 style={styles.title}>Batch Generation</h2>
            <p style={styles.subtitle}>
              Generate dispatch batches using the Scheduling Engine.
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            style={styles.refreshButton}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Statistics */}
        <div style={styles.statsGrid}>
          <StatCard
            title="Total Batches"
            value={batches.length}
            icon={<Layers size={22} />}
            color="#5fa8d3"
          />

          <StatCard
            title="Ready Batches"
            value={readyCount}
            icon={<CheckCircle size={22} />}
            color="#2a9d8f"
          />

          <StatCard
            title="Total Parcels"
            value={totalParcels}
            icon={<Package size={22} />}
            color="#e9a23b"
          />

          <StatCard
            title="Total Weight"
            value={`${formatWeight(totalWeight)} kg`}
            icon={<Weight size={22} />}
            color="#8b7cc3"
          />
        </div>

        {/* Batch generation panel */}
        <section style={styles.card}>
          <div style={styles.sectionHeading}>
            <div>
              <h3 style={styles.sectionTitle}>
                Generate New Batch
              </h3>

              <p style={styles.subtitle}>
                Select a route to automatically evaluate and generate its next batch.
              </p>
            </div>

            <Plus size={24} color="var(--yale-blue)" />
          </div>

          <div style={styles.generationGrid}>
            <div style={styles.field}>
              <label>Select Route</label>

              <select
                value={selectedRoute}
                onChange={(e) => {
                  setSelectedRoute(e.target.value);
                  setError('');
                  setSuccess('');
                  setGenerationResult(null);
                }}
                disabled={loading || generating}
              >
                <option value="">Select route</option>

                {routes.map(route => (
                  <option
                    key={route.route_id}
                    value={route.route_id}
                  >
                    Route #{route.route_id} - {route.origin} to {route.destination}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label>Assigned Truck</label>

              <div style={styles.infoBox}>
                <Truck size={17} />

                {selectedCandidate
                  ? selectedCandidate.truck.truck_number
                  : 'No truck available'}
              </div>
            </div>

            <div style={styles.field}>
              <label>Scheduled Departure</label>

              <div style={styles.infoBox}>
                <CalendarClock size={17} />

                {selectedCandidate
                  ? formatDate(selectedCandidate.departure.scheduled_departure)
                  : 'No departure available'}
              </div>
            </div>
          </div>

          {selectedCandidate && (
            <div style={styles.candidateInfo}>
              <span>
                <strong>Capacity:</strong>{' '}
                {selectedCandidate.truck.capacity} kg
              </span>

              <span>
                <strong>Destination:</strong>{' '}
                {selectedCandidate.destination}
              </span>

              <span>
                <strong>Travel time:</strong>{' '}
                {selectedCandidate.estimated_travel_hours} hours
              </span>
            </div>
          )}

          {!loading && routes.length === 0 && (
            <p style={styles.warning}>
              No routes registered. Complete M5 setup first.
            </p>
          )}

          {!loading && selectedRoute && !selectedCandidate && (
            <p style={styles.warning}>
              No upcoming departure candidate is available for this route.
            </p>
          )}

          {selectedCandidate?.departure?.already_batched && (
            <p style={styles.warning}>
              This departure slot already has a batch. Choose another route
              or wait for its next eligible departure.
            </p>
          )}

          <button
            onClick={handleGenerateBatch}
            disabled={
              loading ||
              generating ||
              !selectedCandidate ||
              selectedCandidate.departure.already_batched
            }
            style={styles.generateButton}
          >
            <Package size={18} />

            {generating
              ? 'Generating Batch...'
              : 'Run Scheduling & Generate Batch'}
          </button>

          {error && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}
        </section>

        {/* Generation result */}
        {generationResult && (
          <section style={styles.resultCard}>
            {generationResult.batch ? (
              <>
                <div style={styles.resultHeading}>
                  <CheckCircle size={23} color="#2a9d8f" />
                  <h3>Batch Generated Successfully</h3>
                </div>

                <div style={styles.resultGrid}>
                  <ResultItem
                    label="Batch Code"
                    value={generationResult.batch.batch_code}
                  />

                  <ResultItem
                    label="Batch Status"
                    value={generationResult.batch.batch_status}
                  />

                  <ResultItem
                    label="Total Parcels"
                    value={generationResult.batch.parcel_count}
                  />

                  <ResultItem
                    label="Total Weight"
                    value={`${formatWeight(generationResult.batch.total_weight)} kg`}
                  />

                  <ResultItem
                    label="Truck"
                    value={generationResult.batch.truck_number}
                  />

                  <ResultItem
                    label="Departure"
                    value={formatDate(generationResult.batch.scheduled_departure)}
                  />
                </div>
              </>
            ) : generationResult.evaluation ? (
              <>
                <h3 style={styles.sectionTitle}>
                  Scheduling Evaluation
                </h3>

                <p style={styles.subtitle}>
                  No batch was created. The evaluation returned no eligible
                  allocated parcels.
                </p>

                <p style={styles.resultText}>
                  Allocated parcels:{' '}
                  {generationResult.evaluation.allocated_count ?? 0}
                </p>
              </>
            ) : null}
          </section>
        )}

        {/* Batch history */}
        <section style={styles.card}>
          <div style={styles.sectionHeading}>
            <div>
              <h3 style={styles.sectionTitle}>Generated Batch History</h3>
              <p style={styles.subtitle}>
                View all batches created by the system.
              </p>
            </div>

            <Package size={23} color="var(--yale-blue)" />
          </div>

          <div style={styles.filterRow}>
            <label>Filter by Status</label>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="All">All Batches</option>
              <option value="Ready">Ready</option>
              <option value="Generated">Generated</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {loading ? (
            <p style={styles.empty}>Loading batches...</p>
          ) : filteredBatches.length === 0 ? (
            <p style={styles.empty}>
              No batches found for this status.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Batch Code</th>
                    <th>Route</th>
                    <th>Truck</th>
                    <th>Departure</th>
                    <th>Parcels</th>
                    <th>Total Weight</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBatches.map(batch => (
                    <tr key={batch.batch_id}>
                      <td>
                        <strong>{batch.batch_code}</strong>
                      </td>

                      <td>{batch.origin} → {batch.destination}</td>

                      <td>{batch.truck_number}</td>

                      <td>{formatDate(batch.scheduled_departure)}</td>

                      <td>{batch.parcel_count}</td>

                      <td>{formatWeight(batch.total_weight)} kg</td>

                      <td>
                        <StatusBadge status={batch.batch_status} />
                      </td>

                      <td>
                        <button
                          onClick={() => handleViewBatch(batch.batch_id)}
                          style={styles.viewButton}
                        >
                          <Eye size={15} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Batch detail modal */}
      {(selectedBatch || detailsLoading) && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3>Batch Details</h3>
                {selectedBatch && (
                  <p>{selectedBatch.batch_code}</p>
                )}
              </div>

              <button
                onClick={() => setSelectedBatch(null)}
                style={styles.closeButton}
              >
                <X size={20} />
              </button>
            </div>

            {detailsLoading ? (
              <p style={styles.empty}>Loading batch details...</p>
            ) : selectedBatch && (
              <div>
                <div style={styles.detailGrid}>
                  <ResultItem
                    label="Batch ID"
                    value={selectedBatch.batch_id}
                  />

                  <ResultItem
                    label="Status"
                    value={selectedBatch.batch_status}
                  />

                  <ResultItem
                    label="Truck"
                    value={selectedBatch.truck_number}
                  />

                  <ResultItem
                    label="Route"
                    value={`${selectedBatch.origin} → ${selectedBatch.destination}`}
                  />

                  <ResultItem
                    label="Total Weight"
                    value={`${formatWeight(selectedBatch.total_weight)} kg`}
                  />

                  <ResultItem
                    label="Truck Capacity"
                    value={`${formatWeight(selectedBatch.truck_capacity)} kg`}
                  />

                  <ResultItem
                    label="Departure"
                    value={formatDate(selectedBatch.scheduled_departure)}
                  />
                </div>

                <h4 style={styles.parcelHeading}>
                  Included Parcels ({selectedBatch.parcels?.length || 0})
                </h4>

                {!selectedBatch.parcels?.length ? (
                  <p style={styles.empty}>No parcel details available.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th>Tracking ID</th>
                          <th>Weight</th>
                          <th>Urgency</th>
                          <th>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedBatch.parcels.map(parcel => (
                          <tr key={parcel.parcel_id}>
                            <td>{parcel.tracking_id}</td>
                            <td>{formatWeight(parcel.weight)} kg</td>
                            <td>{parcel.urgency || 'Normal'}</td>
                            <td>{parcel.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


// Statistics card
const StatCard = ({ title, value, icon, color }) => (
  <div style={styles.statCard}>
    <div>
      <p style={styles.statLabel}>{title}</p>
      <h2 style={styles.statValue}>{value}</h2>
    </div>

    <div style={{
      ...styles.statIcon,
      color,
      background: `${color}20`
    }}>
      {icon}
    </div>
  </div>
);


// Result information
const ResultItem = ({ label, value }) => (
  <div style={styles.resultItem}>
    <p>{label}</p>
    <strong>{value ?? 'N/A'}</strong>
  </div>
);


// Batch status
const StatusBadge = ({ status }) => {
  const isReady = status === 'Ready';
  const isDispatched = status === 'Dispatched';

  return (
    <span style={{
      ...styles.statusBadge,
      background: isReady
        ? 'rgba(42,157,143,0.12)'
        : isDispatched
          ? 'rgba(95,168,211,0.15)'
          : 'rgba(233,162,59,0.15)',
      color: isReady
        ? 'var(--success)'
        : isDispatched
          ? 'var(--yale-blue)'
          : '#a66b16'
    }}>
      {status}
    </span>
  );
};


const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-main)'
  },

  main: {
    maxWidth: 1250,
    margin: '30px auto',
    padding: '0 20px'
  },

  heading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 24
  },

  title: {
    fontSize: 24,
    color: 'var(--yale-blue)',
    marginBottom: 6
  },

  subtitle: {
    color: 'var(--text-muted)',
    fontSize: 13,
    marginTop: 5
  },

  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 15px',
    background: 'white',
    color: 'var(--yale-blue)',
    border: '1px solid var(--frozen-water)'
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
    gap: 15,
    marginBottom: 22
  },

  statCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 18,
    background: 'white',
    border: '1px solid var(--frozen-water)',
    borderRadius: 9
  },

  statLabel: {
    color: 'var(--text-muted)',
    fontSize: 12,
    marginBottom: 8
  },

  statValue: {
    color: 'var(--yale-blue)',
    fontSize: 23
  },

  statIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 43,
    height: 43,
    borderRadius: 9
  },

  card: {
    background: 'white',
    border: '1px solid var(--frozen-water)',
    borderRadius: 10,
    padding: 22,
    marginBottom: 22,
    boxShadow: '0 3px 12px rgba(27,73,101,0.04)'
  },

  sectionHeading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },

  sectionTitle: {
    color: 'var(--yale-blue)',
    fontSize: 17
  },

  generationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
    gap: 16,
    marginTop: 22
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },

  infoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    minHeight: 40,
    padding: '9px 12px',
    border: '1px solid var(--frozen-water)',
    borderRadius: 5,
    color: 'var(--yale-blue)',
    fontSize: 12
  },

  candidateInfo: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 20,
    marginTop: 18,
    paddingTop: 15,
    borderTop: '1px solid var(--frozen-water)',
    color: 'var(--text-muted)',
    fontSize: 12
  },

  generateButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    width: '100%',
    marginTop: 22,
    padding: 13,
    background: 'var(--yale-blue)',
    color: 'white',
    fontWeight: 600
  },

  warning: {
    color: '#a66b16',
    background: 'rgba(233,162,59,0.12)',
    padding: 12,
    borderRadius: 6,
    marginTop: 15,
    fontSize: 13
  },

  error: {
    color: 'var(--error)',
    background: 'rgba(230,57,70,0.08)',
    padding: 12,
    borderRadius: 6,
    marginTop: 15,
    fontSize: 13
  },

  success: {
    color: 'var(--success)',
    background: 'rgba(42,157,143,0.1)',
    padding: 12,
    borderRadius: 6,
    marginTop: 15,
    fontSize: 13
  },

  resultCard: {
    background: 'white',
    border: '1px solid rgba(42,157,143,0.4)',
    borderRadius: 10,
    padding: 22,
    marginBottom: 22
  },

  resultHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: 'var(--success)',
    marginBottom: 20
  },

  resultGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
    gap: 14
  },

  resultItem: {
    background: 'var(--bg-main)',
    border: '1px solid var(--frozen-water)',
    padding: 13,
    borderRadius: 7,
    minWidth: 0
  },

  resultText: {
    color: 'var(--text-muted)',
    marginTop: 15,
    fontSize: 13
  },

  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 20,
    marginBottom: 15,
    fontSize: 13
  },

  filterSelect: {
    width: 170
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: 12
  },

  viewButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 10px',
    background: 'var(--frozen-water)',
    color: 'var(--yale-blue)',
    borderRadius: 5,
    fontSize: 12
  },

  statusBadge: {
    display: 'inline-block',
    padding: '5px 9px',
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap'
  },

  empty: {
    color: 'var(--text-muted)',
    padding: '22px 5px',
    fontSize: 13
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(10,25,40,0.55)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15
  },

  modal: {
    width: '100%',
    maxWidth: 850,
    maxHeight: '90vh',
    overflowY: 'auto',
    background: 'white',
    borderRadius: 10,
    padding: 22
  },

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
    color: 'var(--yale-blue)'
  },

  closeButton: {
    background: 'var(--frozen-water)',
    color: 'var(--yale-blue)',
    padding: 8,
    borderRadius: 6
  },

  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
    gap: 12
  },

  parcelHeading: {
    color: 'var(--yale-blue)',
    margin: '25px 0 14px',
    fontSize: 15
  }
};

export default Batches;

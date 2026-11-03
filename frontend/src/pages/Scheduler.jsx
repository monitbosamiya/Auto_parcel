
import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Play,
  CalendarClock,
  Truck,
  Package,
  Weight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp
} from 'lucide-react';

import api from '../services/api';
import Navbar from '../components/Navbar';

const Scheduler = () => {
  const [routes, setRoutes] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');

  const [evaluation, setEvaluation] = useState(null);
  const [candidateInfo, setCandidateInfo] = useState(null);

  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load routes and upcoming departure candidates
  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const [routeRes, departureRes] = await Promise.all([
        api.get('/fleet/routes'),
        api.get('/fleet/upcoming-departures')
      ]);

      const routeData = routeRes.data.data || [];
      const departureData = departureRes.data.data || [];

      setRoutes(routeData);
      setCandidates(departureData);

      // Keep previous route selection if it still exists
      setSelectedRoute((previous) => {
        if (previous && routeData.some(
          route => String(route.route_id) === String(previous)
        )) {
          return previous;
        }

        return routeData.length ? String(routeData[0].route_id) : '';
      });
    } catch (err) {
      console.error('Scheduler data error:', err);
      setError(
        err.response?.data?.message ||
        'Unable to load scheduling information.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Find earliest departure candidate for selected route
  const routeCandidates = candidates.filter(
    item => String(item.route_id) === String(selectedRoute)
  );

  const selectedCandidate = routeCandidates.length
    ? routeCandidates[0]
    : null;

  // Evaluate selected route using backend scheduling engine
  const handleEvaluate = async () => {
    if (!selectedRoute) {
      setError('Please select a route.');
      return;
    }

    if (!selectedCandidate) {
      setError('No upcoming departure is available for this route.');
      return;
    }

    if (selectedCandidate.departure.already_batched) {
      setError(
        'The earliest departure slot already has a batch. Please check the next available schedule.'
      );
      return;
    }

    setEvaluating(true);
    setError('');
    setSuccess('');
    setEvaluation(null);
    setCandidateInfo(null);

    try {
      const response = await api.post('/scheduling/evaluate', {
        route_id: Number(selectedRoute)
      });

      if (response.data.success) {
        setCandidateInfo(response.data.data.candidate_departure);
        setEvaluation(response.data.data.evaluation);
        setSuccess('Scheduling evaluation completed successfully.');
      }
    } catch (err) {
      console.error('Scheduling evaluation error:', err);

      setError(
        err.response?.data?.message ||
        'Scheduling evaluation failed.'
      );
    } finally {
      setEvaluating(false);
    }
  };

  const allocated = evaluation?.allocated_parcels || [];
  const capacityConflicts = evaluation?.capacity_conflict_parcels || [];
  const unallocated = evaluation?.unallocated_eligible_parcels || [];
  const infeasible = evaluation?.infeasible_parcels || [];

  const allRejected = [
    ...capacityConflicts,
    ...unallocated,
    ...infeasible
  ];

  const formatDate = (value) => {
    if (!value) return 'N/A';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'N/A';

    return date.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const formatNumber = (value, digits = 2) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits) : '0.00';
  };

  return (
    <div style={styles.page}>
      <Navbar />

      <main style={styles.main}>

        {/* Heading */}
        <div style={styles.heading}>
          <div>
            <h2 style={styles.title}>Scheduling Engine</h2>
            <p style={styles.subtitle}>
              Evaluate parcel priorities, delivery deadlines and truck capacity.
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

        {/* Route selection */}
        <section style={styles.card}>
          <h3 style={styles.sectionTitle}>
            Select Route for Scheduling
          </h3>

          <div style={styles.selectionGrid}>
            <div style={styles.field}>
              <label>Select Delivery Route</label>

              <select
                value={selectedRoute}
                onChange={(e) => {
                  setSelectedRoute(e.target.value);
                  setEvaluation(null);
                  setCandidateInfo(null);
                  setError('');
                  setSuccess('');
                }}
                disabled={loading}
              >
                <option value="">Select a route</option>

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
              <label>Upcoming Departure</label>

              <div style={styles.infoBox}>
                <CalendarClock size={17} />

                <span>
                  {selectedCandidate
                    ? formatDate(selectedCandidate.departure.scheduled_departure)
                    : 'No departure available'}
                </span>
              </div>
            </div>

            <button
              onClick={handleEvaluate}
              disabled={
                loading ||
                evaluating ||
                !selectedCandidate ||
                selectedCandidate.departure.already_batched
              }
              style={styles.evaluateButton}
            >
              <Play size={17} />

              {evaluating ? 'Evaluating...' : 'Run Scheduling Engine'}
            </button>
          </div>

          {selectedCandidate && (
            <div style={styles.candidateInfo}>
              <div>
                <Truck size={17} />
                <span>
                  <strong>Truck:</strong>{' '}
                  {selectedCandidate.truck.truck_number}
                </span>
              </div>

              <div>
                <Weight size={17} />
                <span>
                  <strong>Capacity:</strong>{' '}
                  {selectedCandidate.truck.capacity} kg
                </span>
              </div>

              <div>
                <Clock size={17} />
                <span>
                  <strong>Travel:</strong>{' '}
                  {selectedCandidate.estimated_travel_hours} hours
                </span>
              </div>

              <div>
                <Package size={17} />
                <span>
                  <strong>Processing Buffer:</strong>{' '}
                  {selectedCandidate.processing_buffer_hours} hours
                </span>
              </div>
            </div>
          )}

          {selectedCandidate?.departure?.already_batched && (
            <p style={styles.warning}>
              This departure slot already has a batch. Evaluation is disabled.
            </p>
          )}

          {routes.length === 0 && !loading && (
            <p style={styles.warning}>
              No routes found. Complete M5 route, truck and schedule setup first.
            </p>
          )}

          {!selectedCandidate && selectedRoute && !loading && (
            <p style={styles.warning}>
              No upcoming truck departure candidates found for this route.
            </p>
          )}

          {error && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}
        </section>

        {/* Results */}
        {evaluation && (
          <>
            {/* Evaluation summary */}
            <div style={styles.resultHeading}>
              <div>
                <h3 style={styles.sectionTitle}>
                  Scheduling Evaluation Results
                </h3>

                <p style={styles.subtitle}>
                  {candidateInfo?.origin} → {candidateInfo?.destination}
                  {' · '}
                  {candidateInfo?.truck?.truck_number}
                </p>
              </div>

              <span style={styles.completedBadge}>
                <CheckCircle size={14} />
                Evaluation Complete
              </span>
            </div>

            {/* Statistics */}
            <div style={styles.statsGrid}>
              <StatCard
                title="Allocated Parcels"
                value={evaluation.allocated_count}
                icon={<CheckCircle size={22} />}
                color="#2a9d8f"
              />

              <StatCard
                title="Allocated Weight"
                value={`${formatNumber(evaluation.allocated_weight)} kg`}
                icon={<Weight size={22} />}
                color="#5fa8d3"
              />

              <StatCard
                title="Remaining Capacity"
                value={`${formatNumber(evaluation.remaining_capacity)} kg`}
                icon={<Truck size={22} />}
                color="#e9a23b"
              />

              <StatCard
                title="Not Allocated"
                value={allRejected.length}
                icon={<AlertTriangle size={22} />}
                color="#e76f51"
              />
            </div>

            {/* Capacity utilization */}
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>Truck Capacity Utilization</h3>
                <TrendingUp size={21} color="var(--yale-blue)" />
              </div>

              <div style={styles.capacityNumbers}>
                <strong>
                  {formatNumber(evaluation.allocated_weight)} kg
                </strong>

                <span>
                  / {formatNumber(evaluation.truck_capacity)} kg
                </span>
              </div>

              <div style={styles.progressBackground}>
                <div
                  style={{
                    ...styles.progressBar,
                    width: `${
                      evaluation.truck_capacity > 0
                        ? Math.min(
                            100,
                            (evaluation.allocated_weight /
                              evaluation.truck_capacity) * 100
                          )
                        : 0
                    }%`
                  }}
                />
              </div>

              <p style={styles.progressText}>
                {evaluation.truck_capacity > 0
                  ? formatNumber(
                      (evaluation.allocated_weight /
                        evaluation.truck_capacity) * 100
                    )
                  : '0.00'}%
                {' '}of available truck capacity utilized.
              </p>
            </section>

            {/* Allocated parcels */}
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>
                  <CheckCircle size={18} color="#2a9d8f" />
                  Allocated Parcels ({allocated.length})
                </h3>
              </div>

              {allocated.length === 0 ? (
                <EmptyMessage text="No parcels could be allocated." />
              ) : (
                <ParcelTable
                  parcels={allocated}
                  type="allocated"
                  formatDate={formatDate}
                  formatNumber={formatNumber}
                />
              )}
            </section>

            {/* Rejected parcels */}
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>
                  <AlertTriangle size={18} color="#e9a23b" />
                  Parcels Not Allocated ({allRejected.length})
                </h3>
              </div>

              {allRejected.length === 0 ? (
                <EmptyMessage text="All eligible parcels were allocated." />
              ) : (
                <>
                  {capacityConflicts.length > 0 && (
                    <ParcelTable
                      parcels={capacityConflicts}
                      type="mandatory-conflict"
                      title={`Mandatory Capacity Conflicts (${capacityConflicts.length})`}
                      formatDate={formatDate}
                      formatNumber={formatNumber}
                    />
                  )}

                  {unallocated.length > 0 && (
                    <ParcelTable
                      parcels={unallocated}
                      type="capacity"
                      title={`Capacity Rejections (${unallocated.length})`}
                      formatDate={formatDate}
                      formatNumber={formatNumber}
                    />
                  )}

                  {infeasible.length > 0 && (
                    <ParcelTable
                      parcels={infeasible}
                      type="infeasible"
                      title={`Deadline Infeasible (${infeasible.length})`}
                      formatDate={formatDate}
                      formatNumber={formatNumber}
                    />
                  )}
                </>
              )}
            </section>

            {/* Algorithm explanation */}
            <section style={styles.card}>
              <h3 style={styles.sectionTitle}>How this evaluation worked</h3>

              <div style={styles.algorithmSteps}>
                <AlgorithmStep
                  number="1"
                  title="Deadline feasibility"
                  description="The engine checks whether each parcel can reach its destination before its deadline."
                />

                <AlgorithmStep
                  number="2"
                  title="Mandatory parcel allocation"
                  description="Deadline-critical parcels receive first priority for available truck capacity."
                />

                <AlgorithmStep
                  number="3"
                  title="Priority Queue allocation"
                  description="Remaining eligible parcels are ranked using a Binary Max-Heap based on their priority scores."
                />

                <AlgorithmStep
                  number="4"
                  title="Capacity verification"
                  description="Each parcel is checked against the truck's remaining weight capacity."
                />
              </div>

              <p style={styles.note}>
                This is an evaluation only. No batch is generated and parcel
                statuses are not changed by this endpoint. Batch generation
                belongs to M7.
              </p>
            </section>
          </>
        )}
      </main>
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


// Parcel results table
const ParcelTable = ({
  parcels,
  type,
  title,
  formatDate,
  formatNumber
}) => {
  const isAllocated = type === 'allocated';

  return (
    <div style={{ marginTop: 18 }}>
      {title && (
        <h4 style={styles.tableTitle}>{title}</h4>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Tracking ID</th>
              <th>Weight</th>
              <th>Urgency</th>
              <th>Priority Score</th>
              <th>Deadline</th>
              <th>Latest Safe Departure</th>
              <th>Result</th>
            </tr>
          </thead>

          <tbody>
            {parcels.map(parcel => (
              <tr key={parcel.parcel_id}>
                <td>
                  <strong>{parcel.tracking_id}</strong>
                </td>

                <td>{formatNumber(parcel.weight)} kg</td>

                <td>{parcel.urgency || 'Normal'}</td>

                <td>
                  <strong>
                    {formatNumber(parcel.priorityScore)}
                    /100
                  </strong>
                </td>

                <td>{formatDate(parcel.deadline)}</td>

                <td>
                  {formatDate(parcel.factors?.latest_safe_departure)}
                </td>

                <td>
                  <span style={resultBadge(isAllocated, type)}>
                    {isAllocated
                      ? 'Allocated'
                      : type === 'infeasible'
                        ? 'Deadline Miss'
                        : 'Capacity Issue'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// Algorithm explanation step
const AlgorithmStep = ({ number, title, description }) => (
  <div style={styles.algorithmStep}>
    <div style={styles.stepNumber}>{number}</div>

    <div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  </div>
);


const EmptyMessage = ({ text }) => (
  <p style={styles.empty}>{text}</p>
);


const resultBadge = (allocated, type) => ({
  display: 'inline-block',
  padding: '5px 9px',
  borderRadius: 5,
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  background: allocated
    ? 'rgba(42,157,143,0.12)'
    : type === 'infeasible'
      ? 'rgba(230,57,70,0.1)'
      : 'rgba(233,162,59,0.15)',
  color: allocated
    ? 'var(--success)'
    : type === 'infeasible'
      ? 'var(--error)'
      : '#a66b16'
});


const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-main)'
  },

  main: {
    maxWidth: 1200,
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
    fontSize: 13
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

  card: {
    background: 'white',
    border: '1px solid var(--frozen-water)',
    borderRadius: 10,
    padding: 22,
    marginBottom: 22,
    boxShadow: '0 3px 12px rgba(27,73,101,0.04)'
  },

  sectionTitle: {
    color: 'var(--yale-blue)',
    fontSize: 17,
    display: 'flex',
    alignItems: 'center',
    gap: 9
  },

  selectionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
    gap: 16,
    alignItems: 'end',
    marginTop: 20
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

  evaluateButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    padding: '10px 15px',
    background: 'var(--yale-blue)',
    color: 'white'
  },

  candidateInfo: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 20,
    marginTop: 20,
    paddingTop: 16,
    borderTop: '1px solid var(--frozen-water)',
    color: 'var(--text-muted)',
    fontSize: 12
  },

  candidateInfoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 7
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

  resultHeading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    margin: '28px 0 18px'
  },

  completedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--success)',
    background: 'rgba(42,157,143,0.1)',
    padding: '7px 11px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700
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

  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },

  capacityNumbers: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 20,
    color: 'var(--yale-blue)',
    fontSize: 21
  },

  progressBackground: {
    height: 13,
    background: 'var(--frozen-water)',
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 12
  },

  progressBar: {
    height: '100%',
    background: '#2a9d8f',
    borderRadius: 20,
    transition: 'width 0.3s ease'
  },

  progressText: {
    color: 'var(--text-muted)',
    fontSize: 12,
    marginTop: 9
  },

  tableTitle: {
    color: 'var(--yale-blue)',
    fontSize: 14,
    marginBottom: 12
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
    textAlign: 'left'
  },

  algorithmSteps: {
    display: 'grid',
    gap: 18,
    marginTop: 20
  },

  algorithmStep: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 13
  },

  stepNumber: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--frozen-water)',
    color: 'var(--yale-blue)',
    fontWeight: 700,
    fontSize: 13
  },

  note: {
    marginTop: 20,
    padding: 12,
    borderRadius: 6,
    background: 'var(--bg-main)',
    color: 'var(--text-muted)',
    fontSize: 12,
    lineHeight: 1.6
  },

  empty: {
    color: 'var(--text-muted)',
    padding: '20px 5px',
    fontSize: 13
  }
};

export default Scheduler;

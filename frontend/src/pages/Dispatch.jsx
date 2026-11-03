import React, { useEffect, useState } from "react";
import api from "../services/api";
import "./Dispatch.css";
import Navbar from "../components/Navbar";

function Dispatch() {
  const [dueBatches, setDueBatches] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(null);
  const [activeTab, setActiveTab] = useState("due");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadDispatchData();
  }, []);

  const loadDispatchData = async () => {
    setLoading(true);
    setError("");

    try {
      const [dueResponse, historyResponse] = await Promise.all([
        api.get("/dispatch/due"),
        api.get("/dispatch/history"),
      ]);

      setDueBatches(dueResponse.data.data || []);
      setHistory(historyResponse.data.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load dispatch information.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async (batch) => {
    const confirmed = window.confirm(
      `Dispatch batch ${batch.batch_code}?\n\n` +
        `Truck: ${batch.truck_number}\n` +
        `Route: ${batch.origin} → ${batch.destination}\n\n` +
        "This will update the batch and parcel statuses.",
    );

    if (!confirmed) return;

    setDispatching(batch.batch_id);
    setMessage("");
    setError("");

    try {
      const response = await api.post("/dispatch/process", {
        batch_id: batch.batch_id,
      });

      setMessage(response.data.message || "Batch dispatched successfully.");
      await loadDispatchData();
    } catch (err) {
      setError(err.response?.data?.message || "Dispatch operation failed.");
      await loadDispatchData();
    } finally {
      setDispatching(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return "Not available";

    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const totalDispatched = history.filter(
    (item) => item.dispatch_status === "Dispatched",
  ).length;

  const totalDelayed = history.filter(
    (item) => item.dispatch_status === "Delayed",
  ).length;

  return (
    <>
      <Navbar />
      <div className="dispatch-page">
        <div className="dispatch-header">
          <div>
            <h1>Dispatch Management</h1>
            <p>Manage batch departures and monitor dispatch history.</p>
          </div>

          <button
            className="dispatch-refresh"
            onClick={loadDispatchData}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        {error && <div className="dispatch-alert error">{error}</div>}
        {message && <div className="dispatch-alert success">{message}</div>}

        <div className="dispatch-stats">
          <div className="dispatch-stat-card">
            <span>Due Batches</span>
            <strong>{dueBatches.length}</strong>
          </div>

          <div className="dispatch-stat-card">
            <span>Total Dispatches</span>
            <strong>{totalDispatched}</strong>
          </div>

          <div className="dispatch-stat-card">
            <span>Delayed Batches</span>
            <strong>{totalDelayed}</strong>
          </div>

          <div className="dispatch-stat-card">
            <span>Total History Records</span>
            <strong>{history.length}</strong>
          </div>
        </div>

        <div className="dispatch-tabs">
          <button
            className={activeTab === "due" ? "active" : ""}
            onClick={() => setActiveTab("due")}
          >
            Due for Dispatch ({dueBatches.length})
          </button>

          <button
            className={activeTab === "history" ? "active" : ""}
            onClick={() => setActiveTab("history")}
          >
            Dispatch History
          </button>
        </div>

        {loading ? (
          <div className="dispatch-empty">Loading dispatch data...</div>
        ) : activeTab === "due" ? (
          <div className="dispatch-section">
            <h2>Batches Ready for Departure</h2>

            {dueBatches.length === 0 ? (
              <div className="dispatch-empty">
                No batches are currently due for dispatch.
              </div>
            ) : (
              <div className="dispatch-table-wrapper">
                <table className="dispatch-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Route</th>
                      <th>Truck</th>
                      <th>Parcels</th>
                      <th>Weight</th>
                      <th>Scheduled Departure</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {dueBatches.map((batch) => (
                      <tr key={batch.batch_id}>
                        <td>
                          <strong>{batch.batch_code}</strong>
                          <small>ID: {batch.batch_id}</small>
                        </td>

                        <td>
                          {batch.origin} → {batch.destination}
                        </td>

                        <td>
                          {batch.truck_number}
                          <small>{batch.truck_status}</small>
                        </td>

                        <td>{batch.parcel_count}</td>

                        <td>
                          {Number(batch.total_weight || 0).toFixed(2)} kg
                          <small>
                            Capacity: {Number(batch.truck_capacity || 0)} kg
                          </small>
                        </td>

                        <td>{formatDate(batch.scheduled_departure)}</td>

                        <td>
                          <button
                            className="dispatch-action"
                            onClick={() => handleDispatch(batch)}
                            disabled={
                              dispatching === batch.batch_id ||
                              batch.truck_status === "Maintenance"
                            }
                          >
                            {dispatching === batch.batch_id
                              ? "Processing..."
                              : batch.truck_status === "Maintenance"
                                ? "Truck in Maintenance"
                                : "Dispatch"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="dispatch-section">
            <h2>Dispatch History</h2>

            {history.length === 0 ? (
              <div className="dispatch-empty">
                No dispatch history available.
              </div>
            ) : (
              <div className="dispatch-table-wrapper">
                <table className="dispatch-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Route</th>
                      <th>Truck</th>
                      <th>Parcels</th>
                      <th>Scheduled Departure</th>
                      <th>Actual Departure</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {history.map((item, index) => (
                      <tr key={item.dispatch_id || index}>
                        <td>
                          <strong>{item.batch_code}</strong>
                        </td>

                        <td>
                          {item.origin} → {item.destination}
                        </td>

                        <td>{item.truck_number}</td>

                        <td>{item.parcel_count}</td>

                        <td>{formatDate(item.scheduled_departure)}</td>

                        <td>{formatDate(item.actual_departure)}</td>

                        <td>
                          <span
                            className={`dispatch-status ${
                              item.dispatch_status === "Dispatched"
                                ? "dispatched"
                                : "delayed"
                            }`}
                          >
                            {item.dispatch_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default Dispatch;

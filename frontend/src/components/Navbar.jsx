import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Categorized navigation items for a clean, professional simulator bar
  const navGroups = [
    {
      group: "Intake & Queue",
      items: [
        { label: "Register", path: "/register", badge: "M1-2" },
        { label: "FIFO Queue", path: "/queue", badge: "M3" },
        { label: "Route Groups", path: "/sorting", badge: "M4" },
      ],
    },
    {
      group: "Fleet",
      items: [
        { label: "Routes", path: "/routes", badge: "M5" },
        { label: "Trucks", path: "/trucks", badge: "M5" },
        { label: "Schedules", path: "/schedules", badge: "M5" },
      ],
    },
    {
      group: "Operations",
      items: [
        { label: "Scheduler Engine", path: "/scheduler", badge: "M6" },
        { label: "Batches", path: "/batches", badge: "M7" },
        { label: "Dispatch", path: "/dispatch", badge: "M8" },
        { label: "Live Tracking", path: "/tracking", badge: "M9" },
      ],
    },
  ];

  return (
    <header
      style={{
        background: "var(--yale-blue)",
        color: "#ffffff",
        padding: "10px 24px",
        boxShadow: "0 2px 8px rgba(27, 73, 101, 0.25)",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        {/* Brand / Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, var(--frozen-water), var(--pacific-blue))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: "var(--yale-blue)",
              fontSize: "16px",
            }}
          >
            📦
          </div>
          <div>
            <h1 style={{ fontSize: "16px", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
              Parcel Simulator
            </h1>
            <span style={{ fontSize: "11px", color: "var(--frozen-water)", opacity: 0.9 }}>
              DSA Warehouse Logistics
            </span>
          </div>
        </div>

        {/* Grouped Navigation Links */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          {navGroups.map((grp, gIdx) => (
            <div
              key={grp.group}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                borderLeft: gIdx > 0 ? "1px solid rgba(202, 233, 255, 0.2)" : "none",
                paddingLeft: gIdx > 0 ? "14px" : "0",
              }}
            >
              {grp.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    style={{
                      background: isActive ? "var(--pacific-blue)" : "rgba(255, 255, 255, 0.05)",
                      color: isActive ? "var(--yale-blue)" : "var(--pale-sky)",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: isActive ? 700 : 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                      border: isActive
                        ? "1px solid var(--frozen-water)"
                        : "1px solid transparent",
                    }}
                  >
                    <span>{item.label}</span>
                    <span
                      style={{
                        background: isActive ? "var(--yale-blue)" : "rgba(202, 233, 255, 0.15)",
                        color: isActive ? "#ffffff" : "var(--frozen-water)",
                        fontSize: "9px",
                        padding: "1px 5px",
                        borderRadius: "10px",
                        fontWeight: 700,
                      }}
                    >
                      {item.badge}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "11px", color: "var(--frozen-water)", display: "block" }}>
              Operator
            </span>
            <strong style={{ fontSize: "13px", color: "#ffffff" }}>
              {user?.username || "admin"}
            </strong>
          </div>
          <button
            onClick={logout}
            style={{
              background: "rgba(230, 57, 70, 0.15)",
              border: "1px solid rgba(230, 57, 70, 0.4)",
              color: "#ffb4b9",
              padding: "5px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

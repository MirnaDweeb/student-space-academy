import React from 'react';

/**
 * Premium institutional skeleton loading state for Egyptian Space Agency Dashboard.
 */
export default function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton-root animate-pulse-subtle" aria-busy="true" aria-label="Loading dashboard">
      {/* Hero Skeleton */}
      <div className="skeleton-hero-card mb-4">
        <div className="skeleton-bar mb-3" style={{ width: '220px', height: '24px', borderRadius: '12px' }} />
        <div className="skeleton-bar mb-2" style={{ width: '60%', height: '36px', borderRadius: '6px' }} />
        <div className="skeleton-bar mb-4" style={{ width: '45%', height: '18px', borderRadius: '4px' }} />
        <div className="d-flex gap-2">
          <div className="skeleton-bar" style={{ width: '140px', height: '38px', borderRadius: '6px' }} />
          <div className="skeleton-bar" style={{ width: '130px', height: '38px', borderRadius: '6px' }} />
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="dashboard-stats-grid mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="dashboard-stat-card skeleton-stat-card">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="skeleton-bar" style={{ width: '80px', height: '14px' }} />
              <div className="skeleton-bar rounded-circle" style={{ width: '32px', height: '32px' }} />
            </div>
            <div className="skeleton-bar mb-2" style={{ width: '60px', height: '28px' }} />
            <div className="skeleton-bar" style={{ width: '90px', height: '12px' }} />
          </div>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="egsa-institutional-card mb-4 p-4">
            <div className="d-flex justify-content-between mb-4">
              <div className="skeleton-bar" style={{ width: '180px', height: '20px' }} />
              <div className="skeleton-bar" style={{ width: '100px', height: '20px' }} />
            </div>
            <div className="skeleton-bar mb-2" style={{ width: '75%', height: '24px' }} />
            <div className="skeleton-bar mb-3" style={{ width: '50%', height: '14px' }} />
            <div className="skeleton-bar" style={{ width: '100%', height: '60px', borderRadius: '8px' }} />
          </div>

          <div className="egsa-institutional-card mb-4 p-4">
            <div className="skeleton-bar mb-3" style={{ width: '200px', height: '20px' }} />
            <div className="skeleton-bar" style={{ width: '100%', height: '80px', borderRadius: '8px' }} />
          </div>
        </div>

        <div className="col-lg-4">
          <div className="egsa-institutional-card mb-4 p-4">
            <div className="skeleton-bar mb-3" style={{ width: '160px', height: '20px' }} />
            <div className="d-flex flex-column gap-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="skeleton-bar" style={{ width: '100%', height: '48px', borderRadius: '6px' }} />
              ))}
            </div>
          </div>

          <div className="egsa-institutional-card p-4">
            <div className="skeleton-bar mb-3" style={{ width: '150px', height: '20px' }} />
            <div className="d-flex flex-column gap-2">
              {[1, 2, 3].map((k) => (
                <div key={k} className="skeleton-bar" style={{ width: '100%', height: '52px', borderRadius: '6px' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

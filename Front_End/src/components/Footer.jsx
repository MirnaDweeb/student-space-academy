import React from 'react';

export default function Footer() {
  return (
    <footer className="border-top mt-5 py-4 bg-white">
      <div className="container d-flex flex-column flex-md-row justify-content-between align-items-center small text-muted">
        <span>&copy; {new Date().getFullYear()} EGSA Space Academy. All rights reserved.</span>
        <span>Egyptian Space Agency — Professional Education + Space Technology</span>
      </div>
    </footer>
  );
}

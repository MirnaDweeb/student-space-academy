import React, { useState } from 'react';

/**
 * BrandLogo
 * Displays the official Egyptian Space Agency logo from /assets/logo.png
 * with automatic fallback to the established satellite dish icon if the asset
 * has not yet been placed in the public/assets directory.
 */
export default function BrandLogo({ height = 36, className = 'me-2', showText = false, textClassName = '' }) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <span className="d-inline-flex align-items-center">
      {!hasError && (
        <img
          src="/assets/logo.png"
          alt="Egyptian Space Agency Logo"
          className={`${className} egsa-brand-logo`}
          style={{
            height: `${height}px`,
            maxHeight: `${height}px`,
            width: 'auto',
            objectFit: 'contain',
            display: isLoaded ? 'inline-block' : 'none',
          }}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}
      {(!isLoaded || hasError) && (
        <i
          className={`fa-solid fa-satellite-dish text-primary-egsa ${className}`}
          style={{ fontSize: `${Math.round(height * 0.65)}px` }}
          title="EGSA Space Academy"
        ></i>
      )}
      {showText && (
        <span className={textClassName || 'fw-bold'}>EGSA Space Academy</span>
      )}
    </span>
  );
}

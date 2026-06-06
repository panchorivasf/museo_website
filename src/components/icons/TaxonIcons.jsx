import React from 'react';

export function WhaleTail({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Left fluke */}
      <path d="M2 18 C4 14, 7 13, 9 16" />
      {/* Right fluke */}
      <path d="M22 18 C20 14, 17 13, 15 16" />
      {/* Notch between flukes */}
      <path d="M9 16 C10 18, 12 19, 12 17 C12 19, 14 18, 15 16" />
      {/* Body/peduncle coming up from centre */}
      <path d="M12 17 C12 12, 11 8, 13 5" />
    </svg>
  );
}

export function Frog({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Body */}
      <ellipse cx="12" cy="14" rx="5" ry="4" />
      {/* Left eye bump */}
      <circle cx="8.5" cy="9" r="1.5" />
      {/* Right eye bump */}
      <circle cx="15.5" cy="9" r="1.5" />
      {/* Head connecting eyes to body */}
      <path d="M7 10.5 C7 12, 9 13, 12 13 C15 13, 17 12, 17 10.5" />
      {/* Left front leg */}
      <path d="M7 14 C5 13, 3 14, 2 16" />
      {/* Right front leg */}
      <path d="M17 14 C19 13, 21 14, 22 16" />
      {/* Left back leg */}
      <path d="M8 17 C6 18, 4 20, 3 21" />
      {/* Right back leg */}
      <path d="M16 17 C18 18, 20 20, 21 21" />
    </svg>
  );
}

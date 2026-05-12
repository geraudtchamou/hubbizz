'use client';

export const OfflineBanner = () => {
  if (typeof window === 'undefined') return null;

  const isOnline = navigator.onLine;

  if (isOnline) return null;

  return (
    <div className="offline-banner fixed top-0 left-0 right-0 z-[9999]">
      ⚠️ You are offline. Some features may be limited.
    </div>
  );
};

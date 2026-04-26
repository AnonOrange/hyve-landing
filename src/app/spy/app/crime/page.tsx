import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const CrimeMapView = dynamic(() => import('./CrimeMapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#020D14] text-[#94A3B8]">
      <div className="font-mono text-xs uppercase tracking-[0.4em]">loading crime data…</div>
    </div>
  ),
});

export default function CrimePage() {
  return (
    <Suspense>
      <CrimeMapView />
    </Suspense>
  );
}

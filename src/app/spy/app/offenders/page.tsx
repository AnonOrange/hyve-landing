import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const OffenderMapView = dynamic(() => import('./OffenderMapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#020D14] text-[#94A3B8]">
      <div className="font-mono text-xs uppercase tracking-[0.4em]">loading offender registry…</div>
    </div>
  ),
});

export default function OffendersPage() {
  return (
    <Suspense>
      <OffenderMapView />
    </Suspense>
  );
}

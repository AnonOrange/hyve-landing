import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const SurveillanceMapView = dynamic(() => import('./SurveillanceMapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#020D14] text-[#94A3B8]">
      <div className="font-mono text-xs uppercase tracking-[0.4em]">loading surveillance layers…</div>
    </div>
  ),
});

export default function SurveillancePage() {
  return (
    <Suspense>
      <SurveillanceMapView />
    </Suspense>
  );
}

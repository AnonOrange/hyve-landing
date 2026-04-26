'use client';

import dynamic from 'next/dynamic';

const FeedDetailView = dynamic(() => import('./FeedDetailView'), { ssr: false });

export default function FeedDetailPage() {
  return <FeedDetailView />;
}

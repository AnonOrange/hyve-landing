// Next.js App Router renders this automatically during route transitions
// to any /spy/app/* page. Same radar-sweep visual the in-page loaders use.
import LoadingScanner from './LoadingScanner';

export default function Loading() {
  return <LoadingScanner subtitle="LOADING" />;
}

import { redirect } from 'next/navigation';

export default function LeasingPage() {
  redirect(process.env.NEXT_PUBLIC_SITE_MODE === 'leasing' ? '/' : 'https://leasingscoring.com');
}

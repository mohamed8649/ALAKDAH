import { redirect } from 'next/navigation';

export default function AnalyticsIndex({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/dashboard/analytics/orders`);
}

import { redirect } from 'next/navigation';

export default function ShippingIndex({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/dashboard/shipping/methods`);
}

import { redirect } from 'next/navigation';

export default function CallCenterIndex({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/dashboard/call-center/agents`);
}

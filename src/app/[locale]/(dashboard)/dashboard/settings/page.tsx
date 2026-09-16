import { redirect } from 'next/navigation';

export default function SettingsIndex({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/dashboard/settings/identity`);
}

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Quick contact settings.
 *
 * The phone and WhatsApp buttons are configured alongside the rest of the
 * checkout experience, so this route exists only to keep the app card's
 * settings link working rather than duplicating the same form in two places.
 */
export default function QuickContactPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/dashboard/settings/checkout#quick-contact`);
}

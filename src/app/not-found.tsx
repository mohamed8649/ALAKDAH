import Link from 'next/link';

import './globals.css';

/**
 * Root 404.
 *
 * Reached only for paths outside any locale segment. It must emit its own
 * <html>, because the locale layout that normally does is not in the tree here.
 */
export default function RootNotFound() {
  return (
    <html lang="ar" dir="rtl" data-theme="dark">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center text-foreground">
        <h1 className="text-lg font-semibold">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          الرابط الذي فتحته غير صحيح أو تم حذف المحتوى.
        </p>
        <Link
          href="/ar"
          className="mt-5 rounded-[var(--radius)] bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--primary-foreground)]"
        >
          الصفحة الرئيسية
        </Link>
      </body>
    </html>
  );
}

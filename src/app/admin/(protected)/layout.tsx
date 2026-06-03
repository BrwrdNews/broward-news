import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import SessionProvider from "@/components/SessionProvider";
import AdminNavBadge from "@/components/AdminNavBadge";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Belt-and-suspenders: middleware already blocks unauthenticated requests,
  // but this server-side check prevents any accidental layout render without a session.
  if (!session) redirect("/admin/login");

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <nav className="bg-brand-dark text-white px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-headline font-bold text-lg">
              Broward News <span className="text-brand-red">Admin</span>
            </Link>
            <Link
              href="/admin/stories"
              className="text-sm hover:text-brand-red transition-colors"
            >
              Stories
            </Link>
            <Link
              href="/admin/stories/new"
              className="text-sm hover:text-brand-red transition-colors"
            >
              + New Story
            </Link>
            <AdminNavBadge />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">{session.user?.email}</span>
            <Link
              href="/api/auth/signout"
              className="hover:text-brand-red transition-colors"
            >
              Sign out
            </Link>
          </div>
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </SessionProvider>
  );
}

// Provides the NextAuth SessionProvider client context for the login page
// without any auth-gating (that would cause the redirect loop).
import SessionProvider from "@/components/SessionProvider";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider session={null}>{children}</SessionProvider>;
}

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token }) {
        // Allow the request through if a valid JWT token exists.
        // Pages listed in `pages.signIn` are always allowed by NextAuth,
        // but we also guard here so unauthenticated hits to protected
        // routes redirect to /admin/login without looping.
        return !!token;
      },
    },
    pages: {
      signIn: "/admin/login",
    },
  }
);

export const config = {
  // Match /admin/* but NOT /admin/login or /api/auth/*
  matcher: ["/admin/((?!login$).*)"],
};

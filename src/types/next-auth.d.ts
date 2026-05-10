// Augments NextAuth's Session and JWT types so the rest of the codebase can
// read session.user.activeOrgId without TypeScript complaints.

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Currently active workspace. Resolved on first sign-in. */
      activeOrgId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    activeOrgId?: string | null;
  }
}

export {};

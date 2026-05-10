import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
        // Optional second factor — present only when /api/auth/check-2fa
        // told the client this account requires it. The UI submits it
        // alongside email/password as a single signIn() call.
        totpCode: { label: "2FA код", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        const totpCode =
          typeof credentials.totpCode === "string"
            ? credentials.totpCode
            : "";

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            totp: { select: { secret: true, enabledAt: true } },
          },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }

        // 2FA gate. If enrollment is complete (enabledAt non-null), the
        // request MUST also carry a valid TOTP code. We accept the same
        // ±1-step window the verify endpoint uses. Recovery codes are
        // not handled here — those go through /api/account/2fa/disable
        // by design, not through login.
        if (user.totp?.enabledAt) {
          if (!totpCode) {
            return null;
          }
          // Lazy import — keeps the auth bundle smaller on routes that
          // don't need TOTP verification.
          const { verifyTotpCode } = await import("@/lib/totp");
          if (!verifyTotpCode(totpCode, user.totp.secret)) {
            return null;
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      // Always re-resolve activeOrgId from the DB on every jwt callback
      // invocation. This callback runs only on:
      //   - signIn / signUp (token creation)
      //   - useSession.update() (explicit refresh)
      //   - token rotation
      // It does NOT run on every per-request JWT decode — those are
      // signature-only and don't hit this callback. So the DB cost is
      // bounded to ~once per session lifecycle event, not once per
      // request.
      //
      // Why "always" vs "only on trigger === 'update'": NextAuth v5
      // beta's update() doesn't reliably pass trigger === "update" in
      // every code path, and `if (!token.activeOrgId)` short-circuit
      // makes /switch + reload appear to do nothing because the JWT
      // keeps the previous activeOrgId. Always re-reading is
      // bullet-proof and the perf cost is negligible.
      const userId = token.id as string | undefined;
      if (userId) {
        try {
          token.activeOrgId = await ensureActiveOrg(userId);
        } catch (e) {
          // Don't block sign-in on a workspace bootstrap failure — the
          // user can still see the auth-error UX and try again. Fall
          // through with the previous activeOrgId (or undefined) so the
          // app can show a recovery state.
          console.error("[auth] ensureActiveOrg failed:", e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.activeOrgId =
          (token.activeOrgId as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});

import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/legal-info";

// Public pages allowed for indexing; user-specific and admin surfaces
// disallowed. /api routes never want to be indexed regardless. The
// Disallow list is conservative — anything that's per-user or
// auth-gated stays out, because (a) it can't be served without a
// session anyway and (b) crawlers shouldn't waste budget on them.

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/",
          "/account",
          "/account/",
          "/settings",
          "/settings/",
          "/admin",
          "/admin/",
          "/billing/return",
          "/report/",
          "/generated/",
          "/invite/",
          "/r/",
          "/workspace/",
          "/deadlines",
          "/password-reset",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${BRAND.publicUrl}/sitemap.xml`,
  };
}

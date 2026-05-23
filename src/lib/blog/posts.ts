// Static blog corpus. Posts live as TS modules — body is a render
// function returning JSX — instead of MDX so we don't add a build-time
// dependency. The slug, title, description, keywords, and date are
// the single source of truth for:
//   • /blog index card
//   • /blog/[slug] metadata + canonical
//   • sitemap.xml entries
//   • JSON-LD Article structured data
//
// Adding a new post: append to POSTS and ensure slug uniqueness. The
// blog index renders newest-first by publishedAt.

import type { ReactNode } from "react";
import { rentalEssentials } from "./content/rental-essentials";
import { ndaForIt } from "./content/nda-for-it";
import { gphVsIp } from "./content/gph-vs-ip";
import { servicesContract } from "./content/services-contract";
import { marketplaceAgent } from "./content/marketplace-agent";
import { supplyContract } from "./content/supply-contract";
import { labourProbation } from "./content/labour-probation";
import { loanBetweenCompanies } from "./content/loan-between-companies";
import { agencyContract } from "./content/agency-contract";

export interface BlogPost {
  slug: string;
  title: string;
  /** ≤160 chars — used as meta description and og:description. */
  description: string;
  /** ISO date, e.g. "2026-05-13". Sortable lexicographically. */
  publishedAt: string;
  /** Last meaningful content update. Falls back to publishedAt. */
  updatedAt?: string;
  /** Lead sentence shown on the blog index card. */
  lead: string;
  /** SEO keywords. Not directly rendered; surfaces in metadata.keywords. */
  keywords: string[];
  /** Estimated reading time, minutes. Manually set to avoid pulling in
   *  a counting library for one number. */
  readingTimeMin: number;
  /** Russian-language category — surfaces as a chip on cards. */
  category: string;
  /** Author byline. Anonymous editorial unless we sign with a real name. */
  author: string;
  /** Body renderer — keeps each post's JSX as a separate file so editing
   *  one doesn't bloat this index. */
  Body: () => ReactNode;
}

export const POSTS: BlogPost[] = [
  labourProbation,
  loanBetweenCompanies,
  agencyContract,
  servicesContract,
  marketplaceAgent,
  supplyContract,
  gphVsIp,
  ndaForIt,
  rentalEssentials,
];

export function getPost(slug: string): BlogPost | null {
  return POSTS.find((p) => p.slug === slug) ?? null;
}

export function listPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) =>
    a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0
  );
}

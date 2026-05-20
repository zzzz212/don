import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/legal-info";

// Web App Manifest. Next serves this at /manifest.webmanifest and
// auto-injects <link rel="manifest"> into every page — so the app is
// installable to the phone's home screen with its own icon, splash
// screen and a standalone (no browser chrome) window.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${BRAND.name} — ${BRAND.tagline}`,
    short_name: BRAND.name,
    description:
      "Проверка договоров со ссылками на ГК РФ, шаблоны под российское право и история правок.",
    // Installed app opens straight into the workspace, not the marketing
    // landing — the app handles the auth redirect itself.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ru",
    dir: "ltr",
    background_color: "#f5eddf",
    theme_color: "#f5eddf",
    categories: ["business", "productivity", "finance"],
    icons: [
      {
        src: "/pwa/icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Maskable variant — the OS masks it to its own shape (circle /
      // squircle), so the glyph sits inside a safe zone with the colour
      // bleeding to the edge.
      {
        src: "/pwa/icon?size=512&maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

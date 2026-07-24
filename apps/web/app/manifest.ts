import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Smart Expense - AI",
    short_name: "Smart Expense",
    description: "Track shared income and expenses with clear, secure workspace insights.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fdfcf7",
    theme_color: "#006148",
    dir: "ltr",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

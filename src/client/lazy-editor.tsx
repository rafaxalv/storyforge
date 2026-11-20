"use client";

import dynamic from "next/dynamic";

/** The rich-text editor, loaded only in the browser and only on pages that use it. */
export const LazyEditor = dynamic(() => import("./rich-text-editor"), {
  ssr: false,
  loading: () => <p className="muted small">Loading editor…</p>,
});

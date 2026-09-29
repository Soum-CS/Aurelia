"use client";

import dynamic from "next/dynamic";
import { ExplorerMeta } from "./room-explorer";

const RoomExplorer = dynamic(() => import("./room-explorer"), {
  ssr: false,
  loading: () => <ExplorerSkeleton />,
});

function ExplorerSkeleton() {
  return (
    <div className="card overflow-hidden p-0">
      <div
        className="relative flex aspect-[4/3] w-full items-center justify-center sm:aspect-[16/10]"
        style={{ background: "var(--line)" }}
      >
        <div className="skeleton absolute inset-0 rounded-none opacity-60" />
        <div className="relative text-center">
          <div
            aria-hidden
            className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-current border-t-transparent opacity-50"
          />
          <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
            Preparing your room experience…
          </p>
        </div>
      </div>
      <div className="flex gap-2 border-t border-line px-4 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-7 w-24" />
        ))}
      </div>
    </div>
  );
}

export function ExplorerLazy({
  sceneJson,
  meta,
}: {
  sceneJson: string;
  meta: ExplorerMeta;
}) {
  return <RoomExplorer sceneJson={sceneJson} meta={meta} />;
}

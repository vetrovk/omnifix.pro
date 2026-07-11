import type { ActivityFeedItem } from "../data/activityFeed";

type LiveEngineeringFeedProps = {
  items: ActivityFeedItem[];
};

export function LiveEngineeringFeed({ items }: LiveEngineeringFeedProps) {
  return (
    <footer className="shrink-0 border-t border-white/[0.04] px-6 pt-5 pb-5 md:px-16">
      <div className="max-w-[760px]">
        <div className="mb-5 grid grid-cols-[1fr_auto] items-center gap-4 md:gap-6">
          <div className="flex items-center gap-3">
            <div className="w-[5px] h-[5px] rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-[10px] font-['JetBrains_Mono',monospace] text-white/28 tracking-[0.22em] uppercase">
              Live Engineering Feed
            </span>
          </div>
          <span className="text-[11px] font-[300] text-white/18">
            Latest Open Source activity
          </span>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {items.map(({ source, description, status, href, statusHref, time }) => (
            <div
              key={source + description}
              className="group grid grid-cols-[minmax(0,1fr)_96px] items-center gap-x-4 gap-y-1 py-[9px] transition-colors hover:border-white/[0.08] md:grid-cols-[200px_1fr_128px] md:gap-5"
            >
              <a
                href={href}
                className="min-w-0 truncate text-[11px] font-['JetBrains_Mono',monospace] text-[#38bdf8]/50 transition-colors group-hover:text-[#38bdf8]/70"
              >
                {source}
              </a>
              <a
                href={href}
                className="col-span-2 min-w-0 truncate text-[12px] font-[300] text-white/38 transition-colors group-hover:text-white/55 md:col-span-1"
              >
                {description}
              </a>
              <a
                href={statusHref ?? href}
                className="col-start-2 row-start-1 flex items-center justify-end gap-1.5 md:col-start-auto md:row-start-auto"
              >
                {time && (
                  <span className="text-[10px] font-['JetBrains_Mono',monospace] text-white/24">
                    {time}
                  </span>
                )}
                {status === "live" && (
                  <div className="w-[5px] h-[5px] rounded-full bg-[#22c55e] animate-pulse" />
                )}
                <span
                  className={`text-[11px] font-['JetBrains_Mono',monospace] transition-colors ${
                    statusHref || status === "live"
                      ? "text-[#2dd4bf]/75 group-hover:text-[#2dd4bf]"
                      : "text-white/20 group-hover:text-white/35"
                  }`}
                >
                  {status}
                </span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}

import { NeuralBuildOrbit } from "./NeuralBuildOrbit";

const tags = ["Open Source", "Automation", "AI Engineering", "Homelab"];

const GithubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const TelegramIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const MailIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const actionButtonClass =
  "inline-flex items-center gap-2 px-4 py-2 text-[13px] rounded-lg border transition-colors duration-150";

const actions = [
  { label: "GitHub", href: "https://github.com/vetrovk", icon: <GithubIcon /> },
  { label: "Telegram", href: "https://t.me/kirillvetrov", icon: <TelegramIcon /> },
] as const;

function HeroActions() {
  const mutedButtonClass =
    "border-white/[0.12] bg-white/[0.025] text-white/50 hover:border-[#38bdf8]/25 hover:bg-[#38bdf8]/[0.06] hover:text-white/80";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {actions.map(({ label, href, icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`${actionButtonClass} ${mutedButtonClass}`}
        >
          {icon} {label}
        </a>
      ))}
      <a
        href="mailto:vetrovk@gmail.com"
        className={`${actionButtonClass} ${mutedButtonClass}`}
      >
        <MailIcon /> Contact
      </a>
    </div>
  );
}

export function Hero() {
  return (
    <>
      <header className="flex items-center justify-between px-6 pt-7 pb-6 shrink-0 md:px-16">
        <span className="text-[11px] font-['JetBrains_Mono',monospace] text-white/22 tracking-[0.28em] uppercase">
          Omnifix.Pro
        </span>
      </header>

      <main className="relative flex-1 overflow-hidden px-6 pb-6 md:px-16">
        <NeuralBuildOrbit className="absolute right-16 top-1/2 hidden h-[430px] w-[520px] -translate-y-1/2 lg:block" />

        <div className="relative z-10 flex h-full max-w-[760px] flex-col justify-center">
          <div className="flex items-center gap-3 mb-9">
            <div className="h-px w-7 bg-[#38bdf8]/50" />
            <span className="text-[10px] font-['JetBrains_Mono',monospace] text-[#38bdf8]/65 tracking-[0.22em] uppercase">
              Personal Engineering Hub
            </span>
          </div>

          <div className="mb-9">
            <div className="mb-5 flex items-center gap-4 md:gap-5">
              <img
                src="/omnifix-github-avatar-round-o.png"
                alt="OMNIFIX.PRO mark"
                className="h-[72px] w-[72px] rounded-full object-cover opacity-95 mix-blend-screen md:h-[84px] md:w-[84px]"
              />
              <h1 className="min-w-0 text-[34px] font-[200] leading-none tracking-[-0.025em] text-white/90 sm:text-[42px] md:text-[48px]">
                OMNIFIX.PRO
              </h1>
            </div>
            <p className="w-fit text-[28px] font-[200] text-white/32 leading-[1.08] tracking-[-0.015em] md:text-[30px]">
              Building useful AI systems.
            </p>
          </div>

          <div className="h-px bg-white/[0.055] max-w-2xl mb-10" />

          <div className="flex flex-wrap items-center gap-y-3 mb-12">
            {tags.map((tag, index) => (
              <div key={tag} className="flex items-center">
                <span className="text-[14px] font-[300] text-white/32">{tag}</span>
                {index < tags.length - 1 && (
                  <span className="mx-7 text-white/10 text-sm">·</span>
                )}
              </div>
            ))}
          </div>

          <HeroActions />
        </div>
      </main>
    </>
  );
}

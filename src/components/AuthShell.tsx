import type { ReactNode } from 'react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export const COLLEGE = 'AVS Engineering College (Autonomous), Salem';

/** Split screen used by login / setup. The brand panel is fixed to the viewport; only the form column scrolls. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface lg:grid lg:h-screen lg:grid-cols-2 lg:overflow-hidden">
      <div className="relative flex min-h-screen flex-col lg:h-screen lg:min-h-0 lg:overflow-y-auto">
        <div className="absolute right-3 top-3 z-10"><ThemeToggle /></div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10 sm:px-8">
          <div className="mb-6 flex items-center gap-3">
            <Logo variant="full" className="h-14 w-14 ring-1 ring-line" />
            <div className="min-w-0 leading-tight">
              <p className="text-base font-semibold">AVS Coding &amp; Programming Portal</p>
              <p className="text-xs text-muted">{COLLEGE}</p>
            </div>
          </div>
          {children}
        </div>
      </div>

      <aside className="hidden h-screen flex-col bg-[#21366F] text-white lg:flex" aria-hidden>
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="flex aspect-square w-[min(320px,60%)] items-center justify-center rounded-[2rem] bg-white p-6 shadow-2xl ring-8 ring-white/10">
            <img src="/logo.png" alt="" className="h-full w-full object-contain" draggable={false} />
          </div>
        </div>
        <div className="px-12 pb-12 xl:px-16">
          <p className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/75"><span className="h-px w-8 bg-white/60" />AVS Engineering College (Autonomous)</p>
          <h2 className="max-w-lg text-3xl font-bold leading-tight tracking-tight xl:text-4xl">Consistent practice builds career momentum.</h2>
          <p className="mt-3 max-w-md text-sm text-white/75 xl:text-base">Learn. Practise. Code. Compete. Succeed.</p>
        </div>
      </aside>
    </div>
  );
}

import type { ReactNode } from "react";

/**
 * Flex children default to `min-width: auto`, so neither the title nor the
 * action cluster could shrink below its content and the row pushed past the
 * viewport at 320 px — the Sign out button's edge landed at 326 (BUG-05).
 * `min-w-0` lets both sides shrink, and below 360 px — the only width that
 * still cannot fit them on one row — the row is allowed to wrap.
 *
 * Both details are deliberately narrow in scope. Wrapping unconditionally made
 * flexbox move the whole action cluster onto a second row rather than squeeze
 * the title, which grew the header on every phone size instead of just the one
 * that overflowed; and truncating the title had the same effect, by stopping
 * the short role label from wrapping to the two lines it already used there.
 */
export function TopHeader({ title, actions }: { title: string; actions?: ReactNode }) { return <div className="flex min-h-14 items-center justify-between gap-x-4 gap-y-2 px-4 max-[359px]:flex-wrap md:px-6"><p className="min-w-0 font-semibold">{title}</p><div className="flex min-w-0 items-center gap-2">{actions}</div></div>; }

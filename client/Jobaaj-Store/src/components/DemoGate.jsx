import DemoNotice from "./DemoNotice.jsx";

export default function DemoGate({
  title,
  copy,
  next = "/account",
  adminOnly = false,
  session,
}) {
  const loginHref = `#/login?next=${encodeURIComponent(next)}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8">
      <div className="border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-10">
        <p className="text-[9px] font-bold tracking-[0.16em] text-[var(--olive)] uppercase">
          Demo access
        </p>
        <h1 className="mt-3 text-[32px] leading-tight font-medium tracking-[-0.04em] sm:text-[40px]">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-[12px] leading-7 text-[var(--muted)]">
          {copy}
        </p>

        {session && adminOnly ? (
          <div className="mt-6">
            <p className="text-[12px] leading-7 text-[var(--muted)]">
              You are signed in as{" "}
              <b className="text-[var(--ink)]">{session.email}</b> (
              {session.role}).
            </p>
            <a className="button primary mt-4" href={loginHref}>
              Switch to admin demo
            </a>
          </div>
        ) : (
          <a className="button primary mt-6" href={loginHref}>
            Open demo sign in
          </a>
        )}

        <div className="mt-6 flex flex-wrap gap-5 text-[10px]">
          <a
            className="border-b border-[var(--line)] pb-1 text-[var(--olive)]"
            href="#/"
          >
            Back to store
          </a>
          <a
            className="border-b border-[var(--line)] pb-1 text-[var(--olive)]"
            href="#/register"
          >
            Create a demo account
          </a>
        </div>

        <DemoNotice className="mt-7">
          This gate is frontend-only. It demonstrates protected routes, but it is
          not real authentication.
          {adminOnly
            ? " Sign in with admin@nivora.demo to preview the admin workspace."
            : ""}
        </DemoNotice>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import DemoNotice from "./DemoNotice.jsx";

export default function AuthGate({
  title,
  copy,
  next = "/account",
  adminOnly = false,
  status,
  user,
}) {
  const checking = status === "loading";
  const signedIn = Boolean(user);
  const loginHref = `#/login?next=${encodeURIComponent(next)}`;

  useEffect(() => {
    if (checking || signedIn) return;

    location.replace(`#/login?next=${encodeURIComponent(next)}`);
  }, [checking, signedIn, next]);

  if (checking) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8">
        <div className="border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-10">
          <p className="text-[9px] font-bold tracking-[0.16em] text-[var(--olive)] uppercase">
            Your session
          </p>
          <h1 className="mt-3 text-[32px] leading-tight font-medium tracking-[-0.04em] sm:text-[40px]">
            One moment…
          </h1>
          <p className="mt-4 max-w-xl text-[12px] leading-7 text-[var(--muted)]">
            Checking your Nivora account.
          </p>
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8">
        <div className="border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-10">
          <p className="text-[9px] font-bold tracking-[0.16em] text-[var(--olive)] uppercase">
            Sign in required
          </p>
          <h1 className="mt-3 text-[32px] leading-tight font-medium tracking-[-0.04em] sm:text-[40px]">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-[12px] leading-7 text-[var(--muted)]">
            {copy}
          </p>
          <a className="button primary mt-6" href={loginHref}>
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8">
      <div className="border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-10">
        <p className="text-[9px] font-bold tracking-[0.16em] text-[var(--olive)] uppercase">
          Restricted area
        </p>
        <h1 className="mt-3 text-[32px] leading-tight font-medium tracking-[-0.04em] sm:text-[40px]">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-[12px] leading-7 text-[var(--muted)]">
          {copy}
        </p>
        <p className="mt-4 text-[12px] leading-7 text-[var(--muted)]">
          Signed in as <b className="text-[var(--ink)]">{user.email}</b> (
          {user.role}).
        </p>
        <div className="mt-6 flex flex-wrap gap-5 text-[10px]">
          <a
            className="border-b border-[var(--line)] pb-1 text-[var(--olive)]"
            href="#/account"
          >
            Your account
          </a>
          <a
            className="border-b border-[var(--line)] pb-1 text-[var(--olive)]"
            href="#/"
          >
            Back to store
          </a>
        </div>

        {adminOnly && (
          <DemoNotice className="mt-7">
            This account does not have administrator permissions. The Nivora API
            enforces the same role check, so this page cannot be opened by
            changing browser data.
          </DemoNotice>
        )}
      </div>
    </div>
  );
}

const tones = {
  loading: "border-[var(--olive)] bg-[var(--sand)] text-[var(--muted)]",
  fallback: "border-[var(--terracotta)] bg-[var(--sand)] text-[var(--ink)]",
  error: "border-[var(--terracotta)] bg-[var(--sand)] text-[var(--terracotta)]",
};

export default function CatalogueStatus({
  status,
  error = "",
  onRetry,
  fallbackMessage = "The live catalogue is unavailable, so sample pieces are being shown.",
  loadingMessage = "Checking the live catalogue…",
}) {
  if (!status || ["idle", "ready", "not-found"].includes(status)) {
    return null;
  }

  const isError = status === "error";
  const title =
    status === "fallback"
      ? "Demo catalogue"
      : isError
        ? "Catalogue unavailable"
        : "Loading catalogue";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`my-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-l-2 px-3.5 py-3 text-[11px] leading-relaxed ${tones[status] || tones.loading}`}
    >
      <strong className="font-semibold">{title}</strong>
      <span>
        {status === "fallback"
          ? fallbackMessage
          : isError
            ? error || "We could not load the collection. Please try again."
            : loadingMessage}
      </span>
      {(status === "fallback" || isError) && onRetry && (
        <button
          type="button"
          className="border-b border-current pb-0.5 font-semibold"
          onClick={onRetry}
        >
          Try again
        </button>
      )}
    </div>
  );
}

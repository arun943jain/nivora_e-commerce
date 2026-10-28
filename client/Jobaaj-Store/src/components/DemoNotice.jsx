const tones = {
  info: "border-[var(--olive)] bg-[var(--sand)] text-[var(--ink)]",
  success: "border-[var(--olive)] bg-[var(--sand)] text-[var(--olive)]",
  error: "border-[var(--terracotta)] bg-[var(--sand)] text-[var(--terracotta)]",
};

export default function DemoNotice({ children, tone = "info", className = "" }) {
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "note"}
      className={`my-4 border-l-2 px-3.5 py-3 text-[11px] leading-relaxed ${tones[tone] || tones.info} ${className}`}
    >
      {children}
    </div>
  );
}

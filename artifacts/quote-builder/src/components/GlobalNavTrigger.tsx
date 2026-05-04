import { useGlobalNav } from "@/context/GlobalNavContext";

export default function GlobalNavTrigger() {
  const { setOpen } = useGlobalNav();
  return (
    <button
      type="button"
      className="btn-icon sidebar-toggle"
      onClick={() => setOpen((v) => !v)}
      title="Open navigation"
      aria-label="Open navigation"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

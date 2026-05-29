import { useGlobalNav } from "@/context/GlobalNavContext";
import { Menu } from "lucide-react";

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
      <Menu size={18} />
    </button>
  );
}

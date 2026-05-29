import { createContext, useContext, useRef, useState } from "react";
import type { Quote } from "../types";

export interface ActiveQuoteState {
  currentId: string;
  currentStatus?: "pass" | "fail" | null;
  refreshTrigger: number;
}

export interface QuoteCallbacks {
  onSelect: (q: Quote) => void;
  onNew: () => void;
  onDuplicate?: (q: Quote) => Promise<void>;
}

interface SidebarQuoteContextValue {
  activeState: ActiveQuoteState | null;
  setActiveState: React.Dispatch<React.SetStateAction<ActiveQuoteState | null>>;
  callbacksRef: React.MutableRefObject<QuoteCallbacks | null>;
}

const SidebarQuoteContext = createContext<SidebarQuoteContextValue>({
  activeState: null,
  setActiveState: () => {},
  callbacksRef: { current: null },
});

export function SidebarQuoteProvider({ children }: { children: React.ReactNode }) {
  const [activeState, setActiveState] = useState<ActiveQuoteState | null>(null);
  const callbacksRef = useRef<QuoteCallbacks | null>(null);
  return (
    <SidebarQuoteContext.Provider value={{ activeState, setActiveState, callbacksRef }}>
      {children}
    </SidebarQuoteContext.Provider>
  );
}

export function useSidebarQuoteContext() {
  return useContext(SidebarQuoteContext);
}

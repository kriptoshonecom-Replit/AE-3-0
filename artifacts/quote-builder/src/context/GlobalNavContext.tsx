import { createContext, useContext, useState } from "react";

interface GlobalNavCtx {
  open: boolean;
  setOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
}

const GlobalNavContext = createContext<GlobalNavCtx>({ open: false, setOpen: () => {} });

export function GlobalNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <GlobalNavContext.Provider value={{ open, setOpen }}>
      {children}
    </GlobalNavContext.Provider>
  );
}

export function useGlobalNav() {
  return useContext(GlobalNavContext);
}

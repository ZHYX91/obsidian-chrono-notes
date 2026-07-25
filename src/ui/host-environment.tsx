import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

export interface HostEnvironment {
  readonly document: Document;
  readonly window: Window;
}

const HostEnvironmentContext = createContext<HostEnvironment | null>(null);

export function HostEnvironmentProvider({
  children,
  document,
}: Readonly<{
  children: ReactNode;
  document: Document;
}>) {
  const value = useMemo(
    () => Object.freeze({
      document,
      window: getDocumentWindow(document),
    }),
    [document],
  );

  return (
    <HostEnvironmentContext.Provider value={value}>
      {children}
    </HostEnvironmentContext.Provider>
  );
}

export function useHostEnvironment(): HostEnvironment {
  const environment = useContext(HostEnvironmentContext);
  if (environment !== null) return environment;
  return getDefaultHostEnvironment();
}

function getDefaultHostEnvironment(): HostEnvironment {
  if (typeof document === "undefined") {
    throw new Error("Chrono Notes Calendar: host document is unavailable");
  }
  return Object.freeze({
    document,
    window: getDocumentWindow(document),
  });
}

function getDocumentWindow(document: Document): Window {
  const ownerWindow = document.defaultView;
  if (ownerWindow === null) {
    throw new Error("Chrono Notes Calendar: host window is unavailable");
  }
  return ownerWindow;
}

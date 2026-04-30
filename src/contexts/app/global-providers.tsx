"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";

type GlobalProvidersProps = {
  readonly children: ReactNode;
};

export function GlobalProviders({ children }: GlobalProvidersProps) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}

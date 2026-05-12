"use client";

import React from "react";
import { useFeatureFlag } from "@/context/FeatureFlagContext";
import { FeatureDisabled } from "@/components/ui/feature-disabled";
import type { FlagKey } from "@/lib/flags";

/** Higher-order component that gates a page or panel behind a feature flag.
 * Renders <FeatureDisabled/> when the flag is off. The wrapped component's
 * hooks are not called when the flag is off, but since the gate is always
 * the only hook in the wrapper, hook ordering is preserved.
 */
export function withFlagGate<P extends object>(
  Component: React.ComponentType<P>,
  flag: FlagKey,
  label?: string
) {
  function FlagGated(props: P) {
    const enabled = useFeatureFlag(flag);
    if (!enabled) return <FeatureDisabled flag={flag} label={label} />;
    return <Component {...props} />;
  }
  FlagGated.displayName = `FlagGated(${Component.displayName ?? Component.name ?? "Component"})`;
  return FlagGated;
}

/** Inline JSX gate for use within larger components. Same wrap semantics. */
export function FlagGate({
  flag,
  label,
  children,
}: {
  flag: FlagKey;
  label?: string;
  children: React.ReactNode;
}) {
  const enabled = useFeatureFlag(flag);
  if (!enabled) return <FeatureDisabled flag={flag} label={label} />;
  return <>{children}</>;
}

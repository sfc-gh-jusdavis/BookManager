import { FlaskConical } from "lucide-react";

export function FeatureDisabled({ flag, label }: { flag: string; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <FlaskConical size={28} className="text-slate-300 mb-3" />
      <p className="text-sm font-medium text-slate-700">
        {label ?? "This feature is currently disabled."}
      </p>
      <p className="mt-1 text-xs text-slate-400 font-mono">{flag}</p>
      <p className="mt-3 text-xs text-slate-500">
        An admin can enable it under Settings &gt; Labs.
      </p>
    </div>
  );
}

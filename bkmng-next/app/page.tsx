"use client";

import { useAuth } from "@/context/AuthContext";
import { withFlagGate } from "@/components/ui/flag-gate";
import { ACEDashboard } from "@/components/dashboard/ACEDashboard";
import { ACEMDashboard } from "@/components/dashboard/ACEMDashboard";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardPage() {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (currentUser?.role === "acem") return <ACEMDashboard />;
  return <ACEDashboard />;
}

export default withFlagGate(DashboardPage, "page_dashboard");

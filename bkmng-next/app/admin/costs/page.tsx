"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAdminCosts } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { DollarSign, TrendingUp, AlertTriangle, Activity } from "lucide-react";

type CostData = {
  total_credits_used: number;
  month_over_month_change: number;
  top_consumers: { user_id: string; credits: number; warehouse: string }[];
  by_warehouse: { warehouse: string; credits: number }[];
  daily_trend: { date: string; credits: number }[];
};

function creditsShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${Math.round(n / 1000)}K`;
}

const COLORS = ["#29B5E8", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#64748b"];

export default function AdminCostsPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.is_admin;

  const { data: costsRaw, isLoading } = useAdminCosts() as { data: CostData | undefined; isLoading: boolean };

  const costs = costsRaw as CostData | undefined;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24">
        <DollarSign size={32} className="text-slate-300" />
        <p className="text-slate-500">Admin access required.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!costs) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24">
        <Activity size={32} className="text-slate-300" />
        <p className="text-slate-500">No cost data available.</p>
      </div>
    );
  }

  const momChange = costs.month_over_month_change ?? 0;

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-5 border-b border-slate-100">
        <h1 className="text-xl font-semibold text-slate-900">Cost Monitor</h1>
        <p className="text-sm text-slate-500 mt-0.5">Snowflake credit consumption overview</p>
      </div>

      <div className="px-6 py-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-sky-500" />
                <p className="text-sm text-slate-500">Total Credits Used</p>
              </div>
              <p className="text-3xl font-bold text-slate-900">{creditsShort(costs.total_credits_used ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className={momChange >= 0 ? "text-red-500" : "text-emerald-500"} />
                <p className="text-sm text-slate-500">Month-over-Month</p>
              </div>
              <p className={`text-3xl font-bold ${momChange >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                {momChange >= 0 ? "+" : ""}{momChange.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className="text-amber-500" />
                <p className="text-sm text-slate-500">Top Consumer</p>
              </div>
              <p className="text-xl font-bold text-slate-900">
                {costs.top_consumers?.[0]?.user_id ?? "—"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{creditsShort(costs.top_consumers?.[0]?.credits ?? 0)} credits</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Credits by Warehouse</CardTitle>
            </CardHeader>
            <CardContent>
              {costs.by_warehouse?.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart layout="vertical" data={costs.by_warehouse} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v: number) => creditsShort(v)} />
                    <YAxis type="category" dataKey="warehouse" width={110} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [creditsShort(v), "Credits"]} />
                    <Bar dataKey="credits" radius={[0, 4, 4, 0]}>
                      {costs.by_warehouse.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-slate-400 py-8 text-center">No warehouse data.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Top Consumers</CardTitle>
            </CardHeader>
            <CardContent>
              {costs.top_consumers?.length ? (
                <div className="divide-y divide-slate-100">
                  {costs.top_consumers.map((c, i) => (
                    <div key={c.user_id} className="flex items-center gap-3 py-2.5">
                      <span className="w-5 text-xs font-bold text-slate-400 tabular-nums">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{c.user_id}</p>
                        <p className="text-xs text-slate-500">{c.warehouse}</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-700 tabular-nums">{creditsShort(c.credits)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-8 text-center">No consumer data.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {costs.daily_trend?.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Daily Credit Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={costs.daily_trend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8"
                    tickFormatter={(v: string) => { const [, m, d] = v.split("-"); return `${m}/${d}`; }} />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v: number) => creditsShort(v)} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [creditsShort(v), "Credits"]} />
                  <Bar dataKey="credits" fill="#29B5E8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

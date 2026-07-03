import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

export default function AnalyticsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', projectId],
    queryFn: () => analyticsApi.get(projectId!),
    enabled: !!projectId,
    refetchInterval: 10000,
  });

  const analytics = data?.data?.data;
  const summary = analytics?.summary;
  const hourly = analytics?.hourlyDistribution || [];
  const topIds = analytics?.topIdentifiers || [];
  const algoStats = analytics?.algorithmStats || [];

  if (isLoading) return <div className="text-center py-20 text-gray-500">Loading analytics...</div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <h2 className="text-2xl font-bold text-white">Analytics</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-hover">
          <p className="stat-label">Total Requests</p>
          <p className="stat-value">{(summary?.totalRequests || 0).toLocaleString()}</p>
        </div>
        <div className="card-hover">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <p className="stat-label">Allowed</p>
          </div>
          <p className="stat-value text-green-400">{(summary?.allowedRequests || 0).toLocaleString()}</p>
        </div>
        <div className="card-hover">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <p className="stat-label">Blocked</p>
          </div>
          <p className="stat-value text-red-400">{(summary?.blockedRequests || 0).toLocaleString()}</p>
        </div>
        <div className="card-hover">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <p className="stat-label">Avg Latency</p>
          </div>
          <p className="stat-value">{summary?.avgLatency || 0}ms</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hourly Distribution */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-white mb-4">Hourly Distribution (24h)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                <Bar dataKey="allowed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="blocked" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Algorithm Distribution */}
        <div className="card">
          <h3 className="font-semibold text-white mb-4">Algorithm Usage</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={algoStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="count"
                  nameKey="algorithm"
                  paddingAngle={2}
                >
                  {algoStats.map((_: unknown, index: number) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {algoStats.map((a: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-gray-300">{a.algorithm as string}</span>
                <span className="text-gray-500 ml-auto">{a.count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Identifiers */}
      <div className="card">
        <h3 className="font-semibold text-white mb-4">Top Identifiers</h3>
        <div className="divide-y divide-gray-800">
          {topIds.length === 0 ? (
            <p className="text-gray-500 py-4 text-center">No data yet</p>
          ) : (
            topIds.map((t: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <span className="text-gray-500 text-sm w-6">#{i + 1}</span>
                <span className="font-mono text-sm text-gray-200 flex-1">{t.identifier as string}</span>
                <span className="text-sm text-gray-400">{t.count as number} requests</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

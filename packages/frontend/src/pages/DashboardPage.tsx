import { useQuery } from '@tanstack/react-query';
import { projectsApi, analyticsApi } from '@/lib/api';
import {
  Shield,
  Key,
  TrendingUp,
  AlertTriangle,
  Activity,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getSocket, subscribeToProject } from '@/lib/socket';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  const projects = projectsData?.data?.data || [];
  const firstProjectId = projects[0]?.id;

  const [liveMetrics, setLiveMetrics] = useState({
    currentRPS: 0,
    totalRequests: 0,
    allowedRequests: 0,
    blockedRequests: 0,
  });

  // Real-time WebSocket updates
  useEffect(() => {
    if (!firstProjectId) return;
    const unsub = subscribeToProject(firstProjectId, (metrics: Record<string, unknown>) => {
      setLiveMetrics({
        currentRPS: (metrics.currentRPS as number) || 0,
        totalRequests: (metrics.totalRequests as number) || 0,
        allowedRequests: (metrics.allowedRequests as number) || 0,
        blockedRequests: (metrics.blockedRequests as number) || 0,
      });
    });
    return unsub;
  }, [firstProjectId]);

  const stats = [
    {
      label: 'Total Projects',
      value: projects.length,
      icon: Shield,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10',
    },
    {
      label: 'Current RPS',
      value: liveMetrics.currentRPS,
      icon: Activity,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Total Requests',
      value: liveMetrics.totalRequests.toLocaleString(),
      icon: TrendingUp,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Blocked',
      value: liveMetrics.blockedRequests,
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card-hover">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">{stat.label}</p>
                <p className="stat-value mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Request Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Request Activity</h2>
            <p className="text-sm text-gray-400">Real-time request throughput</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Zap className="w-4 h-4 text-yellow-400" />
            Live
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={generateMockData()}>
              <defs>
                <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area type="monotone" dataKey="allowed" stroke="#22c55e" fillOpacity={1} fill="url(#colorAllowed)" />
              <Area type="monotone" dataKey="blocked" stroke="#ef4444" fillOpacity={1} fill="url(#colorBlocked)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Start */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Start</h2>
        <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm">
          <p className="text-gray-400"># Install the SDK</p>
          <p className="text-green-400">npm install @flowshield/sdk</p>
          <p className="text-gray-400 mt-3"># Use in Express</p>
          <p className="text-blue-400">import {'{'} FlowShield {'}'} from '@flowshield/sdk';</p>
          <p className="text-blue-400">const shield = new FlowShield({'{'} apiKey: 'fs_your_key' {'}'});</p>
          <p className="text-blue-400">app.use(shield.middleware());</p>
        </div>
      </div>
    </div>
  );
}

function generateMockData() {
  return Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    allowed: Math.floor(Math.random() * 500 + 200),
    blocked: Math.floor(Math.random() * 50 + 5),
  }));
}

import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/lib/api';
import { User, Shield, Key, Clock } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();

  const { data: auditData } = useQuery({
    queryKey: ['audit'],
    queryFn: () => auditApi.list({ pageSize: '20' }),
  });

  const logs = auditData?.data?.data?.logs || [];

  return (
    <div className="space-y-6 animate-slide-up">
      <h2 className="text-2xl font-bold text-white">Settings</h2>

      {/* Profile */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-5 h-5 text-brand-400" />
          <h3 className="font-semibold text-white">Profile</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input className="input" defaultValue={user?.name} readOnly />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input className="input" defaultValue={user?.email} readOnly />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Role</label>
            <div className="flex items-center gap-2 mt-2">
              <Shield className="w-4 h-4 text-brand-400" />
              <span className="text-white">{user?.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <Key className="w-5 h-5 text-brand-400" />
          <h3 className="font-semibold text-white">Plan</h3>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Free Plan</p>
              <p className="text-sm text-gray-400">3 projects • 20 API keys per project</p>
            </div>
            <button className="btn-primary text-sm">Upgrade</button>
          </div>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-5 h-5 text-brand-400" />
          <h3 className="font-semibold text-white">Recent Activity</h3>
        </div>
        <div className="divide-y divide-gray-800">
          {logs.length === 0 ? (
            <p className="text-gray-500 py-4 text-center">No activity yet</p>
          ) : (
            logs.map((log: Record<string, unknown>) => (
              <div key={log.id as string} className="flex items-center gap-3 py-3">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  <Key className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white">{log.action as string}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(log.createdAt as string).toLocaleString()}
                  </p>
                </div>
                {log.ipAddress && (
                  <span className="text-xs text-gray-500 font-mono">{log.ipAddress as string}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

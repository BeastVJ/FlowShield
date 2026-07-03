import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, keysApi } from '@/lib/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Key, Plus, RotateCw, Trash2, Copy, Eye, EyeOff } from 'lucide-react';
import { AlgorithmType } from '@/lib/types';

const ALGORITHMS = [
  { value: 'FIXED_WINDOW', label: 'Fixed Window', desc: 'Simple counter per time window' },
  { value: 'SLIDING_WINDOW', label: 'Sliding Window', desc: 'Weighted interpolation, smooth' },
  { value: 'SLIDING_LOG', label: 'Sliding Log', desc: 'Exact timestamp tracking' },
  { value: 'TOKEN_BUCKET', label: 'Token Bucket', desc: 'Allows controlled bursts' },
  { value: 'LEAKY_BUCKET', label: 'Leaky Bucket', desc: 'Constant rate processing' },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [algorithm, setAlgorithm] = useState('FIXED_WINDOW');
  const [maxRequests, setMaxRequests] = useState(100);
  const [windowMs, setWindowMs] = useState(60000);
  const [showKey, setShowKey] = useState<string | null>(null);

  const { data: projectData } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  });

  const { data: keysData, isLoading } = useQuery({
    queryKey: ['keys', id],
    queryFn: () => keysApi.list(id!),
    enabled: !!id,
  });

  const createMutation = useMutation({
    mutationFn: () => keysApi.create(id!, { name: keyName, algorithm, maxRequests, windowMs }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['keys', id] });
      toast.success('API key created!');
      setShowCreate(false);
      setKeyName('');
      setShowKey(res.data.data.key);
    },
    onError: () => toast.error('Failed to create API key'),
  });

  const rotateMutation = useMutation({
    mutationFn: (keyId: string) => keysApi.rotate(id!, keyId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['keys', id] });
      toast.success('API key rotated');
      setShowKey(res.data.data.key);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => keysApi.revoke(id!, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys', id] });
      toast.success('API key revoked');
    },
  });

  const project = projectData?.data?.data;
  const keys = keysData?.data?.data || [];

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-2xl font-bold text-white">{(project as Record<string, unknown>)?.name as string || 'Project'}</h2>
        <p className="text-gray-400 text-sm mt-1">{(project as Record<string, unknown>)?.description as string || ''}</p>
      </div>

      {/* New Key Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">API Keys</h3>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Generate Key
        </button>
      </div>

      {/* Create Key Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="card w-full max-w-lg animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Generate API Key</h3>

            <input className="input mb-3" placeholder="Key name" value={keyName} onChange={(e) => setKeyName(e.target.value)} />

            <label className="block text-sm font-medium text-gray-300 mb-1.5">Algorithm</label>
            <select className="input mb-3" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
              {ALGORITHMS.map((a) => (
                <option key={a.value} value={a.value}>{a.label} — {a.desc}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Max Requests</label>
                <input type="number" className="input" value={maxRequests} onChange={(e) => setMaxRequests(+e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Window (ms)</label>
                <input type="number" className="input" value={windowMs} onChange={(e) => setWindowMs(+e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!keyName} className="btn-primary flex-1">Generate</button>
            </div>
          </div>
        </div>
      )}

      {/* Show new key warning */}
      {showKey && (
        <div className="card border-yellow-500/30 bg-yellow-500/5">
          <p className="text-yellow-400 text-sm font-medium mb-2">⚠️ Save this API key — it won't be shown again:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-800 px-3 py-2 rounded text-sm text-gray-200 break-all">{showKey}</code>
            <button onClick={() => { navigator.clipboard.writeText(showKey); toast.success('Copied!'); }} className="btn-secondary p-2">
              <Copy className="w-4 h-4" />
            </button>
            <button onClick={() => setShowKey(null)} className="btn-secondary p-2">
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="py-10 text-center text-gray-500">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            <Key className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            <p>No API keys yet. Generate one to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {keys.map((k: Record<string, unknown>) => (
              <div key={k.id as string} className="flex items-center gap-4 p-4 hover:bg-gray-800/50 transition-colors">
                <Key className="w-5 h-5 text-gray-500" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{k.name as string}</p>
                  <p className="text-xs text-gray-500 font-mono">{k.key as string}</p>
                  {k.policy && (
                    <p className="text-xs text-gray-500 mt-1">
                      {(k.policy as Record<string, unknown>).algorithm as string} • {(k.policy as Record<string, unknown>).maxRequests as number} req / {(k.policy as Record<string, unknown>).windowMs as number}ms
                    </p>
                  )}
                </div>
                <span className={k.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}>{k.status as string}</span>
                <div className="flex gap-2">
                  <button onClick={() => rotateMutation.mutate(k.id as string)} className="btn-secondary p-2" title="Rotate">
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button onClick={() => revokeMutation.mutate(k.id as string)} className="btn-danger p-2" title="Revoke">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

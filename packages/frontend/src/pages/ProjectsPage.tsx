import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import { Link } from 'react-router-dom';
import { Plus, FolderKanban, Trash2, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => projectsApi.create({ name, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created!');
      setShowCreate(false);
      setName('');
      setDescription('');
    },
    onError: () => toast.error('Failed to create project'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
  });

  const projects = data?.data?.data || [];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Projects</h2>
          <p className="text-gray-400 text-sm mt-1">Manage your API protection projects</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="card w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Create Project</h3>
            <input
              className="input mb-3"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className="input mb-4"
              placeholder="Description (optional)"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!name}
                className="btn-primary flex-1"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {isLoading ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderKanban className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400">No projects yet</h3>
          <p className="text-gray-500 mt-2">Create your first project to start protecting APIs</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p: Record<string, unknown>) => (
            <div key={p.id as string} className="card-hover">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{p.name as string}</h3>
                  <p className="text-sm text-gray-400 mt-1">{(p.description as string) || 'No description'}</p>
                </div>
                <span className="badge-blue">{(p as Record<string, unknown>)._count ? ((p as Record<string, unknown>)._count as Record<string, unknown>).apiKeys as number : 0} keys</span>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-800">
                <Link to={`/projects/${p.id}`} className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm">
                  <ExternalLink className="w-3.5 h-3.5" /> Manage
                </Link>
                <Link to={`/analytics/${p.id}`} className="btn-secondary text-sm">Analytics</Link>
                <button
                  onClick={() => deleteMutation.mutate(p.id as string)}
                  className="btn-danger p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

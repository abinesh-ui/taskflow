import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Paperclip, Upload, ExternalLink, Trash2 } from 'lucide-react';
import type { Attachment } from '@/types/database';

interface AttachmentsSectionProps {
  taskId: string;
}

export default function AttachmentsSection({ taskId }: AttachmentsSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [fileNameInput, setFileNameInput] = useState('');

  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from('attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      return (data as Attachment[]) || [];
    },
  });

  const addAttachment = useMutation({
    mutationFn: async ({ fileName, externalUrl }: { fileName: string; externalUrl: string }) => {
      const { error } = await supabase.from('attachments').insert({
        task_id: taskId,
        file_name: fileName,
        external_url: externalUrl,
        uploaded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', taskId] });
      setShowUrlInput(false);
      setUrlInput('');
      setFileNameInput('');
      toast({ title: 'Attachment added' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('attachments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', taskId] });
      toast({ title: 'Attachment removed' });
    },
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const filePath = `attachments/${taskId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('task-attachments').upload(filePath, file);

    if (error) {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
      return;
    }

    const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);

    await supabase.from('attachments').insert({
      task_id: taskId,
      file_name: file.name,
      storage_path: filePath,
      external_url: urlData.publicUrl,
      size_bytes: file.size,
      uploaded_by: user!.id,
    });

    queryClient.invalidateQueries({ queryKey: ['attachments', taskId] });
    toast({ title: 'File uploaded' });
  }

  function handleAddUrl(e: React.FormEvent) {
    e.preventDefault();
    if (urlInput.trim() && fileNameInput.trim()) {
      addAttachment.mutate({ fileName: fileNameInput.trim(), externalUrl: urlInput.trim() });
    }
  }

  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1">
          <Paperclip className="h-4 w-4" /> Attachments ({attachments.length})
        </h4>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowUrlInput(!showUrlInput)}>
            <ExternalLink className="h-3 w-3 mr-1" /> URL
          </Button>
          <label>
            <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" asChild>
              <span><Upload className="h-3 w-3 mr-1" /> File</span>
            </Button>
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {showUrlInput && (
        <form onSubmit={handleAddUrl} className="flex gap-2">
          <Input value={fileNameInput} onChange={(e) => setFileNameInput(e.target.value)} placeholder="Name" className="h-7 text-xs w-28" />
          <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://..." className="h-7 text-xs flex-1" />
          <Button type="submit" size="sm" className="h-7 text-xs">Add</Button>
        </form>
      )}

      <div className="space-y-1">
        {attachments.map((a) => (
          <div key={a.id} className="flex items-center gap-2 p-2 rounded border text-xs">
            <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="flex-1 truncate">{a.file_name}</span>
            {a.size_bytes && <span className="text-muted-foreground">{(a.size_bytes / 1024).toFixed(0)}KB</span>}
            {a.external_url && (
              <a href={a.external_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Open
              </a>
            )}
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => deleteAttachment.mutate(a.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

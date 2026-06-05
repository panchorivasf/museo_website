import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function RecordistSelect({ value, onChange }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const queryClient = useQueryClient();

  const { data: recordists = [] } = useQuery({
    queryKey: ['recordists'],
    queryFn: async () => {
      const { data } = await supabase.from('recordists').select('id, name').order('name');
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (name) => {
      const { data, error } = await supabase.from('recordists').insert({ name }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recordists'] });
      onChange(data.name);
      setNewName('');
      setAdding(false);
    },
  });

  const handleAdd = () => {
    if (newName.trim()) addMutation.mutate(newName.trim());
  };

  return (
    <div className="space-y-1.5">
      <Label>Grabador(a)</Label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Seleccionar grabador(a)..." />
          </SelectTrigger>
          <SelectContent>
            {recordists.map(r => (
              <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setAdding(v => !v)}
          title="Agregar nuevo grabador(a)"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {adding && (
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nombre del grabador(a)"
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            autoFocus
          />
          <Button type="button" size="icon" onClick={handleAdd} disabled={addMutation.isPending}>
            <Check className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

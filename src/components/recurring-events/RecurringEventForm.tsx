'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, RefreshCw, Save, Loader2, Users } from 'lucide-react';

interface RecurringEventFormProps {
  initialData?: any;
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function RecurringEventForm({ initialData, onSubmit, loading }: RecurringEventFormProps) {
  const [formData, setFormData] = React.useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    frequency: initialData?.frequency || "weekly",
    startDate: initialData?.startDate || "",
    endDate: initialData?.endDate || "",
    startTime: initialData?.startTime || "19:00",
    endTime: initialData?.endTime || "22:00",
    capacidadeMaxima: initialData?.capacidadeMaxima || 100,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
        <CardContent className="p-8 space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase opacity-60">Nome da Série de Eventos</Label>
            <Input 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="Ex: Workshop de Yoga Semanal"
              required
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase opacity-60">Descrição Base</Label>
            <Textarea 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Descreva o evento recorrente..."
              className="min-h-[120px] rounded-xl resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                <RefreshCw className="w-3 h-3" /> Frequência
              </Label>
              <Select value={formData.frequency} onValueChange={v => setFormData({...formData, frequency: v})}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Data de Início da Série
              </Label>
              <Input 
                type="date"
                value={formData.startDate}
                onChange={e => setFormData({...formData, startDate: e.target.value})}
                required
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Data Final (Opcional)
              </Label>
              <Input 
                type="date"
                value={formData.endDate}
                onChange={e => setFormData({...formData, endDate: e.target.value})}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Hora Início
              </Label>
              <Input 
                type="time"
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
                required
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Hora Fim
              </Label>
              <Input 
                type="time"
                value={formData.endTime}
                onChange={e => setFormData({...formData, endTime: e.target.value})}
                required
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-dashed">
            <div className="space-y-2 max-w-xs">
              <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-secondary" /> Capacidade por Ocorrência
              </Label>
              <Input 
                type="number"
                value={formData.capacidadeMaxima}
                onChange={e => setFormData({...formData, capacidadeMaxima: parseInt(e.target.value) || 0})}
                required
                className="h-11 rounded-xl font-black text-lg"
              />
              <p className="text-[8px] font-black uppercase text-muted-foreground">Cada data da série nascerá com este limite de vagas.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button 
        type="submit" 
        disabled={loading}
        className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg"
      >
        {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />}
        Salvar e Gerar Agenda
      </Button>
    </form>
  );
}

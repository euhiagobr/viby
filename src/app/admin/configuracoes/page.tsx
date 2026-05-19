'use client';

import * as React from 'react';
import { useFirestore, useDoc, useFirebaseApp } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, Save, Layout, ImageIcon, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function AdminConfiguracoesPage() {
  const db = useFirestore();
  const app = useFirebaseApp();
  
  const settingsRef = React.useMemo(() => (db ? doc(db, 'settings', 'site') : null), [db]);
  const { data: settings, loading } = useDoc<any>(settingsRef);

  const [saving, setSaving] = React.useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = React.useState<number | null>(null);
  const [iconUploadProgress, setIconUploadProgress] = React.useState<number | null>(null);
  
  const [logoUrl, setLogoUrl] = React.useState('');
  const [iconUrl, setIconUrl] = React.useState('');
  const [siteName, setSiteName] = React.useState('');

  React.useEffect(() => {
    if (settings) {
      setLogoUrl(settings.logoUrl || '');
      setIconUrl(settings.iconUrl || '');
      setSiteName(settings.siteName || '');
    }
  }, [settings]);

  // Isolamento do Storage Bucket 'viby'
  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, 'gs://viby');
  }, [app]);

  const handleFileUpload = async (file: File, type: 'logo' | 'icon') => {
    if (!storage) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Storage viby não inicializado.' });
      return;
    }

    const setProgress = type === 'logo' ? setLogoUploadProgress : setIconUploadProgress;
    const setUrl = type === 'logo' ? setLogoUrl : setIconUrl;
    
    setProgress(0);

    try {
      const fileName = `${type}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `site_assets/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(progress);
        },
        (error) => {
          setProgress(null);
          toast({ variant: 'destructive', title: 'Erro no upload', description: error.message });
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setUrl(downloadURL);
          setProgress(null);
          toast({ title: 'Upload concluído!', description: `${type === 'logo' ? 'Logotipo' : 'Ícone'} carregado.` });
        }
      );
    } catch (err) {
      setProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db) return;

    setSaving(true);
    
    const settingsData = {
      siteName: siteName || 'Viby',
      logoUrl,
      iconUrl,
      updatedAt: serverTimestamp(),
    };

    setDoc(doc(db, 'settings', 'site'), settingsData, { merge: true })
      .then(() => {
        toast({ title: 'Sucesso', description: 'Configurações de marca atualizadas.' });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: 'settings/site',
          operation: 'write',
          requestResourceData: settingsData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Identidade Visual</h1>
        <p className="text-muted-foreground">Configurações exclusivas da marca Viby.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Layout className="w-5 h-5 text-secondary" />
              Marca da Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 pt-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">Nome do Site</Label>
              <Input 
                id="siteName" 
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Viby"
                required 
                className="rounded-xl h-12"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <Label>Logotipo</Label>
                <div 
                  className="relative aspect-square rounded-2xl bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden group cursor-pointer"
                  onClick={() => document.getElementById('logo-upload')?.click()}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-4" />
                  ) : (
                    <div className="text-center p-4">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Logo</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold">
                    Mudar
                  </div>
                  <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo')} />
                </div>
                {logoUploadProgress !== null && <Progress value={logoUploadProgress} className="h-1" />}
              </div>

              <div className="space-y-4">
                <Label>Ícone (Favicon)</Label>
                <div 
                  className="relative aspect-square rounded-2xl bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden group cursor-pointer"
                  onClick={() => document.getElementById('icon-upload')?.click()}
                >
                  {iconUrl ? (
                    <img src={iconUrl} alt="Icon" className="w-16 h-16 object-contain" />
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ícone</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold">
                    Mudar
                  </div>
                  <input id="icon-upload" type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'icon')} />
                </div>
                {iconUploadProgress !== null && <Progress value={iconUploadProgress} className="h-1" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          className="w-full bg-secondary text-white font-bold h-14 rounded-2xl shadow-lg" 
          disabled={saving || logoUploadProgress !== null || iconUploadProgress !== null}
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Salvar Identidade Viby
        </Button>
      </form>
    </div>
  );
}

"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useAuth, useUser, useStorage } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  addDoc
} from "firebase/firestore"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Download, 
  Plus, 
  Trash2, 
  Loader2, 
  FileText, 
  ImageIcon, 
  Monitor, 
  Type, 
  Layers, 
  MoreHorizontal,
  Edit,
  Save,
  X,
  Upload,
  CheckCircle2,
  AlertTriangle,
  BadgeCheck,
  Star,
  Info
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"

const CATEGORIES = [
  { value: 'logos', label: 'Logos', icon: ImageIcon },
  { value: 'icons', label: 'Ícones', icon: Type },
  { value: 'marketing', label: 'Divulgação', icon: Megaphone },
  { value: 'others', label: 'Outros Arquivos', icon: FileText }
];

interface BrandAssetsClientProps {
  organization: any;
}

export default function BrandAssetsClient({ organization }: BrandAssetsClientProps) {
  const db = useFirestore();
  const auth = useAuth();
  const storage = useStorage();
  const { user } = useUser(auth);
  const { organizations, loading: orgLoading } = useCurrentOrganization();

  // Permissões
  const isOrgAdmin = React.useMemo(() => {
    if (!user || !organization) return false;
    const org = organizations.find(o => o.id === organization.id);
    if (!org) return false;
    const role = org._memberData?.role || (org.ownerId === user.uid ? 'owner' : null);
    return ['owner', 'admin'].includes(role || '');
  }, [user, organization, organizations]);

  // Assets Query
  const assetsQuery = useMemoFirebase(() => 
    db ? query(collection(db, "organizations", organization.id, "brand_assets"), orderBy("sortOrder", "asc"), orderBy("createdAt", "desc")) : null, 
    [db, organization.id]
  );
  const { data: assets, loading: assetsLoading } = useCollection<any>(assetsQuery);

  const [isUploadOpen, setIsInviteOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState<any>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  
  const [newAsset, setNewAsset] = React.useState({
    name: "",
    category: "logos",
    isFeatured: false,
    fileUrl: "",
    storagePath: "",
    mimeType: "",
    size: 0
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user) return;

    setUploadProgress(0);
    try {
      const fileName = `organizations/${organization.id}/brand-assets/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => { setUploadProgress(null); toast({ variant: "destructive", title: "Erro no upload" }); },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setNewAsset(prev => ({ 
            ...prev, 
            fileUrl: downloadURL, 
            storagePath: fileName,
            mimeType: file.type,
            size: file.size,
            name: prev.name || file.name.split('.')[0]
          }));
          setUploadProgress(null);
          toast({ title: "Arquivo carregado!" });
        }
      );
    } catch (err) { setUploadProgress(null); }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !newAsset.fileUrl) return;

    setIsSubmitting(true);
    try {
      const assetData = {
        ...newAsset,
        organizationId: organization.id,
        sortOrder: (assets?.length || 0) + 1,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, "organizations", organization.id, "brand_assets"), assetData);
      toast({ title: "Asset adicionado!" });
      setIsInviteOpen(false);
      setNewAsset({ name: "", category: "logos", isFeatured: false, fileUrl: "", storagePath: "", mimeType: "", size: 0 });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !isEditing) return;

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "organizations", organization.id, "brand_assets", isEditing.id), {
        name: isEditing.name,
        category: isEditing.category,
        isFeatured: isEditing.isFeatured,
        sortOrder: Number(isEditing.sortOrder) || 0,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Alterações salvas!" });
      setIsEditing(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAsset = async (asset: any) => {
    if (!db || !confirm(`Remover "${asset.name}" permanentemente?`)) return;
    try {
      await deleteDoc(doc(db, "organizations", organization.id, "brand_assets", asset.id));
      toast({ title: "Arquivo removido." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  const groupedAssets = React.useMemo(() => {
    const groups: Record<string, any[]> = {
      logos: [],
      icons: [],
      marketing: [],
      others: []
    };
    assets?.forEach(a => {
      if (groups[a.category]) groups[a.category].push(a);
      else groups.others.push(a);
    });
    return groups;
  }, [assets]);

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* HEADER DA MARCA */}
      <section className="relative rounded-[3rem] overflow-hidden bg-primary text-white shadow-2xl">
         <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/media/1920/1080')] bg-cover bg-center grayscale" />
         </div>
         <div className="relative z-10 p-8 md:p-16 flex flex-col md:flex-row items-center gap-10">
            <Avatar className="h-28 w-28 md:h-40 md:w-40 border-8 border-white/10 shadow-2xl rounded-[2.5rem]">
               <AvatarImage src={organization.avatar} className="object-cover" />
               <AvatarFallback className="font-black text-4xl bg-muted text-primary">{organization.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center md:text-left space-y-4">
               <div className="space-y-1">
                  <Badge className="bg-secondary text-white font-black uppercase text-[10px] px-3 border-none">Media Kit Oficial</Badge>
                  <div className="flex items-center justify-center md:justify-start gap-3">
                     <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">{organization.name}</h1>
                     {organization.verified && <BadgeCheck className="w-8 h-8 fill-blue-500 text-white" />}
                  </div>
               </div>
               <p className="text-white/60 font-medium text-sm md:text-lg max-w-2xl uppercase tracking-widest leading-relaxed">
                  Recursos visuais, diretrizes e materiais de divulgação oficiais para parceiros e imprensa.
               </p>
            </div>
            {isOrgAdmin && (
              <Button onClick={() => setIsInviteOpen(true)} className="bg-secondary text-white font-black rounded-2xl h-14 px-10 shadow-xl uppercase italic hover:scale-105 transition-all shrink-0">
                 <Plus className="w-5 h-5 mr-2" /> Upload de Material
              </Button>
            )}
         </div>
      </section>

      {/* LISTAGEM DE ARQUIVOS */}
      <div className="grid grid-cols-1 gap-16">
         {CATEGORIES.map(cat => (
           <section key={cat.value} className="space-y-8">
              <div className="flex items-center gap-3 px-2 border-b border-dashed border-border pb-4">
                 <div className="p-2.5 bg-secondary/10 rounded-xl text-secondary">
                    <cat.icon className="w-5 h-5" />
                 </div>
                 <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">{cat.label}</h2>
                 <Badge variant="secondary" className="font-black ml-auto">{groupedAssets[cat.value].length}</Badge>
              </div>

              {groupedAssets[cat.value].length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                   {groupedAssets[cat.value].map(asset => (
                     <AssetCard 
                        key={asset.id} 
                        asset={asset} 
                        isAdmin={isOrgAdmin} 
                        onEdit={() => setIsEditing({...asset})} 
                        onDelete={() => handleDeleteAsset(asset)} 
                     />
                   ))}
                </div>
              ) : (
                <div className="py-20 text-center bg-white/40 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-3 opacity-30 italic">
                   <Inbox className="w-10 h-10" />
                   <p className="text-[10px] font-black uppercase tracking-widest">Nenhum material nesta categoria</p>
                </div>
              )}
           </section>
         ))}
      </div>

      {/* MODAL: UPLOAD */}
      <Dialog open={isUploadOpen} onOpenChange={setIsInviteOpen}>
         <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden">
            <DialogHeader className="p-8 border-b bg-muted/30">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Upload className="w-6 h-6" /></div>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Novo Material</DialogTitle>
               </div>
            </DialogHeader>
            <form onSubmit={handleCreateAsset} className="p-8 space-y-6">
               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Arquivo (Upload)</Label>
                     <div 
                        className={cn(
                          "relative h-32 rounded-2xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center cursor-pointer transition-all",
                          newAsset.fileUrl ? "border-green-500 bg-green-50/50" : "hover:bg-muted/50"
                        )}
                        onClick={() => document.getElementById('asset-file-up')?.click()}
                      >
                        {newAsset.fileUrl ? (
                          <div className="text-center text-green-600">
                             <CheckCircle2 className="w-10 h-10 mx-auto mb-1" />
                             <p className="text-[9px] font-black uppercase">Arquivo Carregado</p>
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground opacity-50">
                             <Upload className="w-10 h-10 mx-auto mb-1" />
                             <p className="text-[10px] font-black uppercase">Clique para selecionar</p>
                          </div>
                        )}
                        <input id="asset-file-up" type="file" className="hidden" onChange={handleFileUpload} />
                        {uploadProgress !== null && <Progress value={uploadProgress} className="absolute bottom-0 h-1 rounded-none" />}
                     </div>
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome do Recurso</Label>
                     <Input value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} placeholder="Ex: Logo Principal Colorida" required className="rounded-xl h-11" />
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Categoria</Label>
                     <Select value={newAsset.category} onValueChange={v => setNewAsset({...newAsset, category: v})}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                     <Star className={cn("w-5 h-5", newAsset.isFeatured ? "fill-secondary text-secondary" : "text-secondary/20")} />
                     <div className="flex-1"><p className="text-[9px] font-black uppercase text-primary">Marcar como Destaque</p></div>
                     <Switch checked={newAsset.isFeatured} onCheckedChange={v => setNewAsset({...newAsset, isFeatured: v})} />
                  </div>
               </div>

               <DialogFooter>
                  <Button type="submit" disabled={isSubmitting || !newAsset.fileUrl} className="w-full h-14 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic">
                     {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Publicar Arquivo"}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>

      {/* MODAL: EDIÇÃO */}
      <Dialog open={!!isEditing} onOpenChange={(v) => !v && setIsEditing(null)}>
         <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden">
            <DialogHeader className="p-8 border-b bg-muted/30">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary"><Edit className="w-6 h-6" /></div>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Editar Recurso</DialogTitle>
               </div>
            </DialogHeader>
            <form onSubmit={handleUpdateAsset} className="p-8 space-y-6">
               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome do Arquivo</Label>
                     <Input value={isEditing?.name || ""} onChange={e => setIsEditing({...isEditing, name: e.target.value})} required className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Categoria</Label>
                     <Select value={isEditing?.category} onValueChange={v => setIsEditing({...isEditing, category: v})}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                           {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Ordem</Label>
                        <Input type="number" value={isEditing?.sortOrder || 0} onChange={e => setIsEditing({...isEditing, sortOrder: e.target.value})} className="rounded-xl h-11" />
                     </div>
                     <div className="flex flex-col justify-end gap-2 pb-2">
                        <p className="text-[8px] font-black uppercase opacity-40">Destaque?</p>
                        <Switch checked={isEditing?.isFeatured} onCheckedChange={v => setIsEditing({...isEditing, isFeatured: v})} />
                     </div>
                  </div>
               </div>
               <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic">
                     {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Salvar Alterações"}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
    </div>
  )
}

function AssetCard({ asset, isAdmin, onEdit, onDelete }: { asset: any, isAdmin: boolean, onEdit: () => void, onDelete: () => void }) {
  const isImage = asset.mimeType?.startsWith('image/');
  const sizeFormatted = (asset.size / 1024 / 1024).toFixed(2) + ' MB';

  return (
    <Card className="group overflow-hidden border-none shadow-sm rounded-[2rem] bg-white transition-all hover:shadow-xl hover:-translate-y-1">
       <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
          {isImage ? (
            <img src={asset.fileUrl} className="w-full h-full object-contain p-4 transition-transform group-hover:scale-105" alt="" />
          ) : (
            <div className="flex flex-col items-center gap-3 opacity-20">
               <FileText className="w-16 h-16" />
               <Badge className="font-black text-[8px] uppercase">{asset.mimeType?.split('/')[1] || 'DOC'}</Badge>
            </div>
          )}
          {asset.isFeatured && (
            <div className="absolute top-4 left-4">
               <Badge className="bg-secondary text-white border-none shadow-lg px-3 h-5 text-[8px] font-black uppercase italic">Destaque</Badge>
            </div>
          )}
          {isAdmin && (
             <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-lg" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                   <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full shadow-lg" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                   <Trash2 className="w-3.5 h-3.5" />
                </Button>
             </div>
          )}
       </div>
       <CardContent className="p-6 space-y-4">
          <div className="space-y-1 min-w-0">
             <h3 className="font-black text-sm uppercase italic text-primary truncate leading-tight">{asset.name}</h3>
             <p className="text-[10px] font-bold text-muted-foreground uppercase">{sizeFormatted}</p>
          </div>
          <Button asChild className="w-full bg-muted text-primary hover:bg-secondary hover:text-white font-black h-11 rounded-xl uppercase italic text-[10px] gap-2 transition-all">
             <a href={asset.fileUrl} target="_blank" download={asset.name}>
                <Download className="w-4 h-4" /> Download
             </a>
          </Button>
       </CardContent>
    </Card>
  )
}

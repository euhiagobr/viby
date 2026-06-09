
'use client';

import * as React from 'react';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, 
  Loader2, 
  Mail, 
  User, 
  Layout, 
  Eye, 
  ShieldCheck, 
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { sendManualMarketingEmail } from '@/app/actions/email';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export default function AdminMarketingEmailPage() {
  const db = useFirestore();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    to: "",
    subject: "",
    content: "",
    senderName: ""
  });

  const siteSettingsRef = React.useMemo(() => (db ? doc(db, 'settings', 'site') : null), [db]);
  const { data: siteSettings } = useDoc<any>(siteSettingsRef);

  const emailSettingsRef = React.useMemo(() => (db ? doc(db, 'settings', 'email') : null), [db]);
  const { data: emailSettings, loading: loadingEmail } = useDoc<any>(emailSettingsRef);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!emailSettings?.smtpUser) {
      toast({ variant: "destructive", title: "Configuração ausente", description: "Vá em Configurações > E-mail e preencha os dados SMTP." });
      return;
    }

    setLoading(true);
    try {
      const result = await sendManualMarketingEmail(formData);
      if (result.success) {
        toast({ title: "E-mail enviado com sucesso!" });
        setFormData({ ...formData, to: "", subject: "", content: "" });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao enviar", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = !!emailSettings?.smtpUser && !!emailSettings?.smtpPass;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight uppercase italic text-primary flex items-center gap-3">
          <Send className="w-8 h-8 text-secondary" />
          E-mail Marketing Manual
        </h1>
        <p className="text-muted-foreground font-medium">Disparo individual de comunicados utilizando suas credenciais oficiais.</p>
      </div>

      {!isConfigured && !loadingEmail && (
        <Card className="border-none shadow-sm bg-orange-50 border-l-8 border-orange-500 rounded-[2rem]">
           <CardContent className="p-8 flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-orange-600 shrink-0" />
              <div className="space-y-1">
                 <h3 className="text-lg font-black uppercase italic text-orange-800">SMTP não configurado</h3>
                 <p className="text-sm font-medium text-orange-700">Para enviar e-mails, você precisa configurar um servidor SMTP (Google, Outlook, etc) nas configurações globais.</p>
                 <Button asChild variant="link" className="p-0 h-auto text-orange-900 font-black uppercase text-[10px]">
                    <Link href="/admin/configuracoes">Configurar Agora →</Link>
                 </Button>
              </div>
           </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7">
          <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="bg-muted/30 p-8 border-b">
               <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Compor Mensagem</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
               <form onSubmit={handleSend} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Para (E-mail)</Label>
                       <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                          <Input 
                            type="email" 
                            required 
                            placeholder="exemplo@email.com" 
                            value={formData.to}
                            onChange={e => setFormData({...formData, to: e.target.value})}
                            className="pl-10 rounded-xl h-11" 
                          />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Nome do Remetente (Opcional)</Label>
                       <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                          <Input 
                            placeholder={siteSettings?.siteName || "Viby"} 
                            value={formData.senderName}
                            onChange={e => setFormData({...formData, senderName: e.target.value})}
                            className="pl-10 rounded-xl h-11" 
                          />
                       </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Assunto do E-mail</Label>
                     <Input 
                       required 
                       placeholder="Seu assunto aqui..." 
                       value={formData.subject}
                       onChange={e => setFormData({...formData, subject: e.target.value})}
                       className="rounded-xl h-11 font-bold" 
                     />
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Corpo da Mensagem (Texto)</Label>
                     <Textarea 
                       required 
                       placeholder="Escreva sua mensagem. Quebras de linha serão convertidas em <br> automaticamente." 
                       value={formData.content}
                       onChange={e => setFormData({...formData, content: e.target.value})}
                       className="min-h-[250px] rounded-[1.5rem] p-6 resize-none leading-relaxed" 
                     />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading || !isConfigured} 
                    className="w-full h-16 bg-secondary text-white font-black rounded-2xl shadow-xl uppercase italic text-lg hover:scale-[1.01] transition-transform"
                  >
                     {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Send className="w-6 h-6 mr-2" />}
                     Disparar Agora
                  </Button>
               </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
           <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2 flex items-center gap-2">
              <Eye className="w-4 h-4" /> Preview do Layout
           </h3>
           <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col">
              <div className="p-1.5 bg-secondary/10 flex items-center justify-center gap-2">
                 <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                 <span className="text-[8px] font-black uppercase tracking-widest text-secondary">E-mail Transacional Seguro</span>
              </div>
              <ScrollArea className="flex-1 max-h-[600px] bg-[#f8fafc]">
                 <div className="p-8">
                    <div className="max-w-[400px] mx-auto bg-white rounded-3xl border border-border/40 shadow-sm overflow-hidden">
                       <div className="p-6 border-b flex justify-center bg-white">
                          {siteSettings?.logoUrl ? (
                             <img src={siteSettings.logoUrl} className="h-8 object-contain" alt="Logo" />
                          ) : <span className="font-black italic text-xl uppercase">{siteSettings?.siteName || "Viby"}</span>}
                       </div>
                       <div className="p-8 space-y-6">
                          {formData.subject && <h2 className="font-black text-lg text-primary leading-tight">{formData.subject}</h2>}
                          <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line min-h-[100px]">
                             {formData.content || "Digite sua mensagem para visualizar o preview..."}
                          </div>
                       </div>
                       <div className="p-6 bg-slate-50 border-t text-center">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">© 2026 {siteSettings?.siteName || "Viby"} • Porto Alegre, RS</p>
                       </div>
                    </div>
                 </div>
              </ScrollArea>
           </Card>

           <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
              <Info className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Dica de Envio</h4>
                 <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">
                    O sistema utiliza o template padrão do Viby. CLUB. O e-mail será enviado através de sua conta <strong>{emailSettings?.smtpUser || "não configurada"}</strong>. Certifique-se de que o destinatário autorizou o recebimento.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

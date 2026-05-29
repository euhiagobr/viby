
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { logSystemError } from '@/lib/error-manager';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorCode: string | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorCode: null
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true, errorCode: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Logar erro de renderização
    logSystemError({
      error,
      type: 'react_render_error',
      severity: 'critical',
      metadata: { componentStack: errorInfo.componentStack }
    }).then(code => {
      this.setState({ errorCode: code });
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-center">
          <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
            <div className="bg-destructive/10 p-12 flex flex-col items-center gap-6">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl text-destructive">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Algo deu errado</h1>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  A interface encontrou um problema inesperado.
                </p>
              </div>
            </div>
            <CardContent className="p-10 space-y-8">
              <div className="p-6 bg-muted/30 rounded-2xl border border-dashed text-center">
                <p className="text-[10px] font-black uppercase opacity-40 mb-1">Código do Erro</p>
                <p className="text-xl font-mono font-black text-primary">{this.state.errorCode || 'GERANDO...'}</p>
              </div>
              
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                Nosso sistema registrou os detalhes técnicos. Você pode tentar recarregar a página ou voltar ao início.
              </p>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => window.location.reload()} 
                  className="h-14 bg-primary text-white font-black rounded-2xl shadow-xl uppercase italic gap-2"
                >
                  <RefreshCw className="w-5 h-5" /> Recarregar Sistema
                </Button>
                <Button 
                  variant="ghost" 
                  asChild
                  className="font-bold uppercase text-xs"
                >
                  <a href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Painel</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

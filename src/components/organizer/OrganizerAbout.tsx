"use client";

import * as React from "react";
import { OrganizerBio } from "./OrganizerBio";
import { OrganizerSocials } from "./OrganizerSocials";
import { OrganizerMap } from "./OrganizerMap";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Mail, Globe, MapPin, Building2, ExternalLink, Fingerprint, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrganizerAboutProps {
  organization: any;
}

export function OrganizerAbout({ organization }: OrganizerAboutProps) {
  const hasContactInfo = 
    (organization.showPhone && organization.phone) || 
    (organization.showEmail && (organization.contactEmail || organization.email)) ||
    (organization.showWebsite && organization.website);

  return (
    <div className="grid grid-cols-1 gap-20">
      {/* 1. Manifesto / Bio */}
      <OrganizerBio bio={organization.bio} />

      {/* 2. Dados Fiscais (Sempre visíveis conforme solicitado) */}
      <section className="space-y-6">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Dados Institucionais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/5 rounded-2xl text-primary">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Razão Social</p>
                <p className="font-bold text-sm text-primary uppercase">{organization.legalName || organization.name}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm rounded-3xl bg-white">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-primary/5 rounded-2xl text-primary">
                <Fingerprint className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">CNPJ</p>
                <p className="font-mono text-sm text-primary">{organization.cnpj || "---"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 3. Localização (Bairro, Cidade e Estado sempre visíveis) */}
      <section className="space-y-6">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Localização</h2>
        <Card className="border-none shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-secondary/5 rounded-2xl text-secondary">
              <MapIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Sede</p>
              <p className="font-bold text-sm text-primary uppercase">
                {organization.neighborhood ? `${organization.neighborhood}, ` : ""}
                {organization.city} - {organization.state}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. Contact Details (Only visible fields) */}
      {hasContactInfo && (
        <section className="space-y-6">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Canais de Atendimento</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {organization.showPhone && organization.phone && (
              <ContactCard 
                icon={Phone} 
                label="WhatsApp / Telefone" 
                value={organization.phone} 
                link={`https://wa.me/${organization.phone.replace(/\D/g, '')}`}
              />
            )}
            {organization.showEmail && (organization.contactEmail || organization.email) && (
              <ContactCard 
                icon={Mail} 
                label="E-mail de Contato" 
                value={organization.contactEmail || organization.email} 
                link={`mailto:${organization.contactEmail || organization.email}`}
              />
            )}
            {organization.showWebsite && organization.website && (
              <ContactCard 
                icon={Globe} 
                label="Site Oficial" 
                value={organization.website.replace(/^https?:\/\//, '')} 
                link={organization.website}
              />
            )}
          </div>
        </section>
      )}

      {/* 5. Social Networks */}
      <OrganizerSocials organization={organization} />

      {/* 6. Physical Location (Only if showAddress is true) */}
      {organization.showAddress && (
        <OrganizerMap organization={organization} />
      )}
    </div>
  );
}

function ContactCard({ icon: Icon, label, value, link }: { icon: any; label: string; value: string; link: string }) {
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className="group block">
      <Card className="border-none shadow-sm rounded-3xl bg-white hover:shadow-md transition-all">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="p-3 bg-secondary/5 rounded-2xl text-secondary group-hover:bg-secondary group-hover:text-white transition-colors">
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
            <p className="font-bold text-sm truncate text-primary">{value}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground opacity-20 group-hover:opacity-100" />
        </CardContent>
      </Card>
    </a>
  );
}
"use client";

import * as React from "react";
import { OrganizerBio } from "./OrganizerBio";
import { OrganizerSocials } from "./OrganizerSocials";
import { OrganizerMap } from "./OrganizerMap";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Mail, Globe, Building2, ExternalLink, Fingerprint, Map as MapIcon, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrganizerAboutProps {
  organization: any;
}

export function OrganizerAbout({ organization }: OrganizerAboutProps) {
  const isIndividual = organization.tipoOrganizacao === 'individual';
  
  const hasContactInfo = 
    (organization.showPhone !== false && organization.phone) || 
    (organization.showEmail !== false && (organization.contactEmail || organization.email)) ||
    (organization.showWebsite !== false && organization.website);

  const hasFiscalData = isIndividual 
    ? (organization.showCpf !== false && organization.cpf)
    : ((organization.showLegalName !== false && (organization.razaoSocial || organization.legalName)) || (organization.showCnpj !== false && organization.cnpj));

  const showLocationCard = (organization.showNeighborhood !== false && organization.neighborhood) || (organization.showState !== false && organization.city);

  return (
    <div className="grid grid-cols-1 gap-20">
      {/* 1. Manifesto / Bio */}
      {organization.showBio !== false && organization.bio && (
        <OrganizerBio bio={organization.bio} />
      )}

      {/* 2. Dados Fiscais / Institucionais */}
      {hasFiscalData && (
        <section className="space-y-6">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Dados Institucionais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isIndividual ? (
               <Card className="border-none shadow-sm rounded-3xl bg-white">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-primary/5 rounded-2xl text-primary">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Pessoa Física (CPF)</p>
                    <p className="font-mono text-sm text-primary">{organization.cpf}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {(organization.razaoSocial || organization.legalName) && (
                  <Card className="border-none shadow-sm rounded-3xl bg-white">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="p-3 bg-primary/5 rounded-2xl text-primary">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Razão Social</p>
                        <p className="font-bold text-sm text-primary uppercase">{organization.razaoSocial || organization.legalName}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {organization.cnpj && (
                  <Card className="border-none shadow-sm rounded-3xl bg-white">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="p-3 bg-primary/5 rounded-2xl text-primary">
                        <Fingerprint className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">CNPJ</p>
                        <p className="font-mono text-sm text-primary">{organization.cnpj}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* 3. Localização */}
      {showLocationCard && (
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
                  {organization.showNeighborhood !== false && organization.neighborhood ? `${organization.neighborhood}, ` : ""}
                  {organization.city} - {organization.state}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* 4. Canais de Contato */}
      {hasContactInfo && (
        <section className="space-y-6">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Canais de Atendimento</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {organization.showPhone !== false && organization.phone && (
              <ContactCard 
                icon={Phone} 
                label="WhatsApp / Telefone" 
                value={organization.phone} 
                link={`https://wa.me/${organization.phone.replace(/\D/g, '')}`}
              />
            )}
            {organization.showEmail !== false && (organization.contactEmail || organization.email) && (
              <ContactCard 
                icon={Mail} 
                label="E-mail de Contato" 
                value={organization.contactEmail || organization.email} 
                link={`mailto:${organization.contactEmail || organization.email}`}
              />
            )}
            {organization.showWebsite !== false && organization.website && (
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

      <OrganizerSocials organization={organization} />

      {organization.showAddress !== false && (
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

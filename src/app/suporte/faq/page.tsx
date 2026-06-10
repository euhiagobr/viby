import * as React from "react"
import { Metadata } from "next"
import FAQClient from "./FAQClient"

export const metadata: Metadata = {
  title: 'Perguntas Frequentes',
  description: 'Tire suas dúvidas sobre o funcionamento da Viby: ingressos, organizações, pagamentos e segurança.',
  alternates: { canonical: '/suporte/faq' }
}

export default function FAQPage() {
  return <FAQClient />
}

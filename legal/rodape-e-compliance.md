# Madmail — Bloco de Ajuda / Rodapé + Sobre + Compliance

## 1. Estrutura do rodapé (madmail.com.br)

Ordem lógica: Produto → Recursos → Empresa → Legal. Legal sempre na última coluna (padrão de mercado e facilita auditoria LGPD).

```markdown
| Produto            | Recursos                                   | Empresa                          | Legal                                                        |
|--------------------|--------------------------------------------|----------------------------------|--------------------------------------------------------------|
| Painel             | [Docs](https://docs.madmail.com.br/)       | [Sobre](https://www.madmail.com.br/sobre) | [Termos de Uso](/legal/termos-de-uso)                 |
| API de envio       | [Status](https://status.madmail.com.br/status/madmail) | Fale conosco: contato@madmail.com.br | [Política de Privacidade](/legal/politica-de-privacidade) |
| Email marketing    | Changelog <!-- opcional, se existir -->    |                                  | [Política de Uso Aceitável](/legal/politica-de-uso-aceitavel) |
| Emails transacionais |                                          |                                  | [Tratamento de Dados (DPA)](/legal/dpa)                      |
|                    |                                            |                                  | [Suboperadores](/legal/suboperadores) · [Privacidade / DPO](mailto:privacidade@madmail.com.br) |
```

**Linha final do rodapé (dados fiscais):**

```markdown
© 2026 Madmail · N49 Tecnologia · CNPJ 10.911.509/0001-40 · Porto Alegre, RS. Todos os direitos reservados.
```

Microcopy sugerida acima das colunas (opcional): *"Precisa de ajuda? Fale com a gente: contato@madmail.com.br"*

> As caixas `contato@`, `privacidade@` e `abuse@madmail.com.br` são recebidas pela AWS (SES). Encaminhamento automático para rafael@n49.com.br ainda não existe no sistema (hoje só armazena/webhook) — recurso de encaminhamento registrado como tarefa no card Madmail.

---

## 2. Texto melhorado da página "Sobre"

*(Baseado no original lido em https://www.madmail.com.br/sobre — estrutura mantida, texto lapidado.)*

### E-mail marketing na era da IA

O Madmail nasceu de uma pergunta simples: **e se montar uma campanha fosse tão rápido quanto pedir para alguém?** Nada de aprender mais um painel complicado. Você conversa, a campanha sai.

### Nossa missão: colocar o e-mail marketing na velocidade do varejo

Quem toca varejo não tem tempo de virar especialista em ferramenta de e-mail. Segmentar, escrever, testar, agendar — o processo tradicional consome horas que você não tem.

O Madmail conecta o assistente de IA que você já usa (ChatGPT, Claude ou qualquer outro via MCP) à nossa infraestrutura de envio. Você descreve a campanha em uma conversa; a IA sugere segmentos e textos; você aprova; e acompanha os resultados em tempo real. Só isso.

### No que a gente acredita

**Do seu jeito, sem amarras.** SMTP padrão, API, conector MCP ou painel manual — você escolhe como enviar. E os dados são seus: leve-os quando quiser.

**Sem trava, sem letra miúda.** Comece grátis, cancele quando quiser, preços transparentes e em reais. Sem surpresa na fatura.

**Feito por quem dispara.** O Madmail é da [N49](https://www.madmail.com.br) (N49 Tecnologia), de Porto Alegre, que passou anos operando e-mail para varejistas. Construímos a ferramenta que sempre quisemos ter.

> Bloco final sugerido (novo): **"Madmail é N49 Tecnologia · CNPJ 10.911.509/0001-40 · Porto Alegre, RS, Brasil. Dúvidas? contato@madmail.com.br"**

---

## 3. Checklist de compliance — o que falta

| Item | Situação | Recomendação |
|---|---|---|
| Página de suboperadores (subprocessors) | **OK** | Criada em `legal/suboperadores.md` (AWS, EVEO, Cloudflare, Rede, Banco Inter + fornecedores Registro.br, GitHub, Sentry). Publicar em `/legal/suboperadores` e linkar no DPA. |
| Canal do DPO / Encarregado (LGPD art. 41) | **OK** | Encarregado designado: **Rafael Pinto e Silva** (privacidade@madmail.com.br) — já constando na Privacidade, DPA, Uso Aceitável e rodapé. |
| Política de Cookies | **OK (resolvido)** | Site usa apenas cookies essenciais + cookies de pagamento (Rede/Inter) — coberto pela Seção 9 da Política de Privacidade. **Sem página separada e sem banner de consentimento** (não há analytics/marketing; se um dia adicionar, criar `/legal/cookies` + banner). |
| Política Anti-Spam | **Recomendado** | Pode viver dentro da Política de Uso Aceitável, mas uma âncora/página dedicada (opt-in, CAN-SPAM/LGPD, descadastro obrigatório) fortalece reputação de envio. |
| SLA | **Recomendado** | Publicar SLA (uptime, créditos) ou declarar explicitamente nos Termos que não há SLA no plano gratuito. Linkar a página de Status. |
| Aviso de transferência internacional de dados | **Verificar** | Se usa infra fora do Brasil (ex.: SES us-east-1), declarar na Privacidade/DPA a base legal da transferência (LGPD arts. 33–36). |
| Registro do canal de denúncia de abuso | **Recomendado** | E-mail abuse@madmail.com.br referenciado na Política de Uso Aceitável — esperado por provedores e melhora deliverability. |
| Versão/data nos documentos legais | **Recomendado** | Cada documento em `/legal/*` com "Última atualização: DD/MM/AAAA" e changelog de versões. |
| Confirmação dos e-mails de contato | **OK** | Caixas recebidas via AWS (SES). Encaminhamento automático → rafael@n49.com.br é recurso futuro (tarefa criada no card Madmail); até lá, conferir a caixa pelo armazenamento/webhook. |

**Prioridade sugerida:** 1) Encarregado/DPO + canal, 2) Suboperadores, 3) Transferência internacional, 4) Cookies, 5) Anti-spam/abuse, 6) SLA.
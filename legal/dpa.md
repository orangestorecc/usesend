# Acordo de Tratamento de Dados Pessoais (DPA)

**Madmail — N49 Tecnologia LTDA**
**Data de vigência: 13 de agosto de 2026**

---

## Sumário

1. [Objeto e Escopo](#1-objeto-e-escopo)
2. [Definições](#2-definições)
3. [Papéis das Partes: Controladora e Operadora](#3-papéis-das-partes-controladora-e-operadora)
4. [Instruções Documentadas de Tratamento](#4-instruções-documentadas-de-tratamento)
5. [Descrição do Tratamento](#5-descrição-do-tratamento)
6. [Obrigações da Cliente (Controladora)](#6-obrigações-da-cliente-controladora)
7. [Obrigações da N49 (Operadora)](#7-obrigações-da-n49-operadora)
8. [Suboperadores](#8-suboperadores)
9. [Medidas de Segurança](#9-medidas-de-segurança)
10. [Notificação de Incidentes de Segurança](#10-notificação-de-incidentes-de-segurança)
11. [Direitos dos Titulares](#11-direitos-dos-titulares)
12. [Encarregado pelo Tratamento de Dados (DPO)](#12-encarregado-pelo-tratamento-de-dados-dpo)
13. [Transferência Internacional de Dados](#13-transferência-internacional-de-dados)
14. [Auditoria](#14-auditoria)
15. [Devolução e Eliminação dos Dados](#15-devolução-e-eliminação-dos-dados)
16. [Responsabilidade](#16-responsabilidade)
17. [Confidencialidade, Vigência, Alterações e Disposições Gerais](#17-confidencialidade-vigência-alterações-e-disposições-gerais)
18. [Lei Aplicável e Foro](#18-lei-aplicável-e-foro)
19. [Anexo I — Medidas Técnicas e Organizacionais de Segurança](#anexo-i--medidas-técnicas-e-organizacionais-de-segurança)
20. [Anexo II — Lista de Suboperadores](#anexo-ii--lista-de-suboperadores)

---

## 1. Objeto e Escopo

1.1. Este Acordo de Tratamento de Dados Pessoais ("**DPA**") integra os Termos de Serviço celebrados entre a **N49 Tecnologia LTDA**, sociedade limitada inscrita no CNPJ sob o nº **10.911.509/0001-40**, com sede na Avenida Ipiranga, nº 6681, Prédio 99A — Tecnopuc, Bairro Partenon, Porto Alegre/RS, CEP 90619-900, Brasil ("**N49**", "**nós**"), e a pessoa física ou jurídica que utiliza a plataforma **Madmail** ("**Cliente**", "**você**").

1.2. O Madmail (madmail.com.br) é uma plataforma brasileira de envio de e-mails transacionais e de marketing por meio de API e painel web. Ao usar o Madmail, o Cliente nos envia dados pessoais de terceiros (por exemplo, endereços de e-mail dos seus destinatários) — e este DPA disciplina como tratamos esses dados em nome do Cliente, em conformidade com a **Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018)**, em especial seus arts. 37 a 40 e 42 a 45, e com o **Marco Civil da Internet (Lei nº 12.965/2014)**.

1.3. Em caso de conflito entre este DPA e os Termos de Serviço, prevalece este DPA no que diz respeito ao tratamento de dados pessoais.

1.4. A documentação técnica do serviço está disponível em **docs.madmail.com.br** e a disponibilidade da plataforma pode ser acompanhada em **status.madmail.com.br/status/madmail**.

## 2. Definições

Os termos abaixo têm o significado que lhes atribui a LGPD. Em resumo:

- **Dados Pessoais**: informação relacionada a pessoa natural identificada ou identificável (LGPD, art. 5º, I).
- **Titular**: a pessoa natural a quem se referem os dados pessoais (art. 5º, V). No contexto deste DPA, tipicamente os destinatários dos e-mails enviados pelo Cliente.
- **Controladora**: quem toma as decisões referentes ao tratamento (art. 5º, VI).
- **Operadora**: quem realiza o tratamento em nome da controladora (art. 5º, VII).
- **Suboperador**: terceiro contratado pela Operadora para auxiliar no tratamento realizado em nome da Controladora.
- **Tratamento**: toda operação com dados pessoais — coleta, armazenamento, transmissão, eliminação etc. (art. 5º, X).
- **Dados do Cliente**: dados pessoais tratados pela N49 em nome do Cliente, incluindo endereços de e-mail de destinatários, nomes, variáveis de personalização, o conteúdo das mensagens e **todos os eventos de entrega e engajamento associados aos destinatários** (entregas, aberturas, cliques, bounces, reclamações), inclusive **endereços IP e user agents de destinatários** vinculados a esses eventos.
- **Dados de Conta e Uso**: dados relativos **exclusivamente ao próprio Cliente e aos seus usuários autorizados** (cadastro, autenticação, faturamento, logs de acesso ao painel e à API e métricas de uso da plataforma pelo Cliente). Dados de Conta e Uso **não incluem** dados de destinatários ou quaisquer Dados do Cliente.
- **Incidente de Segurança**: qualquer violação de segurança que acarrete, de modo acidental ou ilícito, a destruição, perda, alteração, acesso ou divulgação não autorizados de Dados do Cliente.
- **ANPD**: Autoridade Nacional de Proteção de Dados.

## 3. Papéis das Partes: Controladora e Operadora

3.1. **Quanto aos Dados do Cliente**, o **Cliente é a Controladora** e a **N49 é a Operadora**. O Cliente decide quais dados envia, para quem envia mensagens, com qual conteúdo e com qual base legal; a N49 apenas executa o envio e as operações acessórias em nome do Cliente, conforme suas instruções documentadas.

3.2. **Quanto aos Dados de Conta e Uso**, a **N49 atua como controladora independente**, tratando esses dados para operar, proteger, faturar e melhorar o serviço, conforme descrito em nossa Política de Privacidade. Esses dados não são objeto das obrigações de operadora deste DPA.

3.3. Para que não haja dúvida: **eventos de entrega e engajamento de destinatários, bem como IPs e user agents de destinatários, são sempre Dados do Cliente** e permanecem sujeitos ao regime de operadora deste DPA, não podendo ser reclassificados como Dados de Conta e Uso. A N49 somente poderá utilizar informações derivadas desses dados para melhoria do serviço em formato **agregado e anonimizado de forma irreversível**, sem possibilidade de identificação direta ou indireta de titulares ou do Cliente (LGPD, art. 12).

3.4. Nenhuma das partes será considerada controladora conjunta da outra, salvo acordo escrito específico.

## 4. Instruções Documentadas de Tratamento

4.1. A N49 tratará os Dados do Cliente **exclusivamente conforme as instruções documentadas do Cliente**, que compreendem: (a) este DPA e os Termos de Serviço; (b) as configurações e comandos realizados pelo Cliente por meio da API e do painel do Madmail (por exemplo, chamadas de envio de e-mail, criação de contatos, agendamentos e automações); e (c) instruções adicionais por escrito, quando compatíveis com o serviço.

4.2. A N49 informará o Cliente, sem demora, caso entenda que uma instrução viola a LGPD ou outra norma aplicável, podendo suspender a execução da instrução até esclarecimento. Nesse caso, a N49 apresentará ao Cliente, **em até 5 (cinco) dias úteis** contados da suspensão, a fundamentação por escrito da suposta ilegalidade. Se a suspensão se revelar indevida e persistir após a manifestação do Cliente, este poderá **rescindir o contrato sem ônus**, com devolução proporcional de valores pré-pagos não utilizados.

4.3. A N49 poderá tratar Dados do Cliente fora das instruções apenas quando exigido por lei ou por ordem de autoridade competente, hipótese em que informará o Cliente antes do tratamento, salvo vedação legal.

## 5. Descrição do Tratamento

| Item | Descrição |
|---|---|
| **Natureza e finalidade** | Envio de e-mails transacionais e de marketing em nome do Cliente; gestão de listas de contatos, supressão e descadastro; registro de eventos de entrega (entregue, aberto, clique, bounce, reclamação); prevenção a abuso e spam. |
| **Categorias de dados** | Endereços de e-mail; nomes; variáveis de personalização definidas pelo Cliente; conteúdo das mensagens; metadados de entrega e engajamento; endereços IP e user agents associados a eventos de abertura/clique — todos tratados como **Dados do Cliente** (Seções 2 e 3.3). |
| **Categorias de titulares** | Destinatários das mensagens do Cliente (clientes, usuários, assinantes e contatos do Cliente). |
| **Dados sensíveis** | O Madmail **não foi concebido para tratar dados pessoais sensíveis** (LGPD, art. 5º, II) nem dados de crianças e adolescentes como conteúdo estruturado. O Cliente não deve inseri-los na plataforma; se o fizer, permanece integralmente responsável pela base legal e salvaguardas aplicáveis. |
| **Duração** | Pelo prazo do contrato, observada a Seção 15. |

## 6. Obrigações da Cliente (Controladora)

6.1. O Cliente declara e garante que:

a) possui **base legal válida** (LGPD, art. 7º) para todos os Dados do Cliente que envia à plataforma — cabendo ao Cliente a escolha e a documentação da base legal aplicável a cada tratamento (por exemplo, **execução de contrato** — art. 7º, V — ou **legítimo interesse** — art. 7º, IX — para e-mails transacionais);

b) independentemente da base legal adotada, obterá, **como regra contratual da Política de Uso Aceitável do Madmail, opt-in explícito** dos destinatários de mensagens de marketing, em linha com as boas práticas do **CAPEM** (Código de Autorregulamentação para a Prática de E-mail Marketing), sendo vedado o uso de listas compradas, alugadas ou raspadas. Ou seja: mesmo que o Cliente fundamente juridicamente o envio em legítimo interesse, o envio de marketing pelo Madmail **exige opt-in prévio e comprovável** do destinatário;

c) honrará pedidos de descadastro em até **7 (sete) dias** e incluirá identificação e endereço válidos do remetente nas mensagens;

d) forneceu aos titulares as informações exigidas pelo art. 9º da LGPD, inclusive sobre o uso de operadores como a N49;

e) manterá as instruções de tratamento lícitas e responderá pelas decisões de tratamento que tomar.

6.2. O descumprimento desta Seção autoriza a N49 a suspender envios ou encerrar a conta, nos termos dos Termos de Serviço e da Política de Uso Aceitável.

6.3. **Indenização pelo Cliente.** O Cliente indenizará e manterá a N49 indene de perdas, danos, multas, sanções administrativas (inclusive da ANPD), custos de defesa e demandas de terceiros (incluindo titulares) que decorram de: (a) descumprimento das declarações e obrigações desta Seção 6; (b) uso de listas sem base legal, envio de spam ou de conteúdo ilícito; ou (c) instruções de tratamento ilícitas ou decisões de tratamento tomadas pelo Cliente como controladora. Esta obrigação não se aplica na medida em que o dano decorra de ato ou omissão imputável à N49.

## 7. Obrigações da N49 (Operadora)

7.1. A N49 obriga-se a:

a) tratar os Dados do Cliente somente conforme a Seção 4;

b) garantir que as pessoas autorizadas a tratar os dados estejam sujeitas a **dever de confidencialidade** contratual;

c) implementar as **medidas de segurança** do Anexo I (LGPD, arts. 46 a 49);

d) auxiliar o Cliente, na medida do razoável e considerando a natureza do serviço, no atendimento a **direitos dos titulares** (Seção 11), em **avaliações de impacto** e em interações com a **ANPD**;

e) notificar incidentes conforme a Seção 10;

f) manter **registro das operações de tratamento** realizadas em nome do Cliente (LGPD, art. 37);

g) devolver ou eliminar os dados ao término do contrato (Seção 15);

h) disponibilizar as informações necessárias à demonstração de conformidade e permitir auditorias (Seção 14);

i) manter os registros de acesso a aplicações exigidos pelo **Marco Civil da Internet (art. 15)** pelo prazo legal.

7.2. A N49 não vende Dados do Cliente, não os utiliza para publicidade própria ou de terceiros e não os utiliza para treinar modelos de terceiros.

## 8. Suboperadores

8.1. O Cliente **autoriza, de forma geral**, a contratação de suboperadores pela N49 para funções de infraestrutura e suporte ao serviço (por exemplo, hospedagem em nuvem, entrega de e-mail e processamento de pagamentos).

8.2. A lista atualizada de suboperadores é publicada no **Anexo II** deste documento e em **madmail.com.br/legal/suboperadores**. Nessa página, o Cliente pode **inscrever seu e-mail para receber avisos automáticos** de qualquer alteração na lista.

8.3. **Aviso prévio e objeção**: a N49 avisará o Cliente com pelo menos **14 (quatorze) dias de antecedência** antes de adicionar ou substituir um suboperador que trate Dados do Cliente, por e-mail e aviso no painel. O Cliente poderá **objetar por escrito, com justificativa razoável de proteção de dados**, dentro desse prazo. Nesse caso, as partes buscarão de boa-fé uma solução; não sendo possível, o Cliente poderá rescindir o contrato quanto ao serviço afetado, com devolução proporcional de valores pré-pagos não utilizados.

8.4. A N49 celebrará com cada suboperador contrato escrito com obrigações de proteção de dados **materialmente equivalentes** às deste DPA e permanecerá **responsável perante o Cliente** pelos atos e omissões de seus suboperadores como se fossem próprios.

## 9. Medidas de Segurança

9.1. A N49 adota medidas técnicas e organizacionais aptas a proteger os Dados do Cliente contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão (LGPD, art. 46), detalhadas no **Anexo I**, que inclui, no mínimo: criptografia em trânsito (TLS) e em repouso, autenticação multifator, controle de acesso por privilégio mínimo, registro de logs e **teste de intrusão (pentest) anual**.

9.2. A N49 poderá atualizar as medidas do Anexo I, desde que sem redução material do nível de proteção.

## 10. Notificação de Incidentes de Segurança

10.1. Ao tomar conhecimento de um Incidente de Segurança envolvendo Dados do Cliente (conforme definido na Seção 2), a N49 notificará o Cliente, pelo e-mail cadastrado na conta, **obrigatoriamente em até 48 (quarenta e oito) horas** contadas do conhecimento do incidente. A notificação inicial poderá ser feita com as informações então disponíveis, sendo **complementada posteriormente** à medida que a apuração avançar. Esse prazo é compromisso vinculante da N49, de modo a viabilizar o cumprimento, pelo Cliente, do prazo de comunicação à ANPD previsto no Regulamento CD/ANPD nº 15/2024 (3 dias úteis).

10.2. A N49 notificará **todo Incidente de Segurança confirmado**, independentemente de juízo próprio sobre risco ou relevância. A notificação conterá, na medida do conhecido: descrição da natureza do incidente, categorias e volume estimado de titulares e dados afetados, medidas de contenção e remediação adotadas ou recomendadas, e contato para mais informações — em linha com o art. 48, §1º, da LGPD e a regulamentação da ANPD sobre comunicação de incidentes.

10.3. Cabe **exclusivamente ao Cliente**, como controladora, o juízo sobre a existência de **risco ou dano relevante** aos titulares e a realização das comunicações à **ANPD e aos titulares** exigidas pelo art. 48 da LGPD quanto aos Dados do Cliente. A N49 prestará cooperação razoável e não fará comunicações públicas em nome do Cliente sem sua anuência, salvo obrigação legal.

10.4. A notificação de um incidente não constitui confissão de culpa ou responsabilidade.

## 11. Direitos dos Titulares

11.1. Os titulares possuem os direitos do **art. 18 da LGPD**: confirmação do tratamento, acesso, correção, anonimização, bloqueio ou eliminação, portabilidade, informação sobre compartilhamentos, informação sobre a possibilidade de não consentir e revogação do consentimento, além de oposição (art. 18, §2º) e revisão de decisões automatizadas (art. 20).

11.2. Quanto aos **Dados do Cliente**, os pedidos dos titulares devem ser dirigidos ao **Cliente**, que é a controladora. Se um titular contatar a N49 diretamente sobre dados tratados em nome do Cliente, a N49 o orientará a procurar o Cliente e, quando identificável, **repassará o pedido ao Cliente em até 5 (cinco) dias úteis** do recebimento, de modo a preservar o prazo de resposta do art. 19, II, da LGPD, que corre contra o Cliente.

11.3. A N49 disponibiliza no painel e na API funcionalidades que auxiliam o atendimento a esses direitos (exportação, correção e exclusão de contatos; listas de supressão; descadastro automático), e prestará assistência adicional razoável mediante solicitação.

## 12. Encarregado pelo Tratamento de Dados (DPO)

12.1. A N49 mantém **Encarregado pelo Tratamento de Dados Pessoais** (LGPD, art. 41; Regulamento CD/ANPD nº 18/2024), formalmente designado, como canal de comunicação com titulares, clientes e ANPD:

- **Encarregado (DPO):** Rafael Pinto e Silva
- **E-mail do Encarregado (DPO):** privacidade@madmail.com.br
- **Contato geral:** contato@madmail.com.br

12.2. A identidade e o contato do Encarregado são divulgados de forma clara e objetiva em madmail.com.br. Eventual substituição do Encarregado será refletida nesta cláusula e no site, sem necessidade de aditivo contratual.

## 13. Transferência Internacional de Dados

13.1. A infraestrutura do Madmail pode utilizar provedores de nuvem localizados fora do Brasil, **em especial nos Estados Unidos** (por exemplo, Amazon Web Services — ver Anexo II). Nessas hipóteses, ocorre **transferência internacional de dados pessoais** (LGPD, arts. 33 a 36).

13.2. A N49 **somente realizará transferências internacionais amparadas em mecanismo válido** previsto no **art. 33 da LGPD** e no Regulamento de Transferências Internacionais da ANPD (Resolução CD/ANPD nº 19/2024), **em especial as cláusulas-padrão contratuais aprovadas pela ANPD**, celebradas com os suboperadores envolvidos, ou outro mecanismo expressamente admitido pela regulamentação que assegure grau de proteção adequado. Nenhuma transferência internacional de Dados do Cliente será realizada sem mecanismo válido.

13.3. O Cliente **autoriza** essas transferências para os suboperadores listados no Anexo II, sem prejuízo do direito de objeção da Seção 8.3 quando houver alterações.

13.4. A N49 exigirá dos suboperadores no exterior compromissos de proteção compatíveis com a LGPD, incluindo criptografia, confidencialidade e limitação de finalidade.

## 14. Auditoria

14.1. A N49 disponibilizará ao Cliente, mediante solicitação razoável, informações que demonstrem o cumprimento deste DPA, tais como descrições das medidas de segurança, resumos de resultados de pentests e certificações ou relatórios de terceiros, quando existentes ("**auditoria documental**"), sob confidencialidade.

14.2. Quando a auditoria documental for comprovadamente insuficiente para atender exigência legal ou da ANPD, o Cliente poderá realizar, **no máximo uma vez a cada 12 (doze) meses**, auditoria adicional, diretamente ou por terceiro independente sob confidencialidade, observado: (a) aviso prévio de 30 (trinta) dias; (b) horário comercial e mínima interferência nas operações; (c) vedação de acesso a dados de outros clientes e a segredos de negócio; (d) custos por conta do Cliente, salvo se a auditoria revelar descumprimento material deste DPA pela N49.

14.3. Auditorias determinadas pela **ANPD** serão atendidas na forma da lei.

## 15. Devolução e Eliminação dos Dados

15.1. Durante a vigência do contrato, o Cliente pode **exportar** os Dados do Cliente a qualquer momento pelo painel ou pela API.

15.2. Ao término do contrato, por qualquer motivo, a N49, **a critério do Cliente manifestado em até 30 (trinta) dias do encerramento**, devolverá os Dados do Cliente em formato estruturado e de uso comum e/ou os **eliminará** de seus sistemas ativos. Na ausência de manifestação, os dados serão eliminados.

15.3. A eliminação dos sistemas ativos ocorrerá em até **60 (sessenta) dias** do encerramento; cópias em backups criptografados serão eliminadas **em até 90 (noventa) dias após a eliminação dos sistemas ativos**, conforme o ciclo de rotação de backups, permanecendo protegidas por este DPA — inclusive quanto à vedação de qualquer tratamento que não a simples guarda — até a exclusão definitiva.

15.4. A N49 poderá reter dados quando e enquanto exigido por lei — por exemplo, registros de acesso a aplicações por 6 (seis) meses (Marco Civil da Internet, art. 15) e documentos fiscais pelos prazos legais — limitando o tratamento à guarda e ao cumprimento da obrigação legal (LGPD, art. 16, I).

## 16. Responsabilidade

16.1. Cada parte responde pelos danos que causar em violação da LGPD, na forma dos **arts. 42 a 45 da LGPD**. A N49, como operadora, responde solidariamente quando descumprir as obrigações da legislação de proteção de dados ou as instruções lícitas do Cliente (LGPD, art. 42, §1º, I); o Cliente responde pelas decisões de tratamento que tomar como controladora.

16.2. A responsabilidade contratual das partes sob este DPA sujeita-se aos limites previstos nos Termos de Serviço, inclusive o limite ao **valor pago pelo Cliente nos 12 (doze) meses anteriores ao evento**, ressalvado que tais limites **não se aplicam**: (a) quando vedado por norma de ordem pública, em especial o **CDC (Lei nº 8.078/1990)** quando o Cliente se qualificar como consumidor (art. 51); (b) a danos causados por **dolo ou por culpa grave, assim entendida a negligência grosseira**; (c) à responsabilidade perante titulares e à ANPD imposta por lei, que não pode ser afastada contratualmente; e (d) a danos decorrentes do descumprimento, pela N49, das obrigações de **segurança (Seção 9), notificação de incidentes (Seção 10) e devolução e eliminação de dados (Seção 15)**, que, para eliminar qualquer ambiguidade, **não se sujeitam ao teto** de responsabilidade.

16.3. A parte que indenizar dano causado predominantemente pela outra terá **direito de regresso** na proporção da respectiva participação no evento danoso (LGPD, art. 42, §4º), sem prejuízo da obrigação de indenização do Cliente prevista na Seção 6.3.

## 17. Confidencialidade, Vigência, Alterações e Disposições Gerais

17.1. **Confidencialidade recíproca.** Cada parte manterá em sigilo as informações confidenciais da outra a que tiver acesso em razão deste DPA — incluindo, no caso da N49, os Dados do Cliente e, no caso do Cliente, informações técnicas e comerciais não públicas da N49 — utilizando-as apenas para a execução do contrato, salvo obrigação legal de divulgação ou consentimento prévio por escrito. Esta obrigação complementa a cláusula de confidencialidade dos Termos de Serviço e os deveres específicos das Seções 7.1(b) e 14.

17.2. Este DPA vigora enquanto a N49 tratar Dados do Cliente, sobrevivendo ao término do contrato no que couber (confidencialidade — cláusula 17.1 —, eliminação, responsabilidade).

17.3. A N49 poderá atualizar este DPA para refletir a evolução legal ou do serviço, mediante publicação em madmail.com.br e, para **alterações materiais**, **notificação ativa por e-mail ao Cliente com antecedência mínima de 30 (trinta) dias** da entrada em vigor. É vedada a aplicação retroativa de alterações. Alterações que reduzam materialmente as proteções do Cliente conferem-lhe o direito de rescindir sem ônus antes da entrada em vigor, com devolução proporcional de valores pré-pagos não utilizados.

17.4. A eventual nulidade de uma cláusula não afeta as demais. A versão em português deste DPA prevalece sobre qualquer tradução.

## 18. Lei Aplicável e Foro

18.1. Este DPA é regido pelas **leis da República Federativa do Brasil**, em especial a LGPD, o Marco Civil da Internet e, quando aplicável, o CDC.

18.2. Fica eleito o foro da **Comarca de Porto Alegre/RS** para dirimir controvérsias decorrentes deste DPA, ressalvado, quando o Cliente se qualificar como consumidor, o foro do seu domicílio, na forma do CDC.

---

## Anexo I — Medidas Técnicas e Organizacionais de Segurança

**1. Criptografia**
- Criptografia **em trânsito** via TLS 1.2 ou superior em todas as conexões (API, painel e SMTP com STARTTLS/TLS).
- Criptografia **em repouso** dos bancos de dados e backups.
- Suporte a autenticação de e-mail: SPF, DKIM e DMARC nos domínios de envio.

**2. Controle de acesso**
- **Autenticação multifator (MFA)** para acesso administrativo à infraestrutura.
- Princípio do **privilégio mínimo** e segregação de funções; revisão periódica de acessos.
- Chaves de API com escopos e possibilidade de revogação imediata pelo Cliente.
- Revogação de acessos de colaboradores desligados em prazo máximo de 24 horas.

**3. Segurança de infraestrutura e desenvolvimento**
- Hospedagem em provedores de nuvem com certificações reconhecidas (por exemplo, ISO 27001 e SOC 2).
- Segregação lógica dos dados entre clientes (isolamento por conta/tenant).
- Revisão de código, controle de versões e ambientes segregados de desenvolvimento, homologação e produção; dados de produção não são usados em desenvolvimento.
- Atualização e correção tempestiva de vulnerabilidades (patch management).

**4. Testes e monitoramento**
- **Teste de intrusão (pentest) anual** por terceiro independente, com tratamento das vulnerabilidades identificadas.
- Varreduras periódicas de vulnerabilidades.
- Registro e monitoramento de logs de acesso e de eventos de segurança; página pública de status em status.madmail.com.br/status/madmail.

**5. Continuidade e backups**
- Backups automáticos, criptografados e testados periodicamente.
- Plano de continuidade e de recuperação de desastres com objetivos de recuperação definidos.
- Expurgo definitivo de backups conforme a Seção 15.3 (em até 90 dias após a eliminação dos sistemas ativos).

**6. Medidas organizacionais**
- Acordos de confidencialidade com todos os colaboradores e prestadores.
- Treinamento periódico de segurança e privacidade para a equipe.
- Política interna de resposta a incidentes com papéis e prazos definidos.
- Encarregado (DPO) designado (Seção 12).

## Anexo II — Lista de Suboperadores

Lista vigente na data de publicação, disponível e mantida atualizada em **madmail.com.br/legal/suboperadores**, onde o Cliente pode inscrever-se para receber avisos de alteração. Alterações seguem a Seção 8 (aviso prévio de 14 dias e direito de objeção). Esta lista contempla **todos os suboperadores que tratam Dados do Cliente**; ferramentas internas de monitoramento de disponibilidade e de suporte operadas pela própria N49, que não tratam Dados do Cliente, não constituem suboperadores.

| Suboperador | Finalidade | Dados tratados | Localização |
|---|---|---|---|
| **Amazon Web Services (AWS)** | Entrega e recebimento de e-mail (Amazon SES) e infraestrutura em nuvem | Dados do Cliente (contatos, conteúdo de mensagens, eventos de entrega) | Brasil e Estados Unidos |
| **EVEO S.A.** | Hospedagem de servidores da plataforma | Dados do Cliente armazenados na plataforma | Brasil |
| **Cloudflare, Inc.** | DNS, proxy e firewall de aplicação (WAF) | Dados de tráfego que transitam pela rede (não armazena conteúdo) | Estados Unidos (rede global) |
| **Rede (Redecard S.A.)** | Processamento de pagamentos com cartão | Dados de Conta e faturamento (não trata contatos nem conteúdo de mensagens) | Brasil |
| **Banco Inter S.A.** | Processamento de pagamentos (Pix/boleto) | Dados de Conta e faturamento (não trata contatos nem conteúdo de mensagens) | Brasil |

*Dúvidas sobre este DPA: privacidade@madmail.com.br.*
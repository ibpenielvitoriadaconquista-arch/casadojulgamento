# Casa do Julgamento 2026 — Revisão de checkout e plano de integração Pluga/Even3/Portaria
**Data:** 19/10/2026  
**Ambiente:** branch isolada `fix/checkout-datas-even3-20261019` (sem alterar produção).  
**Evento Even3:** `798621`.  
**Status:** checkout corrigido em código para revisão; **venda paga, seis redirecionamentos e operação real não homologados**.

## 1. O que foi efetivamente alterado nesta etapa
- Criado `lib/even3-checkout.cjs` com seis entradas específicas e links `/auxcheckout/redirect`.
- Atualizado `lib/even3-sessions.js` para usar a configuração compartilhada.
- Atualizado `pages/ingressos/[dia].jsx` para ir diretamente à entrada escolhida, removendo orientação incorreta de selecionar atividade após a inscrição geral.
- Atualizado `pages/ingressos.jsx` para esclarecer que disponibilidade e taxa são confirmadas pela Even3, não pela página.
- Criado `tests/even3-checkout.test.cjs` para verificar os seis IDs distintos, a estrutura do link, horários, a ausência da instrução de atividades e que o código da entrada não é o código individual do ingresso.
- Os IDs oficiais informados pelo organizador **substituíram os IDs antigos 967700/967703/967747/967748/967750/967751** previamente encontrados na Vercel pessoal.
- Mantidos intactos: webhook, painel de colaboradores, Supabase da igreja e domínio público.

| Dia | Horário portões | ID de entrada Even3 | Link de checkout |
|---|---|---|---|
| 09/11/2026 | 17h | 968577 | https://www.even3.com.br/auxcheckout/redirect?urlEvento=casa-do-julgamento-2026-798621&idIngresso=968577&lang=pt |
| 13/11/2026 | 20h | 968578 | https://www.even3.com.br/auxcheckout/redirect?urlEvento=casa-do-julgamento-2026-798621&idIngresso=968578&lang=pt |
| 14/11/2026 | 18h | 968579 | https://www.even3.com.br/auxcheckout/redirect?urlEvento=casa-do-julgamento-2026-798621&idIngresso=968579&lang=pt |
| 19/11/2026 | 20h | 968580 | https://www.even3.com.br/auxcheckout/redirect?urlEvento=casa-do-julgamento-2026-798621&idIngresso=968580&lang=pt |
| 20/11/2026 | 17h | 968581 | https://www.even3.com.br/auxcheckout/redirect?urlEvento=casa-do-julgamento-2026-798621&idIngresso=968581&lang=pt |
| 21/11/2026 | 18h | 968582 | https://www.even3.com.br/auxcheckout/redirect?urlEvento=casa-do-julgamento-2026-798621&idIngresso=968582&lang=pt |

Os links são os entregues pelo organizador; não foi feita compra de R$15 nem validação visual final de todos os checkouts.

## 2. O que os testes e bancos confirmaram
Em 18/10 foram recebidos **8 registros** na tabela `public.cdj_test_pluga_inbox` do Supabase pessoal `zsypewkgzreddtkqbsyc`, incluindo o código individual `77465704`. O webhook pessoal também registrou 2 notificações confirmadas e 2 inscrições projetadas. Essas provas dizem respeito a **inscrições TESTE**, não vendas pagas.
O banco pessoal tem um schema privado `cdj_ops` com 11 tabelas e as RPCs `record_cash`, `confirm_admission`. Nesta consulta, elas estavam sem sessões, entradas, equipe ou admissões efetivas.
O Supabase da igreja `bdfohdqucosgykdhwdwj` tinha 6 `peniel_ops.session_state`, zero `peniel_ops.registrations` e zero `peniel_ops.staff`, com 4 notificações em `even3_integration.webhook_inbox`.
A Vercel da igreja tem preview READY para a branch `migracao/site-oficial-20261017`; produção da branch main teve erro. O domínio `ibpeniel.com` está verificado na Vercel pessoal e não verificado na igreja. Não foram alterados DNS, domínio ou deploys.

## 3. Modelo proposto (ainda não implementado integralmente)
```
Site escolhe data -> link da entrada Even3 -> Even3 cobra/emite QR individual
                                      | 
                         Even3 -> Pluga inscrições -> receptor autenticado -> inbox Supabase igreja
                         Even3 -> Pluga vendas -> receptor autenticado -> pagamentos + vínculo ingresso
                                      |
                        Staff autenticado -> Portaria consulta servidor/API Even3
                                      |
                        validação da data + dinheiro + ingresso não usado
                                      |
                  admissão única + fila Coordenação + outbox sincronização Even3
                                      |
                         Coordenação -> Guias/Apoio -> Geral
```
Mesmo que a compra tenha sido iniciada no site, a decisão de data precisa ser extraída da **categoria efetivamente comprada**. A categoria da entrada não é identificada pelo código `data.inscricao.codigo` (ingresso individual), nem se pode assumir que `data.inscricao.id` seja `idIngresso` da URL. É necessário cruzar com dados reais do checkout/Even3. `data.evento.data` descreve o evento inteiro, não a sessão.

### 3.1 Inscrição (Pluga; já em funcionamento no banco pessoal de testes)
Campos mínimos e úteis:
| Supabase | Origem observada na Pluga | Notas |
|---|---|---|
| event_id | data.evento.id | deve ser 798621 |
| ticket_code | data.inscricao.codigo | identificador individual como TEXTO; zeros à esquerda |
| even3_registration_id | data.inscricao.id | sem presumir que seja ID da entrada |
| participant_id | data.pessoa.id | identificador da pessoa |
| participant_name | data.pessoa.nome | conferência interna |
| participant_email | data.pessoa.email | somente contato operacional |
| ticket_category | data.inscricao.titulo | categoria exibida; mapeamento exato após comprovar nome/ID |
| ticket_value_raw | data.inscricao.valor | não equivale a venda aprovada |
| registration_date_raw | data.inscricao.data_inscricao | instante da inscrição, não dia da sessão |

Adicionar quando disponíveis no payload original: `type.name`, `id` da notificação, `created` e data de recebimento da Pluga. Se a ação for fixa na automação, rotular explicitamente a origem (confirmada/cancelada). Preservar payload original mínimo em inbox segura e deduplicar eventos. Não coletar CPF, endereço completo, passaporte ou nascimento desnecessariamente.

### 3.2 Venda financeira (nova automação e receptor, PENDENTES)
Criar automações separadas para **Venda aprovada** e **Venda cancelada/reembolsada**. Preservar ação original, ID de notificação, ID de evento, referência/ID de venda, situação, método, valor bruto/liquido quando houver, data e itens. Os gatilhos de venda oferecem atributos financeiros; **não presumir formato exato sem payload real recebido na Pluga**. A amostra da documentação usa algumas chaves literais com ponto (por exemplo `venda.referencia`), que podem diferir do modo como o editor Pluga as apresenta.
Manter `payments` e `payment_tickets` separados, porque um pedido pode conter 2 ou mais ingressos. Não replicar o total da compra como preço individual. Sem vínculo inequívoco de item ↔ ingresso, `payment_status=unknown`. Evento de inscrição confirmada não comprova pagamento.
Não sobrescrever reembolso/cancelamento posterior com notificação aprovada mais antiga.

### 3.3 Portaria e caixa (ainda não operacionais)
- Login individual com papel `portaria`, `caixa`, `coordenacao`, `guias`, `apoio` ou `geral` conforme implementação aprovada.
- Ler QR (conteúdo precisa de teste real para identificar o código de check-in da Even3).
- Servidor verifica evento, ingresso confirmado, categoria mapeada à sessão, pagamento online aprovado OU recebimento presencial validado, dia correto, capacidade, e uso anterior.
- Persistir admissão uma única vez e entrada na fila em **uma transação**. Usar outbox para sincronização da Even3; não fazer check-in duplicado por scanner e por app Even3 de forma independente.
- Caixa registra dinheiro associado a ingresso real da entrada correta; não emite QR fictício adicional.
- Coordenação forma grupos, até 20 participantes; Guias e Apoio compartilham o estado e não recebem detalhes financeiros.

## 4. Lacunas encontradas no código atual da igreja
1. `/operacao/[posto]` já usa autenticação e Supabase da igreja, mas `/portaria`, `/coordenacao`, `/guias` e `/geral` são atalhos para telas de treinamento local. Não são leitores/filas reais.
2. `pages/api/integracoes/even3/webhook.js` grava eventos de inscrição, mas a projeção atual não associa preço/data, nem prova pagamento. O adapter `lib/operation-arrivals.js` requer atividade vinculada; não está ajustado ao modelo de seis **entradas**.
3. No banco oficial faltam colaboradores ativos, inscrições conciliadas e `entry_map` oficial das seis entradas.
4. A infraestrutura `cdj_ops` e o receptor `/api/integracoes/pluga/receber` existem como proposta/código e schema no projeto **pessoal**, mas não se encontram publicados/integrados na Vercel e no Supabase **da igreja**. Não redirecionar Pluga para URL não publicada.
5. A categoria `data.inscricao.titulo` é evidência para revisão, não prova suficiente de qual ID específico de entrada veio na compra. Confirmar em teste pago, inclusive pedido de múltiplos participantes.
6. QR real, pagamento aprovado e cancelamento, check-in duas vezes, sessão incorreta, autorização e relatórios por operador ainda precisam de homologação.

## 5. Próximas etapas em ordem de risco
**P0 — Antes de abrir venda paga:** abrir cada um dos seis links em sessão anônima, conferir nome/data, R$15, limites aprovados e estoque; concluir 1 compra paga e comprovar emissão de QR individual; configurar automação financeira e conciliar compra/inscrição sem confundir ID da entrada, da inscrição e do ingresso. Testar cancelamento/reembolso.
**P1 — Integração da igreja:** revisar migrações do schema `cdj_ops` contra `peniel_ops` para evitar dois estados operacionais; criar receptor Pluga autenticado, inbox idempotente e processador no **Supabase oficial**; manter automação atual durante transição; usar branch/preview e testes antes de transferir gatilhos.
**P2 — Operação:** autenticar equipe no banco da igreja, implementar camera/leitura QR em /operacao/portaria, validar junto à API Even3 e banco antes da entrada única, outbox/reconciliação, alimentar fila e grupo em telas protegidas; homologar dois dispositivos e falhas.
**P3 — Publicação:** preparar revisão do PR, executar `npm ci && npm test && npm run build`, validar checkout em preview, depois autorizar merge/deploy e eventual mudança de domínio separadamente.

## 6. O que o organizador precisa fazer
1. Confirmar na Even3 os **seis IDs 968577–968582** e o nome exato de cada categoria, preço e capacidade (idealmente uma captura da tela de entradas).
2. Na Pluga, manter inscrição confirmada; habilitar também cancelamento e automação financeira e fornecer nomes dos campos **sem enviar secrets**.
3. Executar uma compra paga de R$15 de teste com recibo (ocultar CPF e dados financeiros privados) para capturar gatilho **Venda aprovada** e vínculo do número individual.
4. Dar aprovação explícita antes de promover a branch para a Vercel oficial ou alterar destinos de automação.

## 7. Referências
- https://developers.even3.com/gatilhos-de-participantes-2281973m0
- https://developers.even3.com/gatilhos-de-venda-2282082m0
- https://developers.even3.com/fluxo-2282811m0
- Documento enviado: `PLUGA_PORTARIA_CAIXA_2026-10-19.md`.

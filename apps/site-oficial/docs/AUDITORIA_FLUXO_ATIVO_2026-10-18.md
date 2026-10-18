# Auditoria do aplicativo ativo — 18/10/2026

Base: branch migracao/site-oficial-20261017, commit a347101. Escopo: rotas Next, dependências internas, autenticação, módulos operacionais, webhook, testes, build e consultas de estado do banco. Não equivale a certificação de segurança nem a homologação da Even3.

## Corrigido neste lote

- Removidos lib/orders.js e lib/payments.js: motor PIX desconectado e sem gateway contratado. Histórico permanece no Git.
- /dados, /quantidade e /pagamento redirecionam para /ingressos. Não fazem chamadas às APIs /api/pedidos ausentes.
- /ingresso explica onde obter o ingresso Even3, sem afirmar pagamento confirmado.
- /admin leva ao login de colaboradores existente.
- /api/sessoes publica somente programação; não consulta estoque de pedidos PIX que não representam a venda Even3. Disponibilidade local não verificada permanece nula/bloqueada.
- Webhook: notificação e projeção da inscrição são gravadas na mesma transação. Falha em qualquer gravação provoca rollback e 503, permitindo reenvio.
- Somente os três eventos documentados de situação da inscrição no evento atualizam peniel_ops.registrations. Identificação por inscricao.id e pessoa.id, nunca por nome/e-mail.
- Pagamento continua unknown; atividade/data continuam não verificadas; check-in nunca é concedido por confirmação de inscrição.
- Reentregas com mesmo hash são idempotentes; mesmo ID com conteúdo diferente gera conflito. Eventos fora de ordem usam o histórico por occurred_at; cancelamento tem precedência em empate. Trava por inscrição serializa a projeção.
- Notificações não reconhecidas permanecem na inbox para revisão. pending_review não significa descartado nem pagamento aprovado.
- Diagnóstico de 422 registra somente tipos e presença de campos esperados, sem dados pessoais/credenciais.

## Preservado

- Painéis, atribuição individual/troca de grupo, entrega de senha, histórico, permissões e revisões concorrentes.
- Cronômetros de seis postos e reset com confirmação.
- Treinamento local isolado, com simulação bloqueada na API real.
- Migrations e dados existentes; nenhuma tabela foi apagada.
- Adaptador de atividades, protegido e somente leitura, até concluir mudança de modelo.
- Arte, vídeo e páginas de divulgação.

## Bloqueios reais restantes

1. Seleção de dia em /ingressos/[dia] NÃO gera vínculo persistente nem reserva. Todos os links apontam ao evento geral. Não assumir que a escolha volta no webhook. Exige contrato de checkout comprovado e controle de lotação por sessão; não resolver com matching de e-mail/nome.
2. Mensagem atual de compra ainda orienta atividades; deve ser trocada juntamente com a configuração definitiva do evento, não apenas apagada deixando o comprador sem seleção válida.
3. acceptActivityCheckin exige atividade confirmada/mapeada. Não atende ainda ao novo modelo de dia CDJ. Não retirar verificações para fazer passar.
4. QR real por câmera não está implementado no painel. Permissions-Policy atual bloqueia câmera; só habilitar junto com leitor e autorização de entrada no servidor.
5. Necessário motor de pagamento/cancelamento verificado (incluindo duas inscrições no mesmo pedido e nova compra do mesmo comprador). Inscrição gratuita confirmada não prova pagamento.
6. No momento da consulta: zero colaboradores ativos e zero inscrições operacionais; primeiro administrador e fluxo real de convite/login precisam de homologação.
7. Notificação real Even3 não recebida na inbox até a consulta inicial desta auditoria. Testes sintéticos não comprovam entrega externa.
8. Integração está configurada no preview; transferência de domínio/publicação de produção requer variáveis equivalentes verificadas e teste de compra.
9. Credenciais compartilhadas no chat precisam ser substituídas antes da liberação pública; nenhum segredo foi incluído neste relatório.

## Verificação

57 testes automatizados aprovados; compilação Next concluída. Primeiro build local falhou por symlink de node_modules do ambiente de auditoria; corrigido copiando dependências para checkout isolado, sem alteração do aplicativo para contornar o erro.

Testes não substituem: compra paga, cancelamento, vínculo por ingresso/data, limite da última vaga, QR repetido, QR em outro dia, exceção auditada e login de todos os perfis em aparelhos reais.

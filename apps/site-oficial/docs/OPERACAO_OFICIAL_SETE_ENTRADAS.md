# Operação oficial: sete entradas

O Lote 1 (968141) utiliza a fila oficial 2026-10-22, com validade em 22 e 23/10 no fuso America/Bahia e uso único em toda a janela. As seis apresentações mantêm suas datas. Dados antigos de ensaio são preservados, sem serem convertidos em admissões reais.

## Credenciamento

A câmera envia `admit` à API oficial. A digitação permite consulta antes de confirmar. Portaria e Caixa usam a mesma API e a mesma chave única `(event_id,ticket_code)`.

O servidor consulta o participante e catálogo atual da Even3, verifica autorização financeira, reserva a tentativa e fecha a transação antes de chamar `/api/v1/checkin/attendees`. Somente a resposta JSON `"OK"` permite confirmar a tentativa e inserir a pessoa na fila oficial. A admissão e o consumo local do ingresso são uma transação única. Uma resposta incerta bloqueia novas tentativas; a Gestão confere o painel Even3 e registra evidência antes de concluir ou autorizar novo envio. Uma falha local após a confirmação pode ser retomada sem reenviar à Even3.

## Financeiro

Não depende de Pluga. A conciliação automática tenta os detalhes da API Even3 usando GET com corpo `reference`, conforme a documentação V1. Exige evento, categoria, vínculo individual único e pagamento `Pago`. Falha, resposta incompleta ou ambiguidade encaminha à Gestão. Por enquanto, a busca automática limita a lista a 20 pagamentos; acima disso exige conferência individual pela Gestão. Esse limite precisa ser substituído por processamento dedicado antes de escalar vendas.

A Gestão pode registrar pagamento ou cortesia comprovados, revogar autorização e resolver respostas incertas em `/operacao/autorizacoes`. Cada ação exige evidência e gera auditoria. Registrar uma autorização não credencia o ingresso e não permite data antecipada. Cancelamento do participante é consultado na Even3 em cada leitura; autorizações financeiras manuais precisam ser revogadas pela Gestão quando houver reembolso não refletido na confirmação do participante.

## Verificação

Testes automatizados cobrem concorrência, timeout, retomada após falha local, calendário e vínculo financeiro. A leitura real da câmera, a resposta externa de credenciamento e o fluxo autenticado em aparelhos físicos continuam sendo verificações operacionais necessárias. Um build READY não comprova essas etapas.

Apoio mantém o painel existente. Coordenação, Guias e Telão da operação consultam `peniel_ops.session_state`, com atualização a cada quatro segundos e projeções por função. O Lote 1 não usa mais `ensaios_session_state`.
# Recebimentos presenciais

O Caixa pode confirmar dinheiro ou Pix recebido diretamente pela igreja para um QR individual já emitido e confirmado na Even3. Use “Confirmar pagamento recebido na igreja”, informe o código, a forma de recebimento e a referência do recibo com valor e participante. O registro guarda o colaborador responsável na auditoria financeira. A confirmação financeira não realiza check-in: consulte o QR no leitor e confirme a entrada física, respeitando a data. Não cobre novamente no checkout da Even3 um valor já recebido pela igreja.

O Caixa não pode autorizar cortesias, revogar liberações, reabrir autorizações revogadas nem resolver tentativas externas incertas. Essas ações ficam com a Gestão Geral. Pessoas sem ingresso precisam primeiro da emissão individual na Even3; anotar atendimento no Caixa não emite um QR.

Em 23/10/2026 foi comprovado em produção um credenciamento do Lote 1 após confirmação de pagamento em dinheiro: resposta externa `OK`, registro local `admitted`. A consulta financeira automática de detalhes continua retornando HTTP 404; recebimentos presenciais usam a confirmação auditada da igreja.


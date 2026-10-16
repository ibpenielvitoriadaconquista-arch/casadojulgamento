EVEN3 → PENIEL | ESPECIFICAÇÃO DE INTEGRAÇÃO — 16/10/2026
ESTADO: PROPOSTA, não implementada. Site simples ibpeniel.com permanece inalterado.

FONTE DE VERDADE
Even3 será a candidata para inscrições, cobrança, ingresso individual e leitura de QR oficial. O app Even3 registra check-in; o painel Peniel só coloca participantes *efetivamente validados* na fila dos grupos, sem substituir validação de pagamento.

CONFIRMADO NA DOCUMENTAÇÃO
Even3 documenta webhook para check-in de participante no evento ou atividade, com identificador de notificação e retentativas. O modo offline do app exige sincronização posterior, portanto webhook não é instantâneo nem garantido durante quedas. Credenciamento geral pode permitir somente uma leitura por evento; operação de seis sessões precisa ser homologada. A API v2 deve ser preferida conforme indicação da documentação.
https://developers.even3.com/gatilhos-de-participantes-2281973m0
https://developers.even3.com/inicio-2181001m0
https://ajuda.even3.com.br/hc/pt-br/articles/49519268602267-Realizar-o-credenciamento-do-evento-por-dia

TOPOLOGIAS A VALIDAR
A — seis eventos separados por data: checar tarifas, simplicidade de credenciamento e relatórios.
B — um evento com seis atividades: checar webhook de check-in por atividade, compra e QR, cotas por atividade.
C — um evento com tipos de ingresso por dia: somente se o suporte provar que check-in não mistura datas e exportação identifica dia/participante.
Não escolher sem teste real: ingresso do dia 13 não pode ser aceito no dia 14.

FLUXO ESPERADO
Comprador paga → Even3 emite 1 QR por espectador → na portaria app Even3 confere o QR e mostra check-in positivo → webhook autenticado ao endpoint privado Peniel → validar token/autenticidade, evento e sessão, status permitido, identificador único e duplicidades → persistir em banco Peniel transacional → projetar “confirmado aguardando grupo” → alocação no salão por organizador → grupos fechados e despachados por coordenação.
Webhook não é autorização física de entrada em sala de espera ou circuito.
Não existe hoje endpoint webhook de produção, nem conta Even3 conectada ao painel.

CONTRATO MÍNIMO DE DADOS
id do webhook; id do evento; id da sessão/atividade; id da inscrição ou ticket; horário de credenciamento; origem; indicador do status; dados mínimos de nome apenas para conferência autorizada. Credenciais server-side, TLS, audit log, não armazenar QR secreto ou CPF em lista impressa. Identificador único do evento para idempotência; unique de inscrição por sessão para evitar duplicação de check-in.

SE FALHAR O WEBHOOK
Portaria pode ter Even3 “VALIDADO” e Peniel “NÃO SINCRONIZADO”. Avisar no painel, iniciar conferência supervisionada com ID de ticket e comprovante do aplicativo; sala recebe pessoalmente participante/cartão e acusa recebimento. Registrar “pendente de conciliação”; não chamar isso de check-in integrado. Quando webhook chegar, reconciliar sem criar pessoa ou grupo duplicado.
App Even3 em modo offline: falta sincronização até reconectar; usar posto único/manual ou protocolo aprovado. Dois aparelhos offline podem aceitar entrada duplicada; conferir junto ao suporte.

SEGURANÇA
Autenticar notificações conforme documentação e contrato do plano, não aceitar JSON público como verdade; verificar associação evento/atividade/inscrição e confirmação elegível. Uso de banco privado com controle por sessão, auditoria, idempotência, reprocessamento, alerta de integração atrasada. Nenhum operador do painel de guias acessa pagamentos. Integração pode ser indisponível conforme o plano Even3 contratado; confirmar com suporte.

TESTES OBRIGATÓRIOS
E01 compra familiar de 5 ingressos, 5 QR individuais.
E02 sessão errada bloqueia, seis datas separadas.
E03 check-in QR → webhook → 1 pessoa na fila Peniel.
E04 repetir webhook e duplicar scan → 1 pessoa.
E05 atraso/perda de webhook → estado pendente + reconciliação, sem pessoa duplicada.
E06 check-in offline e sincronização posterior testados em 2 celulares.
E07 pagamento cancelado/reembolsado não deve liberar.
E08 grupo com 12 pode ser fechado sem 20; segue salão → espera → circuito.
E09 2 vagas restantes num grupo, família de 4 vai a outro grupo.
E10 falha do coordenador ativa substituição formal e PAUSA partidas novas.
E11 testar exportação CSV/XLSX por sessão e lista complementar após horário de corte.
E12 webhook sem credencial e ID forjado é rejeitado.

PERGUNTAS EXATAS AO SUPORTE EVEN3
Qual arranjo de seis sessões deve ser usado para check-in separado? Qual payload anonimizado de webhook por atividade e evento? API/webhooks disponíveis em que plano e com qual tarifa? O offline sincroniza webhook posteriormente? Dois celulares offline podem aceitar mesmo QR? Como exportar ticket, comprador, sessão, status, horário, cancelados? Como limitar 210 online e 90 presencial? É possível comprar 5 QR independentes de uma só vez?

DECISÃO PENDENTE DA IGREJA: escolher plano, criar evento privado de teste, confirmar integração e autorizar credenciais sem compartilhá-las em chat.
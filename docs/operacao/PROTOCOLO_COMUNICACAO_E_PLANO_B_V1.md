CASA DO JULGAMENTO | PROTOCOLO SALÃO, ESPERA E CIRCUITO
16/10/2026 — PROPOSTA PARA ENSAIO / NÃO IMPLEMENTADO

POSTO 1 - PORTARIA
QR lido no aplicativo externo Even3; ingresso da sessão correta e check-in aceito. Confirmação recebida no painel Peniel (automática caso webhook homologado) ou transferência manual sob supervisão por ID de ingresso. Depois da validação o participante é direcionado ao grupo e ao SALÃO ÚNICO. Os grupos aguardam juntos, identificados por cartões G01–G15.

POSTO 2 - COORDENAÇÃO
Supervisiona salão único, sala de espera (uma turma de cada vez), fluxo geral e resposta dos guias. Fecha grupo com 1–20 pessoas, designa guia e só transfere do salão para sala de espera após conferência da sala vazia e da presença física dos participantes. Depois autoriza início de circuito quando ponto seguro anterior tiver sido confirmado e caminho estiver liberado. Ninguém libera por cronômetro.

POSTO 3 - GUIAS
Há potencialmente dois papéis a confirmar: guia da sala de espera e guia de circuito. O primeiro recebe o grupo e confirma que está reunido; o segundo acompanha o circuito, solicita início, confirma saída, ponto seguro e fim. Se uma só pessoa fizer ambos, isso deve ser ensaiado. Guia nunca autoriza grupo seguinte sozinho.

ESTADOS DO GRUPO
ABERTO_NO_SALAO → FECHADO_NO_SALAO → CHAMADO_SALA_ESPERA → CONFIRMADO_NA_ESPERA → LIBERADO_PARA_CIRCUITO → EM_CIRCUITO → PONTO_SEGURO → CONCLUIDO.
A sala de espera tem status VAZIA / RESERVADA / OCUPADA / BLOQUEADA, com confirmação humana. 20 = limite máximo, não mínimo. Não reabrir grupo chamado para espera sem autorização e trilha de auditoria.

EXEMPLO DE COMUNICAÇÃO POR RÁDIO COM ACK
Salão: "G03 fechado com 12. Solicito sala de espera".
Coordenação: "Confirma sala vazia, G03 pode deslocar".
Espera: "Recebi G03 com 12 na sala de espera".
Guia: "G03 pronto, solicito início do circuito".
Coordenação: "Ponto seguro de G02 recebido, rota livre, autorizo G03".
Guia: "Recebido, G03 iniciando agora".
Guia: "G03 no ponto seguro".
Coordenação: "Recebido G03 ponto seguro, verificarei G04".
A falta de resposta (ACK) significa NÃO AUTORIZADO.

SE O COORDENADOR FALHAR
Titular e substituto designados e identificados antes da sessão. Qualquer posto percebe silêncio/ausência ou comando conflitante e aciona PAUSA DE NOVAS PARTIDAS, notifica substituto. Substituto confirma quais grupos estão em salão, espera e circuito, último ponto seguro e pedidos pendentes. Transferência de comando registrada com hora/nome; somente um operador autoriza. Um grupo já em circuito obedece ao plano humano de emergência, não fica abandonado.

SE A INTERNET OU O SISTEMA FALHAR
Fase 1: se Even3 validou QR, mas painel Peniel não recebeu, registrar ID/horário no posto e transferir pessoa fisicamente com cartão, para reconciliação posterior.
Fase 2: se aplicativo Even3 offline, seguir apenas procedimento testado com sincronização e supervisão, não assumir que check-in chegou ao servidor.
Fase 3: queda do painel Peniel — portaria segue QR oficial, e coordenação opera grupos com 20 cartões numerados por grupo, lista de transferência física, quadro de ocupação, 3–5 rádios e mensageiro se necessário.
Fase 4: ambos indisponíveis — um posto único de conferência por sessão, listas oficiais com hora de corte e complemento, eventos sob auditoria, pausa se não puder verificar ingressos sem risco de duplicação.
Após retorno reconciliar TODOS os IDs e não criar grupo/entrada repetidos.

CHECKLIST DE ENSAIO
[ ] Mesmo grupo de 7 pessoas pode ser fechado.
[ ] Grupo cheio bloqueia pessoa 21.
[ ] Família de quatro com duas vagas restantes fica junta no grupo seguinte.
[ ] Sala de espera ocupada bloqueia deslocamento da próxima turma.
[ ] Guia ainda no circuito sem ponto seguro bloqueia próxima partida.
[ ] Coordenador ausente aciona substituto e registra comando único.
[ ] Rádio sem confirmação pausa novas liberações.
[ ] Validado na Even3, sem webhook, gera transferência manual auditada.
[ ] Dois aparelhos offline testados com integração e reconciliação.
[ ] Portaria, coordenação e guias sabem quem pode acionar PARAR.

PENDÊNCIAS
Confirmar layout físico, quem é guia da espera/circuito, ponto seguro, duração real do trajeto, acessibilidade, quantidade de rádios, autoridade de emergência e substituto. Este documento NÃO é autorização operacional.
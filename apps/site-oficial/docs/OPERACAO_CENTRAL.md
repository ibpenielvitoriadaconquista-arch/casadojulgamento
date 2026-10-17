# Operação central — 17/10/2026

## Estado desta entrega

Banco aplicado no projeto Supabase bdfohdqucosgykdhwdwj. Seis sessões inicializadas, cada uma com 15 grupos de até 20 pessoas, conforme o motor operacional existente. Não foram criadas inscrições, usuários nem chegadas reais.

O esquema privado peniel_ops contém staff, registrations, session_state e command_log. As tabelas têm RLS e não concedem acesso a anon/authenticated. O backend usa a conexão Postgres da Vercel e valida o usuário e o papel antes de consultar os dados. As tabelas privadas even3_integration.webhook_inbox e activity_map já existem.

Código preparado, ainda sem publicação desta versão. Treinamento público permanece nas rotas /portaria, /coordenacao, /guias, /geral e /telao com dados fictícios locais. A operação autenticada está em /operacao/login e /operacao/{posto}. Atualização central por consulta a cada quatro segundos; falhas bloqueiam os comandos. Não há fila de gravação offline. A sessão de login dura no máximo uma hora, exigindo novo login após expirar.

## Compra e atividade

O comprador adquire a inscrição geral de R$15 na Even3 e escolhe a atividade que identifica o dia/horário. Os links do site apontam à página geral do evento, sem os antigos IDs de ingressos por dia ou parâmetros de pré-seleção não verificados. O horário exibido no site continua sendo abertura dos portões, não o instante individual de entrada na apresentação.

É preciso verificar no checkout se selecionar exatamente uma atividade é obrigatório (limite máximo de uma não prova obrigatoriedade), se cada participante recebe a atividade correta e se a capacidade é respeitada. Os seis IDs numéricos de atividade ainda não foram mapeados.

## Chegada e coordenação

A documentação Even3 confirma gatilhos distintos para inscrição, venda, check-in no evento e check-in em atividade. Usar check-in na atividade para decidir a sessão. Check-in geral sozinho fica pendente de conciliação, nunca escolhe uma data pelo nome do ingresso.

A função interna acceptActivityCheckin exige: evento e atividade mapeados; check-in no dia correto no fuso America/Bahia; inscrição confirmada; atividade confirmada; pagamento confirmado ou isenção explícita. Duplicatas não geram outra pessoa. Chegadas entram sem grupo. A função ainda NÃO está ligada automaticamente ao webhook: depende de payload real e conciliação dos status com a Even3.

O webhook existente apenas recebe e persiste a notificação em pending_review. Não confundir HTTP 200 com processamento/credenciamento concluído. Ainda falta implementar o adaptador real de inscrições, vendas, atividades e cancelamentos; o processamento com reenvio/reconciliação; observabilidade da fila e alertas de exceção.

A coordenação seleciona a pessoa presencialmente, atribui grupo e confirma entrega do papel. Troca exige motivo e recolhimento da senha anterior, quando entregue. A nova senha volta a pendente. Um grupo fica na espera e no máximo dois no circuito, respeitando o ponto seguro. Todas as alterações de colaboradores são registradas com usuário, ação, revisão, horário e identificador de comando.

## Segurança e concorrência

Permissões staff verificadas no servidor a cada requisição, sem confiar no posto enviado pelo navegador ou em user_metadata. Geral pode operar todos os postos; os demais só seu próprio posto. Guias e telão recebem uma projeção sem nomes, IDs de inscrições ou histórico nominal. A portaria não pode criar chegadas manuais nem simular QR na operação real.

Alterações usam transação, SELECT FOR UPDATE e versão esperada. Dois colaboradores com a mesma versão não podem sobrescrever uma alteração já confirmada. Comandos repetidos com o mesmo request_id são reconhecidos; reutilização com outro conteúdo é rejeitada. A função de chegada usa o mesmo bloqueio da sessão; o futuro reconciliador também deverá seguir essa ordem de bloqueio: sessão antes da inscrição.

Login via Supabase Auth, cookie HttpOnly/SameSite=Strict/Secure em produção, validação de origem em POST. Exportação CSV neutraliza prefixos de fórmula. Não há cadastro público com concessão automática de função. Primeiro usuário deve ser criado no Supabase Auth e autorizado em staff por administrador. Cadastro de colaboradores pela interface ainda não foi implementado.

## Configuração pendente

- Vercel: POSTGRES_URL (ou DATABASE_URL), NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
- Even3: EVEN3_EVENT_ID, EVEN3_API_TOKEN, EVEN3_WEBHOOK_TOKEN, e cabeçalho de autenticação verificado. Secrets somente no servidor.
- Cadastrar e habilitar primeiro colaborador, depois testar contas dos diferentes postos.
- Publicação dos quatro arquivos de mídia autorizada explicitamente pelo usuário em 17/10/2026; incluídos nesta entrega. Publicar o commit completo no projeto da igreja e validar conexão hospedada. A conexão Vercel retornou 403 para a equipe peniel-casadojulgamento; revisar autorização de acesso antes do deploy.
- Antes de dados reais: substituir as credenciais privadas compartilhadas anteriormente na conversa.
- Somente após validar o destino, mover domínio/apex e www, preservando o redirecionamento e o projeto pessoal para retorno.

## Verificação realizada

46 testes automatizados aprovados: regras de grupos, fluxo completo com troca e entrega de senha, limites, papéis, privacidade de guia/telão, chegada duplicada, pagamento pendente/reembolsado, cancelamentos, dia/atividade inválidos e versão antiga da API.
Build Next.js concluído. HTTP local: treinamento e login 200, painel real sem sessão redireciona ao login, API sem sessão retorna 401, compra aponta ao evento geral.
Supabase: seis sessões vazias conferidas; RLS e ausência de grants públicos confirmadas; revisão antiga rejeitada em teste SQL desfeito com ROLLBACK. Advisors apenas informam RLS sem políticas nas tabelas privadas (bloqueio intencional): https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Ainda NÃO validado: login real, dois dispositivos autenticados no servidor publicado, compra real, leitura de QR na Even3 e recebimento/processamento da notificação real. Não anunciar operação ponta a ponta antes desses testes.

Documentação consultada: https://developers.even3.com/gatilhos-de-participantes-2281973m0

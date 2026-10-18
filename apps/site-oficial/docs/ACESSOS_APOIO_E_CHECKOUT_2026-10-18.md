# Casa do Julgamento — acessos, Apoio e decisão de checkout

Atualizado em 18/10/2026. Autor: Codex. Complementa a proposta 07 da Central IA; não aprova nem altera a configuração comercial da Even3.

## Implementado nesta revisão

- Frase de entrada: “Cada pessoa merece ser bem acolhida.”
- Perfil Apoio com painel próprio. Guia continua controlando os movimentos; Apoio não altera grupos, pessoas ou credenciamento.
- Gestão de colaboradores em /operacao/equipe: somente Geral gera convites, recuperação de acesso, habilitação/desabilitação e mudanças de função. Não existe inscrição pública com escolha livre de privilégios.
- Convites gerados pelo Supabase Auth, individuais, de uso único. A gestão entrega o link por canal privado. Não há envio automático de e-mails nesta implementação.
- /operacao/ativar valida o convite, permite definir senha de no mínimo 12 caracteres e abre o painel correspondente. Tokens transitórios permanecem apenas na memória da página; a sessão usa cookie HttpOnly, Secure em produção e SameSite=Strict.
- A função é lida da tabela privada staff em cada requisição, nunca de metadados editáveis pelo usuário. Desabilitar uma conta bloqueia as próximas requisições operacionais.
- Gestão não pode alterar a própria função. Alterações registradas em staff_audit. Limite de tentativas de autenticação por origem de rede em janela de 15 minutos.
- /operacao/apoio: seis postos de medição compartilhados, independentes das seis datas do evento. Cada posto pode medir cenas, deslocamentos ou intervalos, com rótulo livre e meta opcional.
- Iniciar, pausar, retomar e concluir/salvar. Timestamps do servidor evitam depender da execução contínua de um setInterval no celular. Um Apoio não altera a medição em andamento de outro; Geral pode intervir.
- Histórico de até 500 etapas por posto, exportação CSV. Não há exclusão ou reset na interface. O relógio não libera grupos automaticamente nem pausa o circuito.
- Sem internet: comandos bloqueados; tela avisa perda de sincronização. Ao reconectar, relê o estado do banco. A medição em andamento continua computando o tempo decorrido.
- /apoio é demonstração local, sem login e sem dados de participantes. Não sincroniza entre aparelhos. Exportar antes de limpar o navegador.
- Guias e Coordenação podem acompanhar os tempos sem comandar os cronômetros. Geral acessa todos os postos.

## Primeiro administrador e limites da validação

O banco foi consultado em 18/10: zero usuários Auth e zero colaboradores ativos antes desta revisão. Nenhuma identidade real foi criada ou convidada automaticamente.

O primeiro administrador precisa ser cadastrado no Supabase Authentication (Add user), com senha definida pelo responsável, ou por um fluxo administrativo equivalente autorizado. Depois o UUID dessa conta é vinculado a peniel_ops.staff com role geral e active=true. Não enviar senha em conversa. Não existe rota pública de bootstrap.

Após o primeiro acesso, os demais colaboradores podem ser convidados pela própria Gestão. É necessário testar ao menos uma ativação, um login de guia, a negação de acesso ao painel geral, uma recuperação, a desativação de um usuário e um cronômetro compartilhado em dois aparelhos antes de declarar homologação completa.

52 testes automatizados passaram e o build local passou nesta revisão. Os testes cobrem as regras e handlers com dependências simuladas; não substituem a ativação real no Supabase.

As tabelas operacionais são privadas, com RLS e sem grants para anon/authenticated. O backend usa conexão direta e valida permissões. Aviso informativo RLS sem policy é intencional nesse modelo: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

A remoção de ssoProtection da Vercel foi solicitada, mas bloqueada por revisão automática porque afeta todas as implantações do projeto casadojulgamento. Proteção mantida. Precisa de autorização explícita para essa configuração; não contornar por outros meios. O domínio pessoal não foi alterado.

## Ingresso único + dia escolhido no checkout

É viável validar dia e uso no CDJ. A associação precisa usar identificador único da inscrição, evento e código de credenciamento verificado. Nome/e-mail não são chave suficiente.

O webhook de check-in é posterior ao check-in. Se o CDJ decide a admissão, o leitor do CDJ precisa validar antes de liberar a passagem. O QR pode continuar emitido pela Even3; é necessário provar seu conteúdo e vínculo ao código retornado pela API.

Controle futuro: pagamento e inscrição confirmados; agendamento válido; uso global único por ingresso, independente do dia; cancelamento/reembolso bloqueiam. Exceção de data somente para ingresso válido ainda não usado, com vaga, funcionário, motivo e auditoria. Consumir ingresso e criar chegada na fila da coordenação na mesma transação. Entrega de senha de grupo é uma etapa posterior. Confirmar inscrição manualmente não comprova pagamento.

## O que a documentação confirma e o que não confirma

1. Webhook de participantes contém pessoa.personalizado e inscricao.id/codigo. O exemplo de personalizado é um array vazio: não comprova formato real da resposta de data nem que ela seja distinta por ingresso em compras múltiplas.
Fonte: https://developers.even3.com/gatilhos-de-participantes-2281973m0

2. Formulários inteligentes podem chamar uma API externa para validar e preencher campos; resposta documentada valid:true ou valid:false. Isso não comprova reserva atômica de vagas, autenticação da chamada, bloqueio de campo ou conservação de uma referência externa até a venda. Disponibilidade comercial precisa ser confirmada.
Fonte: https://developers.even3.com/valida%C3%A7%C3%A3o-de-pergunta-2282826m0

3. A incorporação oficial oferece widget de inscrições e link para checkout de uma entrada selecionada. Não prova suporte a parâmetros arbitrários para pré-preencher data ou external_reference.
Fonte: https://ajuda.even3.com.br/hc/pt-br/articles/360004093772-Incluir-a-Even3-dentro-do-meu-site

4. Há inscrição pública em atividades sem login, liberada pelo suporte. É uma alternativa a confirmar para ingresso geral + uma atividade gratuita obrigatória por participante.
Fonte: https://ajuda.even3.com.br/hc/pt-br/articles/17365146081435-Configurar-atividades-com-inscri%C3%A7%C3%B5es-restritas

5. POST /api/v1/attendees/create pertence à V1 marcada deprecated. Criar participante com id_ticket_price não comprova venda, pagamento ou expiração diária do QR.
Fonte: https://developers.even3.com/inserir-participante-41538516e0

## Prova urgente antes de mudar as vendas

Candidato a testar: uma entrada geral de R$15 com pergunta obrigatória de escolha única “Em qual dia você vem?”, opções fechadas das seis sessões. Explicar que o horário informado é abertura dos portões, não horário garantido de apresentação. O usuário escolhe o dia dentro do mesmo checkout; evitar solicitar agendamento após a compra.

Em evento/categoria de teste autorizada, configurar essa pergunta e capturar payload real de inscrição e de venda. Se não vier no webhook, consultar detalhe da inscrição via API. Confirmar se a pergunta pertence a cada ingresso ou apenas à pessoa; caso seja apenas da pessoa e compras subsequentes sobrescrevam a resposta, reprovar essa solução.

Matriz mínima:
- Compra simples em navegador anônimo, com resposta de data obrigatória e sem login adicional.
- Dois ingressos no mesmo pedido, datas distintas: cada inscrição deve conservar sua resposta.
- Mesma pessoa/e-mail comprando novamente: a compra anterior mantém a data.
- QR recebido aponta exatamente para a inscrição paga; não presumir IDs iguais.
- Pagamento pendente, aprovado, cancelado/reembolsado; webhook repetido e fora de ordem.
- Duas compras simultâneas disputando a última vaga: não pode haver venda além da capacidade.
- Porta em dia certo, outro dia, exceção, QR repetido no mesmo dia e em outro dia, dois leitores simultâneos.
- Acesso direto ao checkout sem passar pelo site deve exigir a escolha do dia também.

Para a tese de escolher antes no nosso site: criar referência aleatória por intenção, verificar mecanismo oficial de preenchimento/conservação, testar se chega inalterada em cada inscrição e venda. Não usar nome, telefone, e-mail, UTM ou armazenamento do navegador como prova de associação. Não existe referência externa comprovada nesta revisão.

Pergunta obrigatória não controla lotação por alternativa sozinha. É necessário controle nativo por sessão/atividade/entrada ou protocolo real de reserva validado com a Even3. Um simples POST de validação que responde se há vaga não é reserva e admite corrida entre compradores.

Não foi feita compra real nem alterada a programação da Even3. Próximos dados necessários: acesso organizador, configuração de teste, payload real e confirmação do suporte sobre referência externa e controle de capacidade. Se não houver garantia dessas propriedades, manter atividades nativas sem login (se habilitadas) ou categorias por dia com estoque separado.

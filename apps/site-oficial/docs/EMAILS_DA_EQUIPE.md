# E-mails da equipe — Casa do Julgamento 2026

## Modelos de autenticação

No projeto Supabase oficial `bdfohdqucosgykdhwdwj`, em Authentication → Emails → Templates:

| Tipo | Assunto | HTML |
| --- | --- | --- |
| Reset password | Redefina sua senha \| Casa do Julgamento 2026 | `templates/emails/redefinir-senha.html` |
| Invite user | Seu acesso à equipe está pronto \| Casa do Julgamento 2026 | `templates/emails/convite-equipe.html` |

Preservar `{{ .ConfirmationURL }}`: o Supabase gera o link individual e aplica o redirecionamento solicitado pela aplicação. Os destinos existentes continuam `/operacao/redefinir` e `/operacao/ativar`. Não substituir o link por um endereço fixo nem inserir senhas no modelo.

Os arquivos no repositório não alteram os modelos do painel automaticamente. É necessário salvar os assuntos e o HTML no Supabase. A configuração SMTP do Supabase também precisa estar operacional; sua situação não foi verificada no painel nesta alteração, porque a sessão de login expirou.

## Confirmação de solicitação recebida

O formulário salva a solicitação pendente e uma mensagem imutável na tabela privada `peniel_ops.staff_email_outbox`, na mesma transação. Não cria usuário de autenticação, convite nem permissão operacional. Repetir uma solicitação já pendente não gera outro e-mail. Uma nova solicitação após recusa gera uma nova confirmação.

O adaptador de envio preparado usa a API Resend, sem dependência adicional, mediante configuração no servidor de produção:

- `RESEND_API_KEY`: chave privada do serviço de envio.
- `STAFF_MAIL_FROM`: remetente de domínio verificado, no formato `Casa do Julgamento <endereco@dominio-verificado>`.

Essas variáveis não foram criadas nem foi contratado serviço novo. Configurá-las pela interface segura da hospedagem; não colocar credenciais em código, no frontend ou no chat. Se a igreja utiliza outro provedor, adaptar o transporte antes da ativação, mantendo a fila e as garantias de idempotência.

Sem remetente configurado, o formulário continua recebendo solicitações e as mensagens permanecem pendentes. A Gestão acompanha os últimos 100 envios na página Equipe e pode tentar enviar cada confirmação depois da configuração. O estado `accepted` comprova aceitação pelo provedor, não entrega ao destinatário.

Cada mensagem tem uma chave de idempotência estável. O corpo e o remetente usados na primeira tentativa são preservados. Uma tentativa com resposta incerta só pode ser repetida automaticamente dentro de 23 horas da primeira tentativa, respeitando a janela de 24 horas do provedor; há limite de cinco tentativas. Mensagens antigas ou ainda em envio requerem conferência antes de uma nova emissão. Os detalhes técnicos da resposta do provedor nunca são retornados ao formulário público.

## Validação antes de considerar os e-mails operacionais

1. Salvar os modelos e assuntos no Supabase e conferir SMTP e redirecionamentos.
2. Configurar um remetente válido para as confirmações de solicitação.
3. Com um endereço de teste autorizado pelo responsável, solicitar cadastro e verificar recebimento real da confirmação sem liberar o painel.
4. Aprovar o cadastro como Gestão, receber o convite e ativar a conta pelo fluxo seguro.
5. Solicitar recuperação, receber o e-mail personalizado e concluir a troca de senha pelo próprio usuário.
6. Conferir falha de envio e repetição da solicitação sem duplicar cadastro, mensagem ou acesso.

Os testes automatizados cobrem geração dos modelos, escape de HTML, fila atômica, falha de envio sem perda do cadastro, restrição à Gestão e idempotência. Não substituem o teste de entrega na caixa de entrada.

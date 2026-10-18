# Alterações sobre ingressos — VS Code

Esta pasta reúne a decisão de fluxo, a análise dos scanners e o roteiro de alterações no código oficial da Casa do Julgamento.

## Documento principal

- [Decisão proposta: seleção no site Peniel e checkout Even3](DECISAO_CHECKOUT_HIBRIDO_EVEN3.md)
- [Fluxo de compra, ingresso Even3 e scanner no evento](FLUXO_COMPRA_E_SCANNER.md)
- [Prévia visual: escolha da data e continuação para Even3](ESCOLHA_DATA_EVEN3.html)
- [Alternativa: checkout completo no site Peniel](CHECKOUT_SITE.html)

## Estado

- **Recomendação em validação:** a pessoa escolhe a sessão no site Peniel e conclui a compra na Even3; preferir uma entrada/categoria Even3 por data, com o mesmo preço, em vez de uma atividade ou link de afiliado.
- **Vínculo da data:** cada botão do site deverá apontar ao link de pagamento da entrada da data correspondente. O webhook individual será associado por evento + código/ID da inscrição Even3; `pessoa.id` identifica a pessoa, não cada compra.
- **Pendente de homologação:** confirmar que cada entrada tem link específico, compra em grupo coleta os dados de todos, webhook mapeia cada participante para a entrada, checkout/QR são acessíveis sem criar conta e o scanner Peniel lê o QR oficial.
- **Alternativa:** uma entrada geral com pergunta obrigatória de data por participante. Essa opção duplica a escolha no checkout até que preenchimento automático esteja comprovado e exige controle de estoque por data no banco Peniel.
- **Verificação pública Even3 concluída:** a Even3 documenta link de pagamento para entrada selecionada, categorias com quantidade disponível, compra em grupo e webhooks financeiro/individual. No checkout híbrido, a Even3 processa pagamento e emite o QR normalmente; não é necessário criar inscrição paga por API após cobrança externa.
- **Pendente de homologação:** mapear cada categoria para a data a partir do webhook real, testar regras de e-mail/conta, cancelamento e lotação simultânea e confirmar se o scanner Peniel consegue ler o QR Even3.
- **Estado do código na branch de migração:** o site ainda encaminha para o checkout Even3; o formulário atual coleta um nome/WhatsApp por pedido; o backend já reserva vagas por sessão e gera QR Peniel próprio depois de pagamento verificado. O provedor PIX continua desativado.
- **Protótipos locais:** a nova prévia mostra a escolha de sessão com checkout Even3; a página anterior documenta a alternativa de checkout completo Peniel. Nenhuma das duas cria pedido, envia dados, reserva vagas ou cobra.

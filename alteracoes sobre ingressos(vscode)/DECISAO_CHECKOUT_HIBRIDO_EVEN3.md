# Decisão proposta: seleção no site Peniel e checkout Even3

**Data da análise:** 18/10/2026<br>
**Estado:** proposta baseada na documentação pública; ainda não homologada na conta do evento.<br>
**Evento:** Casa do Julgamento 2026 — Even3 `798621`.

## Recomendação

O fluxo híbrido faz sentido: a pessoa escolhe a apresentação no site Peniel e conclui quantidade, dados dos participantes e pagamento no checkout Even3. Para o dia acompanhar cada ingresso sem depender de uma tag inventada, recomendo configurar **uma entrada Even3 para cada data**, todas como ingresso normal, com o mesmo preço e sem criar atividades.

Exemplos de categorias:

- `09/11/2026 — Casa do Julgamento`
- `13/11/2026 — Casa do Julgamento`
- `14/11/2026 — Casa do Julgamento`
- `19/11/2026 — Casa do Julgamento`
- `20/11/2026 — Casa do Julgamento`
- `21/11/2026 — Casa do Julgamento`

No site, cada data aponta para o link de pagamento da entrada correspondente. A Even3 documenta que esse link redireciona ao checkout de uma entrada selecionada. Ela também permite definir quantidade disponível por entrada e compra de mais de uma unidade por vez. Assim, a data é representada pela própria entrada comprada e a Even3 controla o estoque online daquela sessão. [Link para entrada selecionada](https://ajuda.even3.com.br/hc/pt-br/articles/360004093772-Incluir-a-Even3-dentro-do-meu-site), [configuração das entradas](https://ajuda.even3.com.br/hc/pt-br/articles/212181346-Cadastrar-entradas-para-a-inscri%C3%A7%C3%A3o-no-meu-evento), [compras em grupo](https://ajuda.even3.com.br/hc/pt-br/articles/360038886832-Configurar-entradas-para-inscri%C3%A7%C3%B5es-em-grupos).

No código da branch analisada constam 210 vagas para venda online e limite total de 300 por sessão. Se esses números continuarem aprovados pela coordenação, configurar cada entrada Even3 com o limite online de 210 e controlar separadamente a cota presencial restante. Não publicar 300 vagas online por data sem confirmar essa regra.

Isso mantém o ingresso geral do evento, com categorias por sessão. **Não são atividades**: não exigem que a pessoa se inscreva em uma atividade da programação.

## Jornada proposta

1. A pessoa abre a página de ingressos no site Peniel, sem criar conta no site.
2. Escolhe uma data e segue pelo link Even3 daquela entrada.
3. Na Even3, escolhe a quantidade, preenche os dados de cada participante e paga. Configurar a entrada para permitir compra em grupo e o formulário para coletar os dados de todos os participantes.
4. A Even3 emite os comprovantes/QRs e envia os eventos de inscrição e venda aos webhooks.
5. O backend Peniel grava cada participante, a entrada/data, o identificador Even3, o status financeiro e o status de uso.
6. No dia, o scanner Peniel confere a data da entrada e impede segunda utilização antes de liberar a pessoa.

O fluxo de compra em grupo com dados de todos os participantes é suportado pela Even3. A documentação de webhooks mostra o identificador `pessoa.id`, `inscricao.id`, `inscricao.codigo`, `inscricao.titulo` e respostas personalizadas do formulário. A confirmação de inscrição, sozinha, não significa que houve pagamento; usar o gatilho de venda aprovada/cancelada/reembolsada para o estado financeiro e o gatilho de participante para o vínculo individual. A FAQ da Even3 diz que o código da inscrição pode relacionar o evento de confirmação com a venda. [Participantes](https://developers.even3.com/gatilhos-de-participantes-2281973m0), [vendas](https://developers.even3.com/gatilhos-de-venda-2282082m0).

A amostra do webhook de participante traz o título da entrada, mas não mostra um ID numérico da categoria. Até a conta real confirmar o payload, nomear cada categoria com uma data única e estável; na homologação, verificar se a API/webhook também fornece o ID da entrada. O webhook financeiro inclui `item_venda.id_especifico`, e a Even3 documenta a ligação entre venda e inscrição pelo código do ingresso.

### Chave de associação no banco Peniel

Usar `evento_even3 + inscricao.codigo` (ou o `inscricao.id` estável) como chave única do ingresso individual. Guardar `pessoa.id` como identificador da pessoa, mas **não usar e-mail ou `pessoa.id` sozinho para deduplicar ingresso**: a mesma pessoa pode comprar outra vez ou para outra data. A data Peniel vem da entrada/categoria associada à inscrição. O status pago vem do webhook financeiro correspondente, não apenas da confirmação de inscrição.

Processar webhook com inbox idempotente: guardar o identificador de cada disparo, aceitar reenvio, lidar com eventos fora de ordem e reconciliar status com a API/relatório Even3. Se a compra for cancelada ou reembolsada, invalidar o ingresso local. Não liberar entrada até o registro local estar confirmado.

## Por que não usar link de afiliado para carregar a data

Os links de afiliados da Even3 são descritos como links únicos para afiliados/parceiros, acompanhados de cupom, para medir inscrições/vendas geradas por cada parceiro. A documentação consultada não afirma que um código de afiliado possa representar a sessão escolhida nem que esse identificador retorne em cada inscrição do webhook. Portanto, afiliado é útil para atribuição de divulgação, mas não deve ser a chave da data. [Descrição dos links de afiliados](https://blog.even3.com.br/venda-de-ingressos-na-even3/).

## Se for obrigatório manter uma única categoria geral

Há uma alternativa, mas ela depende de teste: manter uma entrada Even3 única e adicionar uma pergunta obrigatória de data por participante. A resposta precisaria aparecer em `pessoa.personalizado` no webhook e ser validada contra a lista de sessões. A Even3 documenta validação/preenchimento via API externa, porém não documenta que um parâmetro arbitrário do link Peniel seja repassado automaticamente para o campo. Até isso ser comprovado, o comprador provavelmente teria de confirmar a data de novo no checkout Even3. [Validação de pergunta](https://developers.even3.com/valida%C3%A7%C3%A3o-de-pergunta-2282826m0).

Com uma única entrada, a Even3 também controla apenas a quantidade total, não a lotação de cada data. O banco Peniel teria de segurar a capacidade por sessão antes do redirecionamento e reconciliar pagamentos, abandonos, cancelamentos e expirações. Um endpoint de validação consulta disponibilidade, mas não reserva sozinho a última vaga. Isso aumenta risco e trabalho operacional.

## Página Peniel

O site deve ser uma seleção simples de sessão, com o botão levando ao link de pagamento específico da entrada Even3. A quantidade, os dados individuais e o pagamento ficam no formulário Even3. Informar claramente que todos os ingressos comprados naquele checkout são para a data escolhida.

Até a Even3 comprovar preenchimento automático da data, não afirmar que ela já foi transmitida somente porque o usuário clicou em uma data no site. Com entradas distintas, a própria categoria comprada grava a sessão; se a organização optar por uma entrada única, pedir a data novamente em pergunta obrigatória.

O botão no HTML de prévia é demonstrativo e não contém links da conta Even3. Nenhuma compra ou dado é enviado por ele.

## Leitura no evento

O scanner oficial Even3 emite o check-in geral do evento. A documentação de ajuda informa que esse check-in geral só pode ser feito uma vez por participante, sem controle por dia do evento. O webhook de check-in também é uma notificação posterior à confirmação, não uma autorização prévia para o Peniel. Por isso, usar o scanner Peniel como autoridade para conferir `data_da_sessao == sessao_em_operacao` e consumir o ingresso uma única vez. [Credenciamento geral](https://ajuda.even3.com.br/hc/pt-br/articles/29254959740059-Realizar-o-credenciamento-dos-participantes), [gatilhos de participantes](https://developers.even3.com/gatilhos-de-participantes-2281973m0).

Antes de escolher qual QR o scanner Peniel lerá, testar se a câmera consegue ler o QR Even3 e se o conteúdo pode ser associado ao código de inscrição/participante consultável pela API. A API V2 documenta `check_in_code` no participante, mas não prova que o QR impresso contém esse valor em formato diretamente legível pelo scanner Peniel. Se não for possível, emitir também um QR operacional Peniel após a confirmação da inscrição e enviar uma instrução clara para usar apenas o leitor Peniel na portaria. Não marcar check-in primeiro no app Even3 e depois no Peniel: isso cria duas autoridades independentes.

## Teste de homologação

Criar uma entrada gratuita oculta `HOMOLOGAÇÃO — 18/10/2026`, sem divulgação pública, e executar:

1. Acessar o site sem login, escolher a data teste e confirmar que abre a entrada correta na Even3.
2. Fazer uma inscrição com 1 participante e outra com 2 participantes no mesmo pedido; conferir formulário individual, entrada/categoria, dados e QR de cada pessoa.
3. Conferir a política de e-mail para grupos: testar se cada integrante precisa de e-mail próprio e como famílias compram quando algum participante não tem endereço individual.
4. Verificar o webhook real: `pessoa.id`, código/ID da inscrição, título da entrada e eventual `personalizado`; conferir se cada integrante tem sua inscrição individual.
5. Comprar novamente com o mesmo e-mail, se a Even3 permitir, para uma entrada/data diferente e confirmar que os registros não se misturam.
6. Cancelar uma inscrição e conferir o webhook e o bloqueio local.
7. Testar o checkout sem conta Even3 até o fim e confirmar como a pessoa recebe/localiza o QR. A documentação mostra envio do comprovante por e-mail, mas exige conta para acessá-lo pela área do participante. Esse ponto afeta a simplicidade para quem não tem familiaridade digital. [Comprovante do participante](https://ajuda.even3.com.br/hc/pt-br/articles/115000390143-Acessar-meu-comprovante-de-inscri%C3%A7%C3%A3o).
8. Ler o QR com o scanner Peniel: data correta, data errada, repetição do QR e leitura simultânea em dois aparelhos. O scanner geral Even3 registra o check-in do evento uma única vez, sem separar por data da apresentação.
9. Simular duas pessoas tentando comprar a última vaga da mesma sessão e acompanhar o que ocorre com inscrições não pagas/expiradas; isso valida a proteção do estoque por entrada.
10. Fazer um teste pago de baixo valor/sandbox para validar webhook de venda aprovada, pagamento e reembolso. A entrada gratuita valida inscrição e participante, mas não gera webhook financeiro de venda.
11. Só depois da homologação criar e divulgar as seis entradas pagas, com estoque por data revisado pela coordenação.

### Limite do teste gratuito

O teste gratuito valida seleção da entrada, resposta dos campos, inscrição individual, QR e webhooks de participante. A Even3 informa que eventos/inscrições gratuitos não geram gatilhos de venda; portanto ele não valida pagamento aprovado, falha, reembolso ou relação completa do webhook financeiro.

## Alterações previstas no código oficial

- Manter `ingressos/[dia].jsx` como seletor da data, mas trocar o destino genérico pelo link de pagamento da entrada correspondente.
- Criar configuração server-side `session_id -> even3_entry_id / payment_url`; não derivar o destino de parâmetros livres do navegador.
- Manter o webhook Even3 existente, mas sair de `pending_review` para processamento idempotente homologado: venda, inscrição, cancelamento/reembolso e mapeamento da data.
- Criar/ajustar migração para mapa de entradas por sessão e registros individuais indexados pelo código da inscrição Even3.
- Manter banco Peniel como fonte operacional de sessão/uso e criar scanner autenticado com consumo transacional do ingresso.
- Não implementar checkout/cartão/PIX próprio na primeira versão híbrida. O pagamento fica no checkout Even3.
- Preservar `CHECKOUT_SITE.html` como referência da alternativa completa de checkout Peniel, caso a Even3 não ofereça o comportamento necessário.

## Decisão pendente para autorizar a implementação

O teste deve determinar se adotamos:

**A. Recomendado para o piloto:** seis entradas/categorias Even3, uma por sessão, links específicos no site; mesma experiência e preço, estoque por data na Even3.

**B. Se a conta/organização exigir uma única entrada:** campo obrigatório de data por participante e controle de capacidade no Peniel; só avançar se webhook trouxer a resposta de forma individual e a equipe aceitar a escolha repetida no checkout.

Nenhuma dessas alterações foi aplicada à branch oficial ou publicada.

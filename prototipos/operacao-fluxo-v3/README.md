# Casa do Julgamento — Simulador Operacional V3

Abra `index.html?posto=inicio` para seleção dos postos. São disponíveis: `?posto=portaria`, `?posto=coordenacao`, `?posto=guia`, `?posto=telao`.

Sem Even3, leitor real, pagamentos, autenticação ou banco. Compartilha o estado somente entre abas do **mesmo navegador** (`localStorage` + `BroadcastChannel`), com dados de treinamento. Nunca usar como operação de evento.

**Modificações V3:** Portaria apenas registra check-in → fila na Coordenação; a Coordenação aloca famílias e envia para sala de espera exclusivamente vazia; o Guia decide iniciar e finalizar sem autorização digital; o ponto seguro anterior é exigido; teto **dois grupos ativos**, contando `safe` até finalizar; sala de espera desocupa ao iniciar; telão informa grupo atual/próximo sem nomes; bilheteria presencial é **somente simulação**, sem pagamento.

Mais detalhes em `PLANO_OPERACIONAL_V3.md`. Teste de regras: `node smoke_test.cjs` (não é teste de navegador real).
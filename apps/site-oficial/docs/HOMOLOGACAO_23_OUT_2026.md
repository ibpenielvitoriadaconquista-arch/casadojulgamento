# Casa do Julgamento 2026 — Plano de homologação de 23/10/2026

**Estado: PR em rascunho. NÃO publicar nem executar as migrações sem aprovação da Gestão Geral.**

## Limites
- Instância Supabase oficial existente; não criar outra.
- A sincronização Even3 V1 é de leitura; importa participantes, pagamentos e catálogo a cada 10 minutos.
- Pagamento “Pago” na API ainda NÃO relaciona automaticamente venda ↔ ingresso individual. Ingresso real continua bloqueado.
- Não habilitar `CDJ_ENTRY_ADMISSION_ENABLED` antes da conciliação, revisão das seis categorias, cancelamentos e teste de duas portarias.
- O ensaio usa `peniel_ops.ensaios_session_state` isolado. Nunca zerar `peniel_ops.session_state`, transações Even3 nem `peniel_ops.cashier_attendances`.
- O Apoio na rota de ensaio utiliza cronômetro local, sem gravação em banco.
- A migração de ensaio `20261021113000_ensaio_2026_state_isolated.sql` **não foi aplicada** e exige nova aprovação.
- As migrações Even3 e de Caixa já foram aplicadas à instância oficial em ciclos anteriores; revisar drift antes de qualquer deploy.

## Critérios obrigatórios do ensaio
1. Cinco contas com convites individuais, sem senha compartilhada, autenticação e autorização por função.
2. Compra controlada de 09/11 na Even3: comprovar emissão de um QR/código individual e registro de pagamento; teste com dois participantes em uma venda.
3. Leitor por câmera no aparelho efetivo e campo manual para o MESMO código; validar comportamento para QR URL e QR numérico.
4. Consulta do QR deve usar `cdj_even3_api_attendees`, não a Pluga.
5. Categoria 09/11 aprovada; TESTE, Cópia de TESTE, Ingresso Geral e todas as demais datas são rejeitadas na sessão 09/11.
6. Duas leituras simultâneas do mesmo ingresso: apenas uma chegada no ensaio. Repetição mostra duplicidade.
7. Coordenação recebe pessoa em fila única e atribui G01 a G15; limite 20 por grupo; conflitos concorrentes falham sem sobrescrita.
8. Entrega da senha, fechamento de grupo, chamada à espera, confirmação do Guia, início, ponto seguro e finalização.
9. Apoio mede cronômetro isolado e registra resultados manualmente; validar UX do celular.
10. Compra no Caixa em balcão e tablet abre o checkout da data correta. Pix/dinheiro fora da Even3 não gera comprovante ou ingresso.
11. Simular ausência de internet, QR ilegível, ingresso não localizado e entrada sem pagamento; sistema deve rejeitar entrada real.
12. Preparar e registrar tempo real entre compra e disponibilidade após importação; atualizar sob demanda é trabalho pendente.

## Impedimentos para operação real em 09/11
- Criar e conciliar `peniel_ops.entry_authorizations` por código individual, com pagamento comprovado, data, estorno/cancelamento e bloqueio atômico de dupla entrada.
- Homologar `even3_integration.entry_map` das seis categorias já confirmadas pela API Even3, após verificação administrativa.
- Garantir paginação na API Even3 V1 e consistência com maior volume.
- Executar testes de QR em aparelhos e navegadores reais; BarcodeDetector pode não existir em todos.
- Confirmar estratégia de vendas presenciais diretas (Pix/dinheiro) e emissão individual na Even3.
- Publicar pacote integrado em Vercel apenas após revisão/autorização; eventual limite diário da Vercel.
- Após ensaio, confirmar conta e acesso de cada posto.

## Evidência antes do aceite
Capturas da Portaria e Coordenação, IDs de execução de testes, versão do deploy, checklist assinado pela Gestão Geral e confirmação formal de que nenhum ingresso de apresentação foi consumido durante o ensaio.

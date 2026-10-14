# Apresentação para a liderança — Casa do Julgamento 2026

**Atualizada em 14 de outubro de 2026**  
**Igreja Batista Peniel · Vitória da Conquista, BA**  
**Peça: Cilada do Coração**

> Documento de apresentação do projeto, sem autorização para vendas reais.

---

## Slide 1 — O propósito

O evento reúne espectadores em uma experiência teatral com arrecadação de alimentos. Queremos que a divulgação seja atraente, que o espectador consiga adquirir ingresso de maneira clara e que os voluntários tenham uma operação organizada.

## Slide 2 — Números e regras definidos

| Informação | Regra |
| --- | --- |
| Datas | 09, 13, 14, 19, 20 e 21 de novembro |
| Horários | Abertura dos portões: 17h / 20h / 18h / 20h / 17h / 18h, respectivamente |
| Valor | R$ 15 + 1 kg por espectador |
| Capacidade | 300 lugares por sessão |
| Online / presencial | 210 / 90 |
| Grupos | 15 grupos de até 20, formados após o check-in |
| Entrada no circuito | Mediante orientação e liberação humana, nunca apenas pelo cronômetro |

## Slide 3 — O que temos pronto

- Site público na Vercel, domínio próprio cadastrado e caminho para vídeo-convite.
- QR de panfleto do lote01 apontando ao convite, com parâmetros de origem.
- Telas pré-montadas de escolha de sessão, quantidade e dados.
- Planejamento técnico e operacional na Central IA.
- Documentos para coordenação, financeiro, voluntários e marketing no Drive da igreja.
- Protótipos independentes A e B no GitHub, sem afetar produção.

## Slide 4 — O que precisa ser testado

- Vídeo completo e som no domínio próprio em celulares diferentes.
- Botões de navegação e retorno entre sessões e quantidade.
- QR do panfleto impresso em lote piloto.
- Acessibilidade, desempenho e clareza da experiência móvel.

## Slide 5 — O que falta construir

- Banco PostgreSQL com controle transacional e backups.
- PIX de gateway real, confirmação autenticada, conciliação e estornos.
- Emissão e recuperação seguras de ingresso QR individual.
- Painel financeiro, bilheteria, controle de sessões, check-in, grupos e guias.
- Identidade individual, autenticação e permissões dos operadores.
- Caravanas e divulgação com registro de origem autorizado.

## Slide 6 — As decisões da coordenação

Segurança do circuito e fluxo físico; escalas e papéis; horário de chegada; atrasados, lista de espera, caravanas; atendimento e comunicação; aprovação dos designs; treinamento e plano de contingência.

## Slide 7 — As decisões do financeiro e jurídico

**Financeiro:** provedor de pagamento (Mercado Pago é hipótese, não escolha formal), conta recebedora, tarifas, meios presenciais, reembolsos e orçamento.

**Jurídico:** meia-entrada, consumidor, classificação etária, licenças, privacidade, termos de venda e cookies.

## Slide 8 — A jornada do espectador

QR → convite → sessões → quantidade → dados → pagamento validado → ingresso QR individual → check-in → grupo → guia.

O horário divulgado é **abertura dos portões**, não o instante de início da encenação.

## Slide 9 — Comparação visual

| Original | Variação A | Variação B |
| --- | --- | --- |
| Mantém identidade publicada | Claro, simples, estratégico | Efeitos leves de fogo no convite e dois caminhos nas sessões |
| Base atual na Vercel | Demonstração HTML própria | Demonstração HTML própria |
| Não substituído | Não gera pagamentos | Não gera pagamentos |

- [Site Original](https://www.ibpeniel.com)
- [Prévia A](../prototipos/variacao-a/index.html)
- [Prévia B](../prototipos/variacao-b/index.html)
- [Slides editáveis A](https://docs.google.com/presentation/d/1AWiirAInXyD0_X3MhzIHyXGzqIqhd1tyHVjZVKVkn6Y/edit)
- [Slides editáveis B](https://docs.google.com/presentation/d/1rFVbiEBij9dgx18Ig8lvtw3ExYg7PbFvkOld4an74lQ/edit)

## Slide 10 — Próxima execução

1. Preparar banco, ambiente de homologação e versionamento seguro.
2. Decidir fornecedor e homologar pagamento.
3. Implementar ingressos, painel e controle de acesso.
4. Ensaiar o circuito, testar situações excepcionais.
5. Reunir assinaturas de aceite e somente depois liberar cobrança.

**Regra central:** a escolha visual não interrompe nem muda a execução funcional da aplicação.

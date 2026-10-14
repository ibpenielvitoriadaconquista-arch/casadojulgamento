# Próximas etapas e decisões para liderança

| Frente | O que falta | Quem confirma |
| --- | --- | --- |
| Financeiro | Escolher gateway, titularidade, taxas, reembolso; Mercado Pago ainda é hipótese | Igreja e financeiro |
| Jurídico | Meia-entrada, classificação etária, licenças, consumidor e LGPD | Jurídico e coordenação |
| Banco | PostgreSQL teste/prod, transações, backups, proteção de dados | Desenvolvimento |
| Pagamento | PIX sandbox, webhooks autenticados, idempotência, conciliação tardia | Desenvolvimento, financeiro e testes |
| Ingressos | 1 QR por pessoa, emissão após pagamento válido, recuperação segura | Desenvolvimento e operação |
| Admin | Usuários individuais, MFA, RBAC, logs, bilheteria e relatórios | Liderança + desenvolvedores |
| Operação | Check-in, grupos de 20, guias e liberação manual no ponto seguro | Coordenação + voluntários |
| Divulgação | QR físico, campanhas, artes aprovadas, caravanas | Marketing + coordenação |
| Qualidade | Testes mobile, performance, segurança, ensaios e rollback | Codex + coordenação |

## Etapas
**E0** preservar referência e código atual; testes de build.  
**E1** PostgreSQL de homologação e estoque online/presencial transacional.  
**E2** homologar gateway e checkout; simular pedidos com valores de teste.  
**E3** usuários, painel, bilheteria, check-in e guias.  
**E4** comunicação, caravanas e LGPD aprovada.  
**E5** testes ponta a ponta, aprovação por escrito e só então vendas.

## Decisão sobre design
Escolher **Original / A / B / Híbrida**, observando clareza, identidade teatral, acessibilidade, performance mobile e consistência dos botões.

[Conselho das IAs](https://docs.google.com/document/d/1gaZ5Jn83MYUcF4X0q-5MYjDj-trvGU6qnD1UYKWmkqE/edit) — sugestões IA-008 a IA-012 estão pendentes de aprovação.

# Fluxo do espectador e equipe — visão para reunião

## Espectador
```text
QR lote 01 → /convite [1 vídeo + 1 CTA]
                  ↓
/sessoes → /quantidade → /dados → /pagamento
    ↑           ↑           ↑          ↓
     ← voltar e preservar seleção ←    ← consultar pedido existente
                                     ↓ pagamento validado
                              /confirmacao → /ingresso
                                     ↓
                             check-in presencial → grupo
```
O QR de panfleto **não é QR de ingresso**. Na demonstração não há venda verdadeira.

## Papéis e menor privilégio (propostos)
- Coordenação geral: decisões e acompanhamento global.
- Coordenação operacional: lotação, filas, horários e exceções.
- Financeiro: conciliação e reembolso com autorização.
- Bilheteria: venda presencial na cota e emissão após pagamento válido.
- Portaria: lê QR sem acesso aos valores da compra.
- Organizador: reúne famílias e distribui grupos após check-in.
- Guia: vê o grupo designado, inicia percurso e libera grupo seguinte **somente no ponto seguro**.
- Marketing: artes, campanhas e indicadores agregados sem acesso a compradores.
- Atendimento: encaminha recuperação segura e dúvidas.

## Telas planejadas
`/admin`, `/admin/vendas`, `/admin/sessoes`, `/admin/bilheteria`, `/admin/checkin`, `/admin/grupos`, `/admin/guias`, `/admin/caravanas`, `/admin/colaboradores`, `/admin/divulgacao`, `/admin/configuracoes`.

## Ensaio
Simular falta de internet, ingresso repetido, atrasados, família maior que vagas no grupo, emergência, fila de espera, QR de outra sessão e dupla leitura. **O cronômetro nunca abre a próxima sala automaticamente.**

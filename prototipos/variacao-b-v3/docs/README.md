# Variação B — Edição Cinematográfica V3 (demonstrador)

Visual: fotografia em estilo 3D/cinematográfico aprovada pela liderança em 14/10/2026. A interação usa **paralaxe 2,5D**, efeitos CSS e partículas canvas; não é um modelo 3D rigged. Sem tracking e sem dados pessoais.

**NÃO É checkout real**. Não cria ordens, vagas, ingressos ou cobranças. Por segurança, nenhuma disponibilidade em tempo real é exibida. As únicas quantidades (210 online / 90 presencial) indicam capacidades previstas.

## Imagens

Assets otimizados derivados de dois mockups aprovados: coração acorrentado e céu/inferno. `reference-*.webp` documentam as artes de referência originais. **Atenção:** as artes de referência contêm horários e contadores ilustrativos inconsistentes com as regras oficiais e NÃO devem ser publicadas como tabelas de sessão nem usadas como fonte de disponibilidade. A página reconstitui horários e valores corretos em texto HTML próprio.

## Funcionalidades

- Hero com imagem 3D de coração e deslocamento suave ao cursor.
- Partículas em canvas com limite de densidade e FPS vinculado a requestAnimationFrame.
- Profundidade paralaxe em cenários celestial e infernal.
- Revelação de seções com IntersectionObserver.
- Seleção de seis sessões (09/11 17h, 13/11 20h, 14/11 18h, 19/11 20h, 20/11 17h, 21/11 18h, **horários de portões**).
- Resumo de 1–6 ingressos a R$15 + 1 kg por pessoa, sem formulário pessoal e sem pagamento.
- Botão de reduzir movimento, respeita `prefers-reduced-motion`, controle no teclado, suspensão de animações com aba oculta.
- Link para o vídeo oficial no site de origem; mídia não é copiada nem alterada no protótipo.

## Infra

Só arquivos estáticos HTML/CSS/JS/WebP. Sem framework ou build. A conta da igreja hospeda na Vercel via GitHub. Endereço de demonstração: `https://casadojulgamento.vercel.app/prototipos/variacao-b-v3/`.

O site oficial `https://www.ibpeniel.com` permanece intocado. Alterar o site comercial exige aprovação, testes de produção e rollback.
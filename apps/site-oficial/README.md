# CASA DO JULGAMENTO — V3 UX / VERCEL PREVIEW PREPARADA (12/10/2026)

**NÃO PUBLICAR COMO BILHETERIA REAL.** Esta V3 deriva da V2 e preserva os bloqueios financeiros, administrativos e de check-in. O domínio planejado é **ibpeniel.com**, ainda não comprado. Não usar o projeto antigo Vercel vinculado à Panquecas Peniel.

## Diferenças desta versão

- UI/UX mais limpa e cinematográfica (arte original do coração, tipografia legível, fundo grafite e acentos vermelhos/dourados); mobile-first.
- `/convite` para flyer preserva um único CTA; `/` possui CTA principal e links secundários de divulgação e caravana.
- `/api/sessoes` fornece **somente as seis datas aprovadas, sem expor vagas falsas e sem compra**, enquanto `PRODUCTION_RELEASE_APPROVED` estiver ausente ou `false`. Assim a interface pode ser demonstrada sem banco.
- `/api/health` de preview não declara pagamentos como funcionais.
- Removida importação externa de Google Fonts; não há dependência de terceiros para a tipografia padrão.
- 7 testes adicionais de critérios UX/deploy, além dos 18 testes V2 existentes.
- Material de governança em `docs/operacao/`, incluindo divisão IA/equipe presencial e roteiro seguro GitHub/Vercel.

## Situação verificada

- 25/25 testes de Node aprovados em 12/10/2026.
- 32 arquivos JS/JSX/MJS/CJS foram analisados pelo parser TypeScript sem erros de sintaxe.
- `npm install` / `npm ci` / `npm audit` / `npm run build` **não foram executados** por falha de acesso DNS ao registro npm (EAI_AGAIN).
- Banco PostgreSQL, PIX, WhatsApp, SSO e check-in **não** foram integrados.
- Criado projeto Vercel separado `ibpeniel-casa-do-julgamento` (ID `prj_MXo42BQ3q8qwgEnW7DBcjdMX8CfL`), com Preview protegido e `PRODUCTION_RELEASE_APPROVED=false`. **Nenhum deploy foi feito.**

## Como usar

1. Ler `docs/operacao/01_QUEM_FAZ_O_QUE_IA_E_EQUIPE.md` e `docs/operacao/02_VERCEL_GITHUB_DEPLOY_SEGURO.md`.
2. Após disponibilizar acesso a npm, executar instalação **revisando versões e dependências** e gerar lockfile; depois rodar `npm ci`, `npm test`, `npm audit --audit-level=high`, `npm run build`.
3. Preparar repositório GitHub privado do projeto isolado e configurar a Vercel somente neste novo projeto.
4. A V3 possui páginas públicas em preview, mas a compra continua desativada. Não inserir dados de espectadores nem testar PIX com dinheiro de verdade.
5. Após jurídico, fornecedores e testes externos, apresentar novo pedido de autorização de produção.

## Fonte da verdade

Central IA -> Documento Mestre e decisões aprovadas do Conselho. O cartaz tem a grafia plural e o documento oficial singular; precisa de confirmação editorial. A hora de cada sessão é **abertura dos portões**, não hora exata de assistir; o grupo é definido na chegada e check-in.


## V3.2 — Vídeo de convite (13/10/2026)
- O arquivo enviado pela coordenação foi integrado como `public/video-convite.mp4` (41 segundos, H.264/AAC), com início manual, controles nativos, reprodução inline no celular e poster da arte oficial.
- Reutilizado no início (`/`) e na página do QR do flyer (`/convite`).
- Não ativa pagamentos nem modifica as regras de privacidade do projeto.

# Projeto oficial da Casa do Julgamento

A aplicação oficial e os painéis estão em apps/site-oficial. Configurar Root Directory da Vercel como apps/site-oficial e framework Next.js.
As páginas de escolha de versões e os protótipos foram retirados desta branch; permanecem no histórico do Git.

Os quatro arquivos de mídia pendentes foram autorizados explicitamente em 17/10/2026 e incluídos nesta entrega. O vídeo é reconstruído pelos fragmentos durante npm run build. Instalar dependências com npm ci.

Validação da entrega operacional: 46 testes aprovados e build local concluído. Banco da igreja preparado com seis sessões. O código inclui painéis autenticados em /operacao/{posto}; o treinamento permanece separado nas rotas existentes.

Pendências para operação real: publicar e validar o commit completo na Vercel da igreja, cadastrar o primeiro colaborador, testar em dois dispositivos, mapear as atividades e homologar os webhooks/QR da Even3. A conexão Vercel retornou 403 para a equipe peniel-casadojulgamento na última verificação. O domínio só deve ser transferido após validar o destino.

Consulte apps/site-oficial/docs/OPERACAO_CENTRAL.md para arquitetura, validações e limites atuais. O projeto pessoal permanece preservado.

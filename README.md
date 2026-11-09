# BrasilCord Web 🇧🇷

Site público do BrasilCord para navegadores desktop e mobile. Este repositório contém **apenas os arquivos estáticos públicos** necessários ao navegador; backend, código do Electron e dados de usuários permanecem fora daqui.

## Site

Quando o GitHub Pages estiver ativo e o deploy terminar, acesse:

https://cdopc7870-web.github.io/brasilcord-web/

## Ativar hospedagem gratuita

Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions**. A publicação é feita pelo workflow `Publicar BrasilCord Web` em cada atualização da branch main.

## Funcionalidades

Interface compartilhada com o aplicativo Windows; login e comunidades usando o backend existente. Áudio, câmera e tela usam WebRTC e APIs do navegador. Para captura de tela é necessário HTTPS e suporte a `getDisplayMedia`, que pode estar indisponível em navegadores móveis.

## Segurança

Este repositório é público: nunca adicione senhas, tokens de API, credenciais TURN nem arquivos do banco de dados. A autenticação funciona com backend remoto; tokens de login são salvos apenas na sessão da aba. O código enviado ao navegador é necessariamente visível aos visitantes.

## Testes pendentes

Validar login, chats, chamadas, permissões de câmera/tela, responsividade e conexão TURN com duas contas em redes diferentes antes de divulgar como versão estável.

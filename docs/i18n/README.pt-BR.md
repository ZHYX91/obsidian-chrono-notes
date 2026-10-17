# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português](README.pt-BR.md) · [Русский](README.ru-RU.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

O Chrono Notes adiciona ao Obsidian um calendário para notas periódicas, tarefas, feriados regionais, eventos locais e notas sobre intervalos de datas.

## Recursos

- Visões de semana, mês, ano e século com status das notas, tarefas, estatísticas e prévias.
- Notas diárias, semanais, mensais, trimestrais, anuais, por década e por século, com modelos próprios ou Templater.
- Navegação entre notas, progresso de tarefas, mapas de calor e notas de intervalos de datas.
- Calendários lunar chinês, Ganzhi, persa, etíope, hebraico, indiano e islâmico, além de feriados da China continental e de Singapura.
- Fontes ICS locais somente para leitura e exibição ajustável de datas sem alterar o YAML.

## Requisitos e compatibilidade

Requer Obsidian 1.12.7 ou posterior, no computador ou celular. Arquivos ICS dentro do Vault funcionam nas plataformas compatíveis; caminhos fora do Vault só funcionam no computador. Calendários alternativos dependem dos dados do ambiente.

## Instalação

**Plugins da comunidade:** abra **Configurações → Plugins da comunidade → Explorar**, procure **Chrono Notes**, clique em **Instalar** e depois em **Ativar**.

**Manual:** baixe `chrono-notes-<version>.zip` na [versão mais recente](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest) e extraia em `Vault/.obsidian/plugins/`. A pasta `chrono-notes/` contém `main.js`, `manifest.json` e `styles.css`. Reinicie o Obsidian e ative o plugin.

**Atualização:** faça backup de `data.json` e preserve o arquivo. Substitua apenas os arquivos do plugin; exclua `data.json` somente para redefinir as preferências.

## Como usar

Configure os tipos de notas, os caminhos e os modelos; depois abra o calendário pelo ícone lateral ou pela paleta de comandos. **Um clique seleciona a data, mas não cria uma nota.** Clique duas vezes ou pressione Enter para abrir ou criar a nota; em telas sensíveis ao toque, mantenha pressionado. O botão direito abre as ações da data. Ctrl/Cmd+clique ou o botão do meio abre uma nova aba. Ative as extensões e fontes ICS conforme necessário.

## Configurações

Escolha idioma, início da semana, formatos de data, caminhos e modelos. Alterar o idioma dos nomes de arquivos não renomeia notas existentes: confira a prévia do caminho. Há configurações separadas para aparência, tarefas, estatísticas e notas de intervalo.

## Limitações

As fontes ICS são locais e somente para leitura; assinaturas remotas não são baixadas. Por padrão, são lidas até 32 fontes por atualização. Eventos recorrentes com `RRULE` ou `RDATE` são contados, mas não expandidos. Feriados ainda não publicados oficialmente não são previstos. Calendários alternativos dependem do ambiente.

## Privacidade e segurança

O plugin lê as notas Markdown pertinentes e os arquivos ICS escolhidos para montar índices e mostrar informações. Nenhum conteúdo é enviado e não é necessária uma conta. O índice derivado fica no IndexedDB local e pode ser recriado. A área de transferência nunca é lida; uma data só é copiada após a ação «Copiar data».

## Desenvolvimento

Use Node.js 24.19.0 e npm 11.17.0, execute `npm ci` e `npm run check`. Consulte a [arquitetura](../architecture.en.md) e a [estratégia de testes](../testing-strategy.en.md).

## Suporte

Use as [discussões](https://github.com/ZHYX91/obsidian-chrono-notes/discussions) para perguntas e ideias. Registre erros reproduzíveis em [Issues](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose) e falhas de segurança [em particular](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new). Não publique dados pessoais do Vault.

## Licença

[MIT](../../LICENSE) © ZhengYX

## Agradecimentos

Inspirado em [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) e [Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar).

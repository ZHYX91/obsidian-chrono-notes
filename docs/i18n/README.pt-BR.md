# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português](README.pt-BR.md) · [Русский](README.ru-RU.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

O Chrono Notes adiciona ao Obsidian um calendário para notas periódicas, tarefas, feriados regionais, eventos locais e notas sobre intervalos de datas.

## Recursos

Veja o calendário no computador e no Android:

![Calendário Chrono Notes no computador](../assets/chrono-notes-desktop-en.png)

![Calendário Chrono Notes no Android](../assets/chrono-notes-android-en.png)

- Visões de semana, mês, ano e século com status das notas, tarefas, estatísticas e prévias.
- Notas diárias, semanais, mensais, trimestrais, anuais, por década e por século, com modelos próprios ou Templater.
- Navegação entre notas, progresso de tarefas, mapas de calor e notas de intervalos de datas.
- Calendários lunar chinês, Ganzhi, persa, etíope, hebraico, indiano e islâmico, além de feriados da China continental e de Singapura.
- Fontes ICS locais somente para leitura e exibição ajustável de datas sem alterar o YAML.

## Requisitos e compatibilidade

Requer Obsidian 1.12.7 ou posterior, no computador ou celular. Arquivos ICS dentro do Vault funcionam nas plataformas compatíveis; caminhos fora do Vault só funcionam no computador. Calendários alternativos dependem dos dados do ambiente.

## Instalação

### Plugins da comunidade

Abra **Configurações → Plugins da comunidade → Explorar**, procure **Chrono Notes**, clique em **Instalar** e depois em **Ativar**.

### Manual

Baixe `chrono-notes-<version>.zip` na [versão mais recente](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest) e extraia em `Vault/.obsidian/plugins/`. A pasta `chrono-notes/` contém `main.js`, `manifest.json` e `styles.css`. Reinicie o Obsidian e ative o plugin.

### Atualização

Faça backup de `data.json` e preserve o arquivo. Substitua apenas os arquivos do plugin; exclua `data.json` somente para redefinir as preferências.

## Como usar

Configure os tipos de notas, os caminhos e os modelos; depois abra o calendário pelo ícone lateral ou pela paleta de comandos. **Um clique seleciona a data, mas não cria uma nota.** Clique duas vezes ou pressione Enter para abrir ou criar a nota. O botão direito abre o menu da data; se houver eventos ICS, esse menu permite consultar a lista completa. Ctrl/Cmd+clique ou o botão do meio abre a nota em uma nova aba. Ative as extensões e fontes ICS conforme necessário.

Em uma tela sensível ao toque, mantenha uma data pressionada para abrir o menu e escolha a ação para abrir ou criar a nota diária. Se nenhum menu aparecer, a nota será aberta ou criada quando você soltar o dedo. Um toque prolongado em uma entrada de semana, mês ou outro período abre diretamente a nota correspondente.

### Tarefas no calendário

Adicione uma tarefa com caixa de seleção a uma nota e inclua um marcador de data:

```markdown
- [ ] Enviar o relatório semanal 📅 2026-10-20
- [ ] Preparar os documentos 🛫 2026-10-18 ⏳ 2026-10-19 📅 2026-10-20
- [ ] Revisar o relatório ⏳ 2026-10-20 📅 2026-10-20
```

`🛫` indica a data de início, `⏳` a data programada e `📅` o prazo. Use o formato `YYYY-MM-DD`. A visão semanal mostra as tarefas que tenham uma dessas datas na semana exibida. Cada tarefa aparece em suas diferentes datas; marcadores para o mesmo dia são reunidos em uma única entrada. A última tarefa do exemplo, portanto, aparece apenas uma vez em 20 de outubro. Tarefas sem data continuam contando no progresso da nota.

Na visão semanal, use a lista de prazos para escolher outro dia da mesma semana. No computador, também é possível arrastar uma tarefa com prazo para um dia. Essas ações alteram a data de prazo já existente na nota original.

### Notas de década e de século

A visão de século coloca cada década ao lado de duas fileiras de cinco anos. Em telas estreitas, a década aparece acima dos anos. Em painéis muito estreitos ou com texto grande, os anos são exibidos em duas colunas. Os anos fora do século deixam espaços vazios. Ao entrar, a década do ano selecionado aparece. “Este século” volta à década atual, e a navegação continua visível ao rolar.

Ative esses tipos de nota nas configurações e escolha Século na barra lateral. Década e século têm células próprias. Um clique apenas seleciona; clique duplo ou Enter abre ou cria a nota. Ctrl/Cmd+clique ou botão do meio abre uma nova aba, e toque prolongado funciona no celular. As células usam indicadores, progresso de tarefas e prévias iguais aos da visão anual. Os caminhos padrão são `[diary]/DEC[s]` (2020s) para décadas e `[diary]/[C]CEN` (C21) para séculos.

Uma década vai de 2020 a 2029, por exemplo, e o século XXI vai de 2001 a 2100. `DEC` e `CEN` usam algarismos fixos, sem depender do idioma. Prefira pastas por século OU década: os anos 2000 cruzam C20/C21, mas a nota da década pertence a C20 por começar em 2000. Notas existentes não são movidas.

Modelos aceitam `{{date:DEC[s]}}`, `{{date:[C]CEN}}` e `{{start:YYYY}}–{{end:YYYY}}`. Todos os modelos periódicos oferecem datas inicial e final e `{{days}}`, que inclui as duas extremidades. Cada página de configurações mostra marcadores, exemplos e equivalentes do Templater. Geral → Configuração dos modelos explica a sintaxe compartilhada.

### Notas de intervalo

Primeiro, escolha uma pasta de destino em **Configurações → Chrono Notes → Notas de intervalo**. No computador, arraste de uma data inicial até outra data final no calendário mensal para criar a nota. Você também pode escolher a ação de criação no menu de uma data ou na paleta de comandos e preencher as datas. A criação exige pelo menos dois dias do calendário. Se as datas estiverem invertidas, elas serão colocadas na ordem correta.

Para mostrar uma nota existente como um intervalo, adicione estas propriedades no início do arquivo Markdown:

```yaml
---
chrono-notes: interval
start: 2026-10-18
end: 2026-10-20
---
```

Use datas completas no formato `YYYY-MM-DD`, com o início anterior ou igual ao fim. O intervalo exibido inclui os dois dias. Notas existentes também podem usar datas e horas ISO completas, com pelo menos horas e minutos, ou descrever um intervalo dentro do mesmo dia.

Uma nota de intervalo precisa das propriedades `start` e `end` com datas válidas. O Chrono Notes também grava `chrono-notes: interval` nas novas notas de intervalo, permitindo reconhecê-las em todo o Vault.

Quando `chrono-notes` não existe, a nota só é reconhecida no escopo configurado para notas de intervalo sem marcador. Se a propriedade tiver outro valor que não `interval`, a nota é excluída. Notas existentes não são alteradas automaticamente.

## Configurações

Escolha idioma, início da semana, formatos de data, caminhos e modelos. Alterar o idioma dos nomes de arquivos não renomeia notas existentes: confira a prévia do caminho. Há configurações separadas para aparência, tarefas, estatísticas e notas de intervalo.

## Limitações

- As fontes ICS são locais e somente para leitura; assinaturas remotas não são baixadas. Por padrão, são lidas até 32 fontes por atualização, e as fontes que excederem esse limite são informadas como omitidas. Eventos recorrentes com `RRULE` ou `RDATE` são ignorados e contados.
- Os fusos horários incluídos no arquivo aceitam datas explícitas de mudança de horário e um conjunto limitado de regras anuais (`FREQ=YEARLY`). Se uma definição for inválida, incompatível ou complexa demais, os eventos que dependem dela serão ignorados e informados. Veja as regras e os limites na [documentação de datas e fusos horários](../calendar-boundaries.en.md), em inglês.
- Feriados ainda não publicados oficialmente não são previstos. Calendários alternativos mudam apenas a exibição: nomes de notas, navegação e datas das tarefas continuam usando o calendário gregoriano. Extensões indisponíveis no ambiente são ocultadas.

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

# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

Chrono Notes añade a Obsidian un calendario para notas periódicas, tareas, festivos regionales, eventos locales y notas de intervalos de fechas.

Esta es una **guía breve** para tareas habituales. Los ajustes y límites detallados están en las guías completas en [inglés](../../README.md) y [chino simplificado](README.zh-CN.md).

## Funciones

Así se ve el calendario en escritorio y Android:

![Calendario de Chrono Notes en escritorio](../assets/chrono-notes-desktop-en.png)

![Calendario de Chrono Notes en Android](../assets/chrono-notes-android-en.png)

- Vistas de semana, mes, año y siglo con indicadores de notas, tareas, estadísticas y vistas previas.
- Notas diarias, semanales, mensuales, trimestrales, anuales, de década y de siglo, con plantillas integradas o Templater.
- Navegación entre notas, progreso de tareas, mapas de calor y notas para un intervalo de fechas.
- Calendarios lunar chino, Ganzhi, persa, etíope, hebreo, indio e islámico; festivos de China continental y Singapur.
- Archivos ICS locales de solo lectura y formatos de fecha personalizables sin alterar los valores YAML.

## Requisitos y compatibilidad

Requiere Obsidian 1.12.7 o posterior en escritorio o móvil. Los archivos ICS guardados en el Vault funcionan en ambas plataformas; las rutas externas al Vault solo funcionan en escritorio. Algunos calendarios dependen de los datos del entorno.

## Instalación

### Plugins de la comunidad

Abre **Ajustes → Plugins de la comunidad → Explorar**, busca **Chrono Notes**, pulsa **Instalar** y después **Activar**.

### Manual

Descarga `chrono-notes-<version>.zip` de la [última versión](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest) y extráelo en `Vault/.obsidian/plugins/`. La carpeta `chrono-notes/` contiene `main.js`, `manifest.json` y `styles.css`. Reinicia Obsidian y activa el plugin.

### Actualizar

Conserva una copia de `data.json` y reemplaza solo los archivos del plugin. Borra `data.json` únicamente si quieres restablecer la configuración.

## Uso

El calendario principal, los selectores de mes y los diálogos de fecha siempre usan el calendario gregoriano. Cambiar el idioma traduce los meses y los dígitos, pero no cambia el calendario. Las extensiones permiten añadir información de otros calendarios por separado.

**Antes de añadir ICS:** Chrono Notes lee archivos locales, pero no descarga suscripciones remotas ni desarrolla los eventos repetidos con `RRULE` o `RDATE`. Cuenta los eventos omitidos; por eso un calendario basado en recurrencias puede parecer incompleto. Las rutas fuera del Vault solo funcionan en escritorio.

Configura los tipos de notas, sus rutas y plantillas, y abre el calendario desde la barra lateral o la paleta de comandos. **Un clic selecciona la fecha, pero no crea ninguna nota.** Haz doble clic o pulsa Intro para abrir o crear la nota. El clic derecho abre el menú de la fecha; si hay eventos ICS, puedes consultar la lista completa desde ese menú. Ctrl/Cmd-clic o clic central abre la nota en una pestaña nueva. Activa los calendarios, festivos y archivos ICS según los necesites.

En una pantalla táctil, mantén pulsada una fecha para abrir su menú y elige la acción para abrir o crear la nota diaria. Si no aparece ningún menú, la nota se abre o se crea al levantar el dedo. Mantener pulsada una entrada de semana, mes u otro periodo abre directamente su nota.

### Tareas en el calendario

Añade una tarea con casilla a una nota e incluye un marcador de fecha:

```markdown
- [ ] Enviar el informe semanal 📅 2026-10-20
- [ ] Preparar los documentos 🛫 2026-10-18 ⏳ 2026-10-19 📅 2026-10-20
- [ ] Revisar el informe ⏳ 2026-10-20 📅 2026-10-20
```

`🛫` indica la fecha de inicio, `⏳` la fecha programada y `📅` la fecha de vencimiento. Usa el formato `YYYY-MM-DD`. La vista semanal muestra las tareas con alguna de estas fechas dentro de la semana visible. Cada tarea aparece en sus distintas fechas; varios marcadores para el mismo día se agrupan en una sola entrada. Por ejemplo, la última tarea aparece una sola vez el 20 de octubre. Las tareas sin fecha siguen contando para el progreso de su nota.

Usa el desplegable de vencimiento en la vista semanal para cambiar la fecha a otro día de esa semana. En el ordenador también puedes arrastrar una tarea con vencimiento hasta un día. Estas acciones modifican la fecha de vencimiento que ya existe en la nota original.

### Notas de década y de siglo

La vista de siglo muestra cada década junto a dos filas de cinco años. En pantallas estrechas, la década se coloca encima. En paneles muy estrechos o con texto grande, los años se muestran en dos columnas. Los años que no pertenezcan a ese siglo dejan una casilla vacía. Al entrar se muestra la década del año seleccionado. «Este siglo» vuelve a la década actual y la navegación se mantiene visible al desplazarte.

Activa las notas de década y siglo en la configuración y selecciona Siglo en la barra lateral. Tanto la década como el siglo tienen su propia casilla. Un clic solo selecciona; el doble clic o Intro abre o crea la nota. Ctrl/Cmd-clic o clic central abre una pestaña nueva y puedes mantener pulsado en pantallas táctiles. Los indicadores, progreso de tareas y vistas previas funcionan como en la vista anual. Las rutas predeterminadas son `[diary]/DEC[s]` (2020s) para décadas y `[diary]/[C]CEN` (C21) para siglos.

Una década abarca, por ejemplo, 2020–2029; el siglo XXI comprende 2001–2100. `DEC` y `CEN` generan cifras fijas, independientes del idioma. Conviene organizar las carpetas por siglo O por década: los años 2000 cruzan C20/C21, pero la nota de década pertenece a C20 por su año inicial, 2000. Las notas existentes no se mueven.

Las plantillas admiten los formatos `{{date:DEC[s]}}`, `{{date:[C]CEN}}` y `{{start:YYYY}}–{{end:YYYY}}`. Todas las plantillas periódicas ofrecen las fechas inicial y final y `{{days}}`, que incluye ambos extremos. Las páginas de ajustes muestran marcadores, ejemplos y equivalentes de Templater; General → Configuración de plantillas explica la sintaxis compartida.

### Notas de intervalo

Primero elige una carpeta de destino en **Ajustes → Chrono Notes → Notas de intervalo**. En el ordenador, arrastra desde una fecha de inicio hasta otra fecha de fin en el calendario mensual para crear una nota de intervalo. También puedes elegir la acción de creación en el menú de una fecha o en la paleta de comandos y escribir las fechas. Para crear una nota se necesitan al menos dos días del calendario. Si las fechas están invertidas, se ordenan automáticamente.

Para que una nota existente aparezca como un intervalo, añade estas propiedades al principio de su archivo Markdown:

```yaml
---
chrono-notes: interval
start: 2026-10-18
end: 2026-10-20
---
```

Usa fechas completas en formato `YYYY-MM-DD`, con el inicio anterior o igual al final. El intervalo mostrado incluye ambos días. Las notas existentes también admiten fechas y horas ISO completas, con al menos horas y minutos, o intervalos dentro de un mismo día.

Una nota de intervalo necesita las propiedades `start` y `end` con fechas válidas. Al crearla, Chrono Notes añade `chrono-notes: interval`, por lo que se reconocerá en todo el Vault.

Si falta la propiedad `chrono-notes`, la nota solo se reconoce dentro del ámbito configurado para notas de intervalo sin marcar. Si el valor es distinto de `interval`, no se reconoce. Las notas existentes no se modifican automáticamente.

## Configuración

En General encontrarás la guía de uso y la opción de informar de un problema. Al cambiar una extensión de calendario o festivos, la pestaña actual sigue visible y el foco del teclado permanece en el control utilizado.

Elige idioma, inicio de semana, formato de fecha, rutas y plantillas. Cambiar el idioma usado en las rutas no cambia los nombres de los archivos existentes: comprueba primero la vista previa. Hay ajustes específicos para apariencia, tareas, estadísticas y notas de intervalo.

## Limitaciones

- Los archivos ICS son locales y de solo lectura; no se descargan suscripciones remotas. De forma predeterminada, se leen como máximo 32 fuentes por actualización y se informa de las fuentes omitidas por superar ese límite. Los eventos recurrentes con `RRULE` o `RDATE` se omiten y contabilizan.
- Las zonas horarias incluidas en el archivo admiten fechas de cambio de hora explícitas y un conjunto limitado de reglas anuales (`FREQ=YEARLY`). Si una definición es inválida, no está admitida o es demasiado compleja, se omiten los eventos que dependen de ella y se informa de ello. Consulta las reglas y los límites en la [documentación sobre fechas y zonas horarias](../calendar-boundaries.en.md), en inglés.
- No se predicen festivos que aún no se hayan publicado oficialmente. Los calendarios alternativos solo cambian la visualización: los nombres de notas, la navegación y las fechas de tareas siguen usando el calendario gregoriano. Las extensiones que el entorno no admita se ocultan.

## Privacidad y seguridad

El plugin lee las notas Markdown necesarias y los archivos ICS que elijas para crear índices y mostrar eventos. No envía tus archivos ni requiere una cuenta. El índice derivado se guarda localmente en IndexedDB y puede reconstruirse. Nunca lee el portapapeles; solo escribe una fecha cuando eliges «Copiar fecha».

## Desarrollo

Usa Node.js 24.19.0 y npm 11.17.0. Ejecuta `npm ci` y `npm run check`. Consulta la [arquitectura](../architecture.en.md) y la [estrategia de pruebas](../testing-strategy.en.md).

## Ayuda

Para dudas e ideas, usa [Discussions](https://github.com/ZHYX91/obsidian-chrono-notes/discussions). Comunica fallos reproducibles mediante [Issues](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose) y problemas de seguridad [en privado](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new). No publiques información personal del Vault.

## Licencia

[MIT](../../LICENSE) © ZhengYX

## Agradecimientos

Inspirado en [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) y [Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar).

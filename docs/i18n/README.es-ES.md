# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português](README.pt-BR.md) · [Русский](README.ru-RU.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

Chrono Notes añade a Obsidian un calendario para notas periódicas, tareas, festivos regionales, eventos locales y notas de intervalos de fechas.

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

 abre **Ajustes → Plugins de la comunidad → Explorar**, busca **Chrono Notes**, pulsa **Instalar** y después **Activar**.

### Manual

 descarga `chrono-notes-<version>.zip` de la [última versión](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest) y extráelo en `Vault/.obsidian/plugins/`. La carpeta `chrono-notes/` contiene `main.js`, `manifest.json` y `styles.css`. Reinicia Obsidian y activa el plugin.

### Actualizar

 conserva una copia de `data.json` y reemplaza solo los archivos del plugin. Borra `data.json` únicamente si quieres restablecer la configuración.

## Uso

Configura los tipos de notas, sus rutas y plantillas, y abre el calendario desde la barra lateral o la paleta de comandos. **Un clic selecciona la fecha, pero no crea ninguna nota.** Haz doble clic o pulsa Intro para abrir o crear la nota; en pantallas táctiles, mantén pulsado. El clic derecho abre las acciones de fecha. Ctrl/Cmd-clic o clic central abre una pestaña nueva. Activa los calendarios, festivos y archivos ICS según los necesites.

### Notas de década y de siglo

La vista de siglo muestra cada década junto a dos filas de cinco años. En pantallas estrechas, la década se coloca encima; los años que no pertenezcan a ese siglo dejan una casilla vacía. Al entrar se muestra la década del año seleccionado. « Este siglo » vuelve a la década actual y la navegación se mantiene visible al desplazarte.

Activa las notas de década y siglo en la configuración y selecciona Siglo en la barra lateral. Tanto la década como el siglo tienen su propia casilla. Un clic solo selecciona; el doble clic o Intro abre o crea la nota. Ctrl/Cmd-clic o clic central abre una pestaña nueva y puedes mantener pulsado en pantallas táctiles. Los indicadores, progreso de tareas y vistas previas funcionan como en la vista anual. Las rutas predeterminadas son `[diary]/DEC[s]` (2020s) para décadas y `[diary]/[C]CEN` (C21) para siglos.

Una década abarca, por ejemplo, 2020–2029; el siglo XXI comprende 2001–2100. `DEC` y `CEN` generan cifras fijas, independientes del idioma. Conviene organizar las carpetas por siglo O por década: los años 2000 cruzan C20/C21, pero la nota de década pertenece a C20 por su año inicial, 2000. Las notas existentes no se mueven.

Las plantillas admiten los formatos `{{date:DEC[s]}}`, `{{date:[C]CEN}}` y `{{start:YYYY}}–{{end:YYYY}}`. Todas las plantillas periódicas ofrecen las fechas inicial y final y `{{days}}`, que incluye ambos extremos. Las páginas de ajustes muestran marcadores, ejemplos y equivalentes de Templater; General → Configuración de plantillas explica la sintaxis compartida.

### Reconocimiento de notas de intervalo

Una nota de intervalo necesita las propiedades `start` y `end` con fechas válidas. Al crearla, Chrono Notes añade `chrono-notes: interval`, por lo que se reconocerá en todo el Vault.

Si falta la propiedad `chrono-notes`, la nota solo se reconoce dentro del ámbito configurado para notas de intervalo sin marcar. Si el valor es distinto de `interval`, no se reconoce. Las notas existentes no se modifican automáticamente.

## Configuración

Elige idioma, inicio de semana, formato de fecha, rutas y plantillas. Cambiar el idioma usado en las rutas no cambia los nombres de los archivos existentes: comprueba primero la vista previa. Hay ajustes específicos para apariencia, tareas, estadísticas y notas de intervalo.

## Limitaciones

Los archivos ICS son locales y de solo lectura; no se descargan suscripciones remotas. Se leen como máximo 32 fuentes por actualización de forma predeterminada. Los eventos recurrentes `RRULE`/`RDATE` se omiten y contabilizan, sin expandirse. No se predicen festivos que aún no sean oficiales. Los calendarios alternativos dependen del entorno.

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

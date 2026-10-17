# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português](README.pt-BR.md) · [Русский](README.ru-RU.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

Chrono Notes transforme Obsidian en espace de travail calendaire pour les notes périodiques, les tâches, les jours fériés et les notes couvrant une période.

## Fonctionnalités

- Vues par semaine, mois, année et siècle avec état des notes, tâches, statistiques et aperçus.
- Notes quotidiennes, hebdomadaires, mensuelles, trimestrielles, annuelles, décennales et séculaires, avec modèles intégrés ou Templater.
- Navigation entre les notes, suivi des tâches, cartes thermiques et notes créées sur une plage de dates.
- Calendriers chinois, persan, éthiopien, hébraïque, indien et islamiques, ainsi que les jours fériés de Chine et de Singapour.
- Fichiers ICS locaux en lecture seule et formats d'affichage des propriétés Date et Date et heure sans modifier le YAML.

## Prérequis et compatibilité

Obsidian 1.12.7 ou plus récent, sur ordinateur ou mobile. Les fichiers ICS du coffre sont utilisables partout ; les chemins extérieurs au coffre sont réservés aux ordinateurs. Les autres calendriers dépendent des données disponibles dans l'environnement d'Obsidian.

## Installation

**Extensions communautaires :** dans Obsidian, ouvrez **Paramètres → Modules complémentaires → Parcourir**, cherchez **Chrono Notes**, puis choisissez **Installer** et **Activer**.

**Installation manuelle :** téléchargez `chrono-notes-<version>.zip` depuis la [dernière version](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest), puis extrayez-le dans `Vault/.obsidian/plugins/`. Le dossier `chrono-notes/` contient `main.js`, `manifest.json` et `styles.css`. Redémarrez Obsidian et activez le module.

**Mise à jour :** conservez et sauvegardez `data.json` ; remplacez uniquement les fichiers du module. Ne supprimez le fichier de réglages que pour une réinitialisation volontaire.

## Utilisation

Choisissez les types de notes et leurs chemins dans les paramètres de Chrono Notes, puis ouvrez le calendrier depuis le ruban ou la palette de commandes. **Un clic sélectionne une date sans créer de note.** Double-cliquez ou appuyez sur Entrée pour ouvrir ou créer la note ; effectuez un appui long sur écran tactile. Un clic droit ouvre les actions sur la date. Ctrl/Cmd-clic ou clic central ouvre un nouvel onglet. Activez au besoin les sources ICS et les calendriers supplémentaires.

## Paramètres

Réglez la langue, le premier jour de la semaine, les formats de date, les modèles et les chemins des notes. Un changement de langue pour les noms de fichiers ne renomme pas les notes existantes : vérifiez l'aperçu du chemin. Les vues, tâches, statistiques et notes de période disposent de réglages dédiés.

## Limites

Les sources ICS sont locales et en lecture seule ; aucun abonnement distant n'est téléchargé. Par défaut, 32 sources au maximum sont lues à chaque actualisation. Les récurrences `RRULE` et `RDATE` sont signalées sans être développées. Les jours fériés non encore publiés ne sont pas devinés. Certains calendriers dépendent du système d'exécution.

## Confidentialité et sécurité

Le module lit les notes Markdown pertinentes et les fichiers ICS locaux sélectionnés pour afficher les informations. Il n'envoie ni notes, ni tâches, ni événements et ne nécessite pas de compte. L'index dérivé reste dans IndexedDB sur l'appareil et peut être reconstruit. Le presse-papiers n'est jamais lu ; la date n'y est écrite qu'après l'action « Copier la date ».

## Développement

Utilisez Node.js 24.19.0 et npm 11.17.0, puis exécutez `npm ci` et `npm run check`. Consultez l'[architecture](../architecture.en.md) et la [stratégie de test](../testing-strategy.en.md).

## Assistance

Posez vos questions dans les [discussions](https://github.com/ZHYX91/obsidian-chrono-notes/discussions). Signalez les problèmes reproductibles dans les [issues](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose) et les failles de sécurité [en privé](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new). Ne publiez jamais de contenu personnel du coffre.

## Licence

[MIT](../../LICENSE) © ZhengYX

## Remerciements

Inspiré de [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) et [Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar).

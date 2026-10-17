# Chrono Notes

__NAV__

Chrono Notes は Obsidian に、定期ノート、タスク、祝日、ローカル予定、期間ノートをまとめて扱うカレンダーを追加するプラグインです。

## 主な機能

- 週・月・年・世紀の表示で、ノートの有無、タスク、統計、プレビューを確認できます。
- 日・週・月・四半期・年・十年・世紀単位のノートを、内蔵テンプレートまたは Templater で作成できます。
- ノート間ナビゲーション、タスク進捗、ヒートマップ、日付範囲を指定した期間ノートに対応しています。
- 中国旧暦・干支、ペルシャ暦、エチオピア暦、ヘブライ暦、インド暦、イスラム暦、中国本土・シンガポールの祝日表示に対応しています。
- ローカル ICS ファイルは読み取り専用です。Obsidian の日付プロパティは YAML を変更せず表示形式だけを調整できます。

## 動作環境と互換性

デスクトップ版・モバイル版の Obsidian 1.12.7 以降が必要です。Vault 内の ICS ファイルは対応端末で利用できますが、Vault 外のパスを直接指定できるのはデスクトップ版のみです。追加の暦は Obsidian の実行環境に依存します。

## インストール

**コミュニティプラグイン：** Obsidian の **設定 → コミュニティプラグイン → 閲覧** から **Chrono Notes** を検索し、**インストール**して**有効化**します。

**手動：** [最新リリース](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest)から `chrono-notes-<version>.zip` を入手し、`Vault/.obsidian/plugins/` に展開します。`chrono-notes/` フォルダーに `main.js`、`manifest.json`、`styles.css` があることを確認し、Obsidian を再読み込みして有効化します。

**更新：** 既存の `data.json` はバックアップして保持してください。設定を初期化したい場合を除き、削除しないでください。

## 使い方

設定で使用するノートの種類、保存先、テンプレートを選び、リボンまたはコマンドパレットからカレンダーを開きます。**日付を1回クリックしても選択されるだけで、ノートは作成されません。** ダブルクリックか Enter で開く・作成する操作が実行されます。タッチ操作では長押し、右クリックでは日付メニューを開きます。Ctrl/Cmd＋クリックか中クリックで新しいタブに開けます。

## 設定

言語、週の開始曜日、日付の表示形式、ノートのパスとテンプレートを設定できます。ファイル名に使う言語を変更しても既存ファイルは自動的に改名されないため、パスのプレビューを確認してください。表示、タスク、統計、期間ノート、拡張機能にも設定があります。

## 制限事項

ICS はローカルの読み取り専用ファイルで、リモート購読の直接取得には対応していません。1回の更新で読む ICS ソースは既定で最大32件です。`RRULE` / `RDATE` の繰り返し予定は展開せず件数を報告します。未発表の祝日は予測しません。追加の暦は実行環境で利用可能な場合のみ表示します。

## プライバシーとセキュリティ

カレンダー表示と索引のため、必要な Markdown ノートと指定されたローカル ICS を読み込みます。ノートや予定を外部に送信することはなく、アカウントも不要です。派生した索引は端末内の IndexedDB に保存され、再構築できます。クリップボードは読み取らず、「日付をコピー」を選んだ場合に限り日付を書き込みます。

## 開発

Node.js 24.19.0 と npm 11.17.0 を使用し、`npm ci` と `npm run check` を実行してください。詳細は[アーキテクチャ](../architecture.en.md)と[テスト方針](../testing-strategy.en.md)にあります。

## サポート

質問やアイデアは [Discussions](https://github.com/ZHYX91/obsidian-chrono-notes/discussions)、再現できる不具合は [Issues](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose) へ。セキュリティ問題は[非公開で報告](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new)してください。個人情報や Vault の内容を公開しないでください。

## ライセンス

[MIT](../../LICENSE) © ZhengYX

## 謝辞

[Calendar](https://github.com/liamcain/obsidian-calendar-plugin) と [Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar) から着想を得ています。

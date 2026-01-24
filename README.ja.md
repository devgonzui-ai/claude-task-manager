# Claude Task Manager

[![npm version](https://badge.fury.io/js/@gonzui%2Fclaude-task-manager.svg)](https://badge.fury.io/js/@gonzui%2Fclaude-task-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

English version: After installation, see `node_modules/@gonzui/claude-task-manager/README.md`

Claude Code 用のタスク管理拡張パッケージ（TypeScript 製）。タスクの作成、実行、履歴管理を自動化します。

## 特徴

- 📋 **タスク管理**: `task.md`ファイルでタスクを管理
- 🗄️ **自動アーカイブ**: 古いタスクは自動的に`archive/`フォルダに保存
- 🤖 **Claude Code 統合**: タスクを直接 Claude Code で実行
- 📊 **履歴管理**: 過去のタスクと実行履歴を追跡
- ⚙️ **カスタマイズ可能**: テンプレートと設定をカスタマイズ
- 🔷 **TypeScript**: 完全な型安全性と IntelliSense 対応
- 🛡️ **エラーハンドリング**: カスタムエラータイプによる詳細なエラー情報
- 🏷️ **タグとプライオリティ**: タスクの分類と優先度管理
- 📈 **進捗トラッキング**: サブタスク完了状況のビジュアル表示
- 🤖 **AI タスク分割**: Claude を使ってタスクを自動的にサブタスクに分解
- 🔗 **フック連携**: Claude Code フックによるタスク自動化

## インストール

```bash
npm install -g @gonzui/claude-task-manager
```

または、プロジェクト内で使用:

```bash
npm install @gonzui/claude-task-manager
npx claude-task init
```

## 開発者向け

TypeScript プロジェクトでプログラム的に使用:

```typescript
import { TaskManager, TaskOptions } from "@gonzui/claude-task-manager";

const taskManager = new TaskManager("./my-project");
await taskManager.init();

const options: TaskOptions = {
  title: "API実装",
  description: "REST APIエンドポイントの実装",
  priority: "high",
  tags: ["backend", "api"],
};

await taskManager.createNewTask(options);
```

## 使用方法

### 初期化

```bash
claude-task init
```

プロジェクトディレクトリにタスク管理を初期化します。以下のファイル/フォルダが作成されます:

- `task.md` - 現在のタスクファイル
- `archive/` - 過去のタスクのアーカイブ
- `.claude-tasks/` - 設定ファイル
- `.claude/commands/task.md` - Claude Codeカスタムコマンド（`.claude/commands/`が存在する場合）
- `.gitignore`の更新 - タスク関連ファイルを除外

**Git風のディレクトリ動作**: 
- コマンドを実行すると、Claude Task ManagerはGitが`.git`を探すように、上位ディレクトリの`.claude-tasks`ディレクトリを検索します
- 見つかった場合、現在のディレクトリに関係なく、すべての操作はそのプロジェクトルートを使用します
- 例: `/project`で`init`した後、`cd src/components && claude-task new`を実行しても、タスクは`/project/`に作成され、`/project/src/components/`には作成されません
- これにより、プロジェクト全体で統一されたタスク管理が保証されます
- サブディレクトリに別のタスク管理を作成する場合は、明示的にディレクトリを指定してください: `claude-task init .`

### 新しいタスクの作成

```bash
# 基本的な作成
claude-task new

# タイトル、説明、プライオリティ、タグを指定
claude-task new -t "ウェブサイトの改善" -d "パフォーマンス最適化とUIの改善" -p high --tags "frontend,optimization"
```

現在の`task.md`は自動的にアーカイブされ、新しいタスクファイルが作成されます。

### タスクの実行

```bash
# 現在のタスクをClaude Codeで実行
claude-task run

# 詳細出力付き
claude-task run -v

# デバッグ情報付き（コマンド、ファイルパス、プロンプトを表示）
claude-task run -d

# ファイル編集権限なしで実行（読み取り専用モード）
claude-task run --no-edit-permission
```

**注意**: デフォルトでは、Claudeはファイル編集権限付きで実行されます（`--dangerously-skip-permissions`フラグ使用）。これにより、タスクを完全に実行できます。読み取り専用モードで実行したい場合は`--no-edit-permission`を使用してください。

### 履歴の確認

```bash
# 過去10件の履歴を表示
claude-task history

# 表示件数を指定、ファイルサイズも表示
claude-task history -l 20 --size
```

### ステータス確認

```bash
claude-task status
```

現在のタスク、アーカイブ数、実行回数、最後の実行時間を表示します。

### 現在のタスクをアーカイブ

```bash
claude-task archive
```

現在のタスクをアーカイブフォルダにタイムスタンプ付きで移動します。

### 進捗の確認

```bash
claude-task progress
```

サブタスクの完了状況をビジュアルなプログレスバーで表示します：
```
📊 Task Progress
================
Progress: [████████░░░░░░░░░░░░] 40%
Completed: 2/5 tasks
```

### タスクをサブタスクに分割

```bash
claude-task split
claude-task split --count 5
```

Claude AI を使って、現在のタスクを自動的にアクション可能なサブタスクに分解します。生成されたサブタスクは `task.md` ファイルに追加されます。

オプション:
- `--count`: 生成するサブタスクの数を指定（デフォルト: 3-7）

### フックの設定

```bash
claude-task hooks
claude-task hooks --status
```

タスク自動化のための Claude Code フックを設定します。セットアップ後、以下のフックが設定されます：
- `claude-task run` 後: 完了タイムスタンプをログ
- `claude-task new` 後: タスク進捗を表示
- `claude-task archive` 後: タスクステータスを表示

`--status` で現在のフック設定を確認できます。

### Claude Code の直接実行

```bash
claude-task claude "コードをリファクタリングしてください"
```

## Claude Code カスタムコマンド

`claude-task init`を実行すると、`.claude/commands/`ディレクトリがあるプロジェクトでは自動的にカスタム`/task`コマンドが作成されます。これにより、Claude Code内で以下のコマンドを直接使用できます：

### 利用可能なコマンド

- `/task new "タスク名" [--priority high|medium|low] [--tags tag1,tag2]` - 新しいタスクを作成
- `/task status` - 現在のタスクステータスを確認
- `/task run` - 現在のタスクを実行（task.mdの内容をClaude Codeが処理するために表示）
- `/task history [--limit n]` - タスク履歴を表示
- `/task archive` - 完了したタスクをアーカイブ

### Claude Code内での使用例

```
/task new "ユーザー認証機能の実装" --priority high --tags auth,backend
```

```
/task status
```

```
/task run
```

カスタムコマンドファイルは、プロジェクトの言語設定（英語または日本語）に応じて自動的に生成されます。

## ファイル構造

```
your-project/
├── task.md                    # 現在のタスク
├── archive/                   # アーカイブされたタスク
│   ├── 2025-07-23_14-30-45_task.md
│   ├── 2025-07-22_09-15-20_task.md
│   └── ...
└── .claude-tasks/
    └── config.json           # 設定ファイル
```

## タスクファイルの形式

```markdown
# タスクタイトル

**Created:** 2025-07-23 14:30:45  
**Priority:** high  
**Tags:** frontend, optimization

## Description

タスクの説明

## Tasks

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Context

<!-- Claude Code実行用のコンテキスト -->

## Notes

<!-- ノートをここに追加 -->

## Execution Log - 2025-07-23 14:35:22 (1234ms)

**Status:** ✅ Success

実行結果がここに記録されます...

---
```

## 開発とビルド

```bash
# 開発環境でのビルド
npm run build

# 開発モードでの実行
npm run dev -- init

# ウォッチモードでのビルド
npm run watch

# テストの実行
npm test
```

## TypeScript 型定義

パッケージには完全な型定義が含まれています:

```typescript
interface TaskOptions {
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  tags?: string[];
}

interface TaskStatus {
  currentTask: string | null;
  archivedCount: number;
  lastRun: string | null;
  totalExecutions: number;
  currentTaskSize?: number;
}
```

## 設定

`.claude-tasks/config.json`で設定をカスタマイズできます:

```json
{
  "created": "2025-01-15T10:00:00.000Z",
  "taskTemplate": "...",
  "claudeCommand": "claude",
  "defaultTaskTitle": "New Task",
  "archiveDir": "archive",
  "language": "ja",
  "defaultPrerequisites": [
    "<!-- 前提条件をここに追加 -->"
  ],
  "defaultRules": [
    "<!-- ルールをここに追加 -->"
  ],
  "defaultTasks": [
    "タスク 1",
    "タスク 2",
    "タスク 3"
  ]
}
```

### 言語設定

Claude Task Managerは複数の言語（英語・日本語）に対応しています：

```bash
# 現在の言語を確認
claude-task lang

# 日本語に変更
claude-task lang ja

# 英語に変更
claude-task lang en
```

言語設定は以下に影響します：
- CLIコマンドの出力
- タスクテンプレート
- カスタムコマンドテンプレート
- エラーメッセージ

### 配列設定

v1.0.6以降、`defaultPrerequisites`、`defaultRules`、`defaultTasks`は配列形式をサポートし、編集が容易になりました：

```json
{
  "defaultPrerequisites": [
    "<!-- 前提条件をここに追加 -->",
    "必要な環境",
    "必要な権限",
    "事前のセットアップ手順"
  ]
}
```

これは自動的に以下のように変換されます：
```markdown
## Prerequisites
<!-- 前提条件をここに追加 -->
- 必要な環境
- 必要な権限
- 事前のセットアップ手順
```

### 設定の例

```json
{
  "created": "2025-07-23T14:30:45.123Z",
  "taskTemplate": "# {{TITLE}}\n\n...",
  "claudeCommand": "claude code"
}
```

### 設定項目

- `taskTemplate`: 新しいタスクファイルのテンプレート
- `claudeCommand`: Claude Code の実行コマンド（デフォルト: "claude"）

**注意**: デフォルトでは、Claudeはファイル編集権限（`--dangerously-skip-permissions`フラグ）付きで実行され、タスクを完全に実行できます。読み取り専用モードでClaudeを実行したい場合は、`--no-edit-permission`を使用してください。

## テンプレート変数

タスクテンプレートで使用可能な変数:

- `{{TITLE}}` - タスクタイトル
- `{{DESCRIPTION}}` - タスクの説明
- `{{DATE}}` - ISO 形式の作成日時
- `{{TIMESTAMP}}` - 読みやすい形式の作成日時

## 要件

- Node.js 18.0.0 以上
- Claude Code CLI がインストールされていること

## トラブルシューティング

### Claude Code が見つからない

Claude Code CLI が正しくインストールされ、PATH に追加されていることを確認してください。

### 権限エラー

ファイルの読み書き権限を確認してください:

```bash
chmod +x node_modules/.bin/claude-task
```

## ライセンス

MIT

## 貢献

貢献を歓迎します！

## 更新履歴

### v1.1.0 (2025-01-24)
- 機能追加: サブタスク完了状況をビジュアル表示する`progress`コマンド
- 機能追加: Claude AIを使ってサブタスクを自動生成する`split`コマンド
- 機能追加: Claude Codeフック連携の`hooks`コマンド
- リファクタリング: TaskManager.tsを機能別モジュールに分割して保守性向上
- 改善: Node.js要件を >= 18.0.0 に更新
- 改善: TypeScriptの型安全性を向上
- 修正: splitコマンドのClaude CLIタイムアウト処理

### v1.0.8 (2025-08-04)
- 機能追加: 手動で現在のタスクをアーカイブする`archive`コマンドを追加
- 改善: カスタムコマンドファイルをClaude Codeとの互換性向上のため英語で生成するように変更
- 改善: カスタムコマンドの指示をBashツールを明示的に使用するように改善
- 改善: `/task run`コマンドを`@task.md`参照を使用するように簡略化
- 修正: `/task new`コマンドが実際のCLI実行を通じて適切に新しいタスクを作成するように修正

### v1.0.7 (2025-07-25)
- 修正: ドキュメントの日付を2024年から2025年に修正

### v1.0.6 (2025-07-25)
- 機能追加: タスクテンプレートに前提条件とルールセクションを追加
- 機能追加: config.jsonで配列形式をサポートして編集を容易に
- 機能追加: `--dangerously-skip-permissions`フラグをデフォルトで有効化してファイル編集を許可
- 機能追加: `--no-edit-permission`オプションでファイル編集を無効化可能
- 改善: 環境変数からの言語検出機能
- 改善: アーカイブファイル名にミリ秒を追加
- 修正: 両言語でのテンプレート変数置換
- 修正: デフォルトタスクアイテムからチェックボックスを削除

### v1.0.5 (2025-07-24)
- 機能: `claude-task run`コマンドがタスクを正しく実行するように修正
- 機能: `--debug`フラグを追加（詳細な実行情報を表示）
- 機能: Claudeへのプロンプトで絶対パスから相対パスに変更
- 修正: デフォルトのclaudeコマンドを'claude code'から'claude'に更新
- 改善: 非インタラクティブ実行のために`--print`フラグを使用

### v1.0.2 (2025-07-23)
- 修正: package.jsonから動的にバージョンを読み込むように変更（正確なバージョン表示）

### v1.0.1 (2025-07-23)
- 修正: init時に.claudeディレクトリが存在する場合、.claude/commandsディレクトリを作成するように修正
- 改善: Claude Codeカスタムコマンドの生成処理

### v1.0.0 (2025-07-23)
- 初期リリース
- タスク管理機能（アーカイブと履歴付き）
- 多言語対応（英語/日本語）
- Git風のディレクトリ動作（プロジェクトルートの自動検出）
- Claude Code統合（カスタムコマンド対応）
- .gitignoreの自動更新機能

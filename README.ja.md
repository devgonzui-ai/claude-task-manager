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
- 🔌 **MCP サーバー**: `.mcp.json`経由でタスク管理をスキーマ付きMCPツールとして Claude Code に公開

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

### サブタスクを完了にする

```bash
claude-task done 1 3      # サブタスク 1 と 3 を完了にする
claude-task done --undo 1 # サブタスク 1 を未完了に戻す
```

サブタスクを番号指定で完了（`--undo` で未完了）にします。番号は
`claude-task progress` で表示される順番と一致し、実行後に更新後のプログレスバーが
表示されます。

### タスクをサブタスクに分割

```bash
claude-task split
claude-task split --count 5
```

Claude AI を使って、現在のタスクを自動的にアクション可能なサブタスクに分解します。生成されたサブタスクは `task.md` ファイルに追加されます。

オプション:
- `--count`: 生成するサブタスクの数を指定（デフォルト: 3-7）

### Claude Code の直接実行（非推奨）

```bash
claude-task claude "コードをリファクタリングしてください"
```

> **非推奨:** `claude` はタスク内容を表示するだけです。現在のタスクを実際に
> Claude Code で実行するには `claude-task run` を使ってください。

## Claude Code 統合（カスタムコマンド & スキル & MCPサーバー）

`claude-task init`を実行すると、`.claude/`ディレクトリがあるプロジェクトでは
以下の3つが自動生成されます：

- `.claude/commands/task.md` の `/task` **スラッシュコマンド**
- `.claude/skills/task/SKILL.md` の **スキル**（新しい Claude Code が
  タスク管理を自動的に発見できるようにするため）
- `.mcp.json` への **MCPサーバー** 登録（後述の「MCPサーバー」セクションを参照）

`/task` コマンドにより、Claude Code内で以下のコマンドを直接使用できます：

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

### MCPサーバー

パッケージには `claude-task-mcp` バイナリが同梱されています。これは stdio 型の
[MCP](https://modelcontextprotocol.io) サーバーで、Claude Code が CLI コマンドを
組み立てる代わりに、型付き・スキーマ検証済みのツールでタスクを管理できます：

| ツール | 説明 |
| --- | --- |
| `task_new` | 新しいタスクを作成（現在のタスクは先にアーカイブ） |
| `task_status` | 現在のタスクと実行統計を表示 |
| `task_progress` | サブタスクのチェックボックス進捗を表示 |
| `task_done` | サブタスクを番号で完了にする（undo対応） |
| `task_split` | AIでタスクをサブタスクに分割 |
| `task_history` | アーカイブ済みタスクを一覧表示 |
| `task_archive` | 現在のタスクをアーカイブ |

`claude-task init` はプロジェクトの `.mcp.json` にサーバーを登録します
（コミットしてOK — プロジェクトスコープのサーバーは Claude Code が使用前に
承認を求めます）：

```json
{
  "mcpServers": {
    "claude-task": {
      "command": "claude-task-mcp",
      "args": []
    }
  }
}
```

`.mcp.json` に `claude-task` エントリが既に存在する場合、init はそれを
上書きしません。すべてのツールは CLI と同じ `TaskManager` を経由するため、
両方のフロントエンドで動作が一貫します。

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

すべてのリリース履歴は [CHANGELOG.md](https://github.com/devgonzui-ai/claude-task-manager/blob/main/CHANGELOG.md) を参照してください。

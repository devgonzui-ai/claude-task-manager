# Claude Task Manager

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
```

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
  "created": "2024-01-15T10:00:00.000Z",
  "taskTemplate": "...",
  "claudeCommand": "claude code",
  "defaultTaskTitle": "New Task",
  "archiveDir": "archive",
  "language": "ja"
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
- `claudeCommand`: Claude Code の実行コマンド（デフォルト: "claude code"）

## テンプレート変数

タスクテンプレートで使用可能な変数:

- `{{TITLE}}` - タスクタイトル
- `{{DESCRIPTION}}` - タスクの説明
- `{{DATE}}` - ISO 形式の作成日時
- `{{TIMESTAMP}}` - 読みやすい形式の作成日時

## 要件

- Node.js 16.0.0 以上
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

### v1.0.0

- 初期リリース
- 基本的なタスク管理機能
- Claude Code 統合
- 履歴管理とアーカイブ機能

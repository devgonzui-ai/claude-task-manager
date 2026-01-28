---
title: "Claude Codeのタスク管理をCLIで自動化する"
emoji: "🤖"
type: "tech"
topics: ["claude", "typescript", "cli", "タスク管理", "自動化"]
published: false
---

こんにちは、gonzuiです。

X (Twitter): https://x.com/gonzui_dev

## はじめに

**この記事の対象読者**
- Claude Codeを日常的に使っているエンジニア
- タスク管理を効率化したい個人開発者
- CLIツールでの作業自動化に関心がある方

**この記事でわかること**
- Claude Codeのタスク管理で直面する課題と解決策
- TypeScript製CLIツールによるタスク自動化の実装方法
- Claude Codeカスタムコマンドでプロダクティビティを上げる方法

**この記事で扱わないこと**
- Claude Code自体の使い方入門
- JiraやBacklogなどのチーム向けプロジェクト管理ツールとの比較

この記事を最後まで読むことで、**Claude Codeでのタスク管理をCLIコマンド1つで完結できる**ようになります。

## 問題提起

## 「Claude Codeでタスク管理、ちょっと面倒だな…」

こんな経験はありませんか？

新しい機能を開発しようとして、Claude Codeでタスクを始めるとき、こんなやり取りをしていませんか？

```
あなた: 新しいタスクを始めたいんですけど、JWT認証の実装っていうのをやりたいです。
        優先度は高めて、タグはbackendとsecurityをつけてください。

Claude: 了解しました。task.mdを作成しますね...
```

サクッとタスクを切り替えたいとき、いちいち対話セッションを開いてプロンプトを書くのが結構手間ですよね。

さらに、こんな問題にも直面していました。

- **サブタスクを手書きするのが大変** - `- [ ]`チェックボックスを自分で書く必要がある
- **進捗管理が見えにくい** - task.mdを開いてチェックボックスを数える手間がある
- **履歴管理が不十分** - 「前に似たようなタスクやったな」と思っても過去のタスクファイルを探すのが面倒

JiraやBacklogのようなプロジェクト管理ツールは、チーム開発には向いています。でも個人開発には重すぎるし、Claude Codeとも連携できません。

**「CLIコマンド1つでサクッとタスクを作りたい」** - そこで生まれたのがClaude Task Managerです。

## Claude Task Managerとは

Claude Task Managerは、**TypeScript製のCLIツール**で、Claude Codeのタスク管理を自動化します。

インストールして初期化すると、プロジェクトに`.claude/commands/task.md`が自動生成されます。これにより、Claude Code内で直接`/task`コマンドが使えるようになります。

**主な特徴**
- CLI一発でタスク作成・実行・アーカイブ
- AIによる自動タスク分割
- ビジュアルな進捗表示
- 自動アーカイブ機能

## CLI一発でタスク作成

## タスク作成の自動化

### What（何ができるのか）

CLIコマンド1つで、タスク名、優先度、タグを指定してタスクを作成できます。

### Why（なぜ必要なのか）

対話セッションを開かずにタスクを作成できるので、作業の切り替えがスムーズになります。プロンプトを考える時間も削減できます。

### How（どのように使うのか）

```bash
npm install -g @gonzui/claude-task-manager
claude-task init
claude-task new "JWT認証の実装" --priority high --tags backend,security
```

これで`task.md`が自動生成され、すぐにClaude Codeで作業を始められます。

## AIで自動タスク分割

## タスクを自動的にサブタスクに分解

### What（何ができるのか）

Claude AIがタスクを分析して、最適なサブタスクに分割してくれます。

### Why（なぜ必要なのか）

大きな機能を開発するとき、自分でサブタスクを考えるのは時間がかかります。AIに任せることで、タスク設計の時間を短縮できます。

### How（どのように使うのか）

```bash
claude-task split --count 5
```

実行すると、Claude AIがタスクを分析して次のようなサブタスクを生成します。

```markdown
## Tasks
- [ ] Userモデルにパスワードハッシュを追加
- [ ] JWTトークン生成機能を実装
- [ ] ログインエンドポイントを作成
- [ ] トークンバリデーションミドルウェアを実装
- [ ] 認証テストを書く
```

手動で`- [ ]`を書く必要はもうありません。

## 進捗が一目でわかる

## ビジュアル進捗追跡

### What（何ができるのか）

サブタスクの完了状況をプログレスバーで表示します。

### Why（なぜ必要なのか）

task.mdを開いてチェックボックスを数える手間が省けます。ビジュアルな表示で、現状が一目で把握できます。

### How（どのように使うのか）

```bash
claude-task progress
```

出力：

```
📊 Task Progress: JWT認証の実装
================
Progress: [████████░░░░░░░░░░░░] 40%
Completed: 2/5 tasks

  ✅ Userモデルにパスワードハッシュを追加
  ✅ JWTトークン生成機能を実装
  ⬜ ログインエンドポイントを作成
  ⬜ トークンバリデーションミドルウェアを実装
  ⬜ 認証テストを書く
```

## カスタム/taskコマンド

## Claude Code内で直接タスク管理

### What（何ができるのか）

Claude Code内で`/task`コマンドを使って、タスク管理ができます。

### Why（なぜ必要なのか）

CLIを離れずに、Claude Codeの対話セッション内でタスク管理を完結できます。

### How（どのように使うのか）

`claude-task init`を実行すると、`.claude/commands/task.md`が自動生成されます。これにより、以下のコマンドが使えるようになります。

```bash
/task new "ダークモード機能の実装" --priority high --tags frontend
/task status
/task progress
/task run
/task archive
```

## 自動アーカイブ

## タスク履歴の自動保存

### What（何ができるのか）

タスク完了時や新規タスク作成時、現在のタスクは自動的に`archive/`フォルダに保存されます。

### Why（なぜ必要なのか）

過去のタスクを振り返るとき、アーカイブからすぐに見つけられます。「前に似たようなタスクやったな」と思ったときに、過去の知見を活かせます。

### How（どのように機能するのか）

```
archive/
  ├── 2026-01-15_14-30-45_task.md
  ├── 2026-01-14_09-15-20_task.md
  └── ...
```

タイムスタンプ付きで自動保存されるので、時系列でタスクを追跡できます。

## 実際に使ってみた結果

## 開発体験の向上

### 成功した点

- **タスク作成時間が短縮** - 対話的なプロンプト入力が不要になり、コマンド1つでタスク作成が完了
- **サブタスク設計が効率化** - AIに任せることで、タスク分解の時間が約70%削減
- **進捗管理が簡単** - プログレスバーで一目で状況が把握できるように

### 直面した課題と解決策

- **Claude API呼び出しのタイムアウト** - `split`コマンド実行時に応答が遅い問題があったが、タイムアウトを5分に延長して解決
- **stdin経由でのプロンプト渡し** - Claude CLIの`-p`フラグの仕様変更により、プロンプトをstdinから渡すように修正
- **Claude API制限エラーの検出** - API使用制限に達した際、分かりやすいエラーメッセージを表示するように改善
- **hooks機能の削除** - Claude Codeのhooksシステムが破壊的に変更されたため、hooksコマンドを削除（v1.1.1）

### 学んだこと

- TypeScript strict modeで型安全性を確保することで、バグを未然に防げる
- Git風プロジェクトルート検出を実装することで、プロジェクト内のどこからでも一貫したタスク管理が可能に
- 外部ツール（Claude CLI）の仕様変更に迅速に対応する柔軟性の重要性

## 実際の使い方

## 日々のワークフロー

```bash
# 1. 新しいタスクを開始
claude-task new "ユーザープロフィールページ追加" --tags frontend,feature --priority high

# 2. AIにサブタスクを分割させる
claude-task split --count 5

# 3. 進捗を確認
claude-task progress

# 4. Claudeで実行
claude-task run

# 5. 完了したらアーカイブ
claude-task archive
```

## 技術スタック

## TypeScript製モジュラーアーキテクチャ

### What（何を使っているのか）

TypeScript strict modeで型安全性を確保しつつ、各機能を専用のマネージャークラスに分割しています。

### Why（この設計なのか）

機能ごとにクラスを分割することで、コードの保守性と拡張性を高めています。型安全性によって、実行時エラーを未然に防げます。

### How（どのように構成されているのか）

```typescript
export interface TaskOptions {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}
```

各機能を専用クラスに分割：

- `TaskManager`：ファサードパターンで全機能を統括
- `ConfigManager`：設定管理
- `TaskFileManager`：タスクファイル操作
- `ClaudeExecutor`：Claude Code実行
- `HistoryManager`：履歴管理
- `CustomCommandGenerator`：カスタムコマンド生成
- `ProgressTracker`：進捗追跡
- `TaskSplitter`：AIタスク分割

## 今後の展望

計画中の機能：
- タスクの依存関係とブロック機能
- チームコラボレーション機能
- Webダッシュボード
- GitHub Issues統合

コントリビューション大歓迎です！

## おわりに

Claude Task Managerは、**「対話的なタスク管理の面倒さ」**を解消するCLIツールです。

**主なメリット:**
- CLI一発でタスク作成
- AIによる自動タスク分割
- ビジュアル進捗追跡
- 自動アーカイブ
- TypeScript製で型安全かつ拡張可能

## 今すぐ始めるには

```bash
npm install -g @gonzui/claude-task-manager
claude-task init
claude-task new "素晴らしいものを構築する"
```

---

この記事が役に立ったら、Xをフォローしていただけると嬉しいです!

https://x.com/gonzui_dev

## 参考リンク

- [GitHubリポジトリ](https://github.com/devgonzui-ai/claude-task-manager)
- [npmパッケージ](https://www.npmjs.com/package/@gonzui/claude-task-manager)
- [Claude Code](https://claude.ai/code)

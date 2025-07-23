# GitHub Actions 自動公開設定

このドキュメントでは、mainブランチへのマージ時に自動的にnpmへパッケージを公開するための設定方法を説明します。

## セットアップ手順

### 1. NPM Access Token の取得

1. [npmjs.com](https://www.npmjs.com/) にログイン
2. アカウントメニューから「Access Tokens」を選択
3. 「Generate New Token」をクリック
4. トークンタイプは「Automation」を選択（CI/CD用）
5. トークン名を入力（例：`claude-task-manager-github-actions`）
6. 生成されたトークンをコピー（一度しか表示されません）

### 2. GitHub Secrets の設定

1. GitHubリポジトリの「Settings」タブを開く
2. 左側メニューの「Secrets and variables」→「Actions」を選択
3. 「New repository secret」をクリック
4. 以下の情報を入力：
   - Name: `NPM_TOKEN`
   - Secret: コピーしたnpmアクセストークン
5. 「Add secret」をクリック

### 3. ワークフローの動作

- mainブランチへのpush時に自動実行
- 手動実行も可能（Actions タブから「Run workflow」）
- package.jsonのバージョンが既にnpmに存在する場合はスキップ
- 公開成功時は自動的にGitタグも作成

## バージョン管理

### 方法1: GitHub Actions でバージョンアップ（推奨）

1. GitHubリポジトリの「Actions」タブを開く
2. 左側の「Version Bump」を選択
3. 「Run workflow」をクリック
4. バージョンタイプを選択（patch/minor/major）
5. 「Run workflow」をクリック

これにより自動的に：
- package.jsonのバージョンが更新される
- コミットが作成される
- Gitタグが作成される
- mainブランチにpushされる
- npm公開ワークフローがトリガーされる

### 方法2: ローカルでバージョンアップ

```bash
# パッチバージョンアップ (1.0.3 → 1.0.4)
npm version patch

# マイナーバージョンアップ (1.0.3 → 1.1.0)
npm version minor

# メジャーバージョンアップ (1.0.3 → 2.0.0)
npm version major

# 変更をpush
git push origin main --follow-tags
```

## トラブルシューティング

### エラー: 認証失敗
- NPM_TOKEN が正しく設定されているか確認
- トークンの権限が「Automation」になっているか確認

### エラー: バージョンが既に存在
- package.jsonのバージョンを更新してからpush

### テストが失敗する場合
- ローカルで `npm test` を実行して確認
- 必要に応じてテストを修正またはスキップ
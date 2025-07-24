# GitHub Actions 自動公開設定

このドキュメントでは、タグをプッシュした時に自動的にnpmへパッケージを公開するための設定方法を説明します。

## セットアップ手順

### 1. NPM Access Token の取得

1. [npmjs.com](https://www.npmjs.com/) にログイン
2. アカウントメニューから「Access Tokens」を選択
3. 「Generate New Token」をクリック
4. トークンタイプは「Automation」を選択（CI/CD用）
5. トークン名を入力（例：`claude-task-manager-github-actions`）
6. 生成されたトークンをコピー（一度しか表示されません）

### 2. GitHub Secrets の設定

#### NPM_TOKEN（必須）
1. GitHubリポジトリの「Settings」タブを開く
2. 左側メニューの「Secrets and variables」→「Actions」を選択
3. 「New repository secret」をクリック
4. 以下の情報を入力：
   - Name: `NPM_TOKEN`
   - Secret: コピーしたnpmアクセストークン
5. 「Add secret」をクリック

### 3. 公開プロセス

#### ステップ1: package.jsonのバージョンを更新

まず、`package.json`のバージョンを手動で更新します：

```json
{
  "version": "1.0.5"
}
```

#### ステップ2: 変更をコミット・プッシュ

```bash
git add package.json
git commit -m "chore: bump version to 1.0.5"
git push origin main
```

#### ステップ3: タグを作成・プッシュ

```bash
# package.jsonのバージョンと一致するタグを作成
git tag v1.0.5
git push origin v1.0.5
```

#### ステップ4: 自動公開

`v`で始まるタグをプッシュすると、GitHub Actionsが自動的に：
1. タグのバージョンとpackage.jsonのバージョンが一致しているか確認
2. テストを実行
3. プロジェクトをビルド
4. npmに公開
5. GitHubリリースを作成

## 重要な注意事項

- タグのバージョンは必ずpackage.jsonのバージョンと一致させてください
- タグは`v`プレフィックスが必要です（例：`v1.0.5`、`1.0.5`ではない）
- バージョンが一致しない場合、ワークフローは失敗します
- 同じバージョンは二度公開できません

## バージョン管理のベストプラクティス

### セマンティックバージョニング

- **パッチバージョン** (1.0.3 → 1.0.4): バグ修正
- **マイナーバージョン** (1.0.3 → 1.1.0): 後方互換性のある新機能
- **メジャーバージョン** (1.0.3 → 2.0.0): 破壊的変更

### バージョン更新の例

```bash
# バグ修正の場合
# package.jsonを編集: "version": "1.0.4" → "1.0.5"
git add package.json
git commit -m "fix: correct task execution bug"
git push origin main
git tag v1.0.5
git push origin v1.0.5

# 新機能追加の場合
# package.jsonを編集: "version": "1.0.5" → "1.1.0"
git add package.json
git commit -m "feat: add debug mode to run command"
git push origin main
git tag v1.1.0
git push origin v1.1.0
```

## トラブルシューティング

### エラー: 認証失敗
- NPM_TOKEN が正しく設定されているか確認
- トークンの権限が「Automation」になっているか確認
- トークンが期限切れでないか確認

### エラー: バージョンが既に存在
- npmに同じバージョンが既に公開されている
- package.jsonのバージョンを上げてから再度実行

### エラー: タグとpackage.jsonのバージョン不一致
- タグを削除: `git tag -d v1.0.5 && git push origin :refs/tags/v1.0.5`
- 正しいバージョンでタグを作り直す

### テストが失敗する場合
- ローカルで `npm test` を実行して確認
- 必要に応じてテストを修正してからタグを作成
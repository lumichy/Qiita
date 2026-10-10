---
title: Claudeの利用制限も無料枠のエラーも怖くない！自作LLM API Gatewayで実現する安定・自動ルーティング
tags:
  - LLM
  - Claude
  - APIGateway
  - TypeScript
  - 個人開発
private: false
updated_at: '2026-10-10T21:25:22+09:00'
id: 85a0381a26dc85468ff0
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

![カバー画像](https://raw.githubusercontent.com/lumichy/Qiita/main/public/llm-api-gateway-smart-routing-2026/cover.png)

日常的にLLMを叩いて開発していると、必ず直面する「あの瞬間」のストレスがあります。

「無料枠のモデルを使っていたら、夜の混雑ピークで `503 Service Unavailable` を連発されて処理が止まった」
「Claude Proでコードのリファクタリングに没頭していたら、突如 **『利用上限に達しました。〇〇時までメッセージを送信できません』** のメッセージが出て強制中断された」
「手元にはClaude、Gemini、Codex、各種格安APIの契約があるのに、クライアント側の設定や環境変数を切り替えるのが面倒すぎる」

私自身、Claude Codeをノリノリで走らせていた深夜2時、突然の利用上限到達でセッションが切断され、慌てて別のAPIキーを探してスクリプトを書き直す羽目になり、完全に集中が途切れた苦い経験があります。

「手持ちのモデルやアカウントを1本のパイプに束ねて、混雑やリミットが来たら裏で勝手に切り替えてくれたらいいのに。」

その思いから開発したのが、個人向けの軽量リバースプロキシ **`subscription-ai-gateway`**（以下、API Gateway）です。

GitHubリポジトリ: [lumichy/api_gateway](https://github.com/lumichy/api_gateway)

この記事では、このAPI Gatewayの全体像から、`model: "auto"` によるモデル選択ロジック、実践的な活用法、そして設計から学べるTypeScriptのコア実装までを詳しく解説します。

---

## 基本情報クイックリファレンス

| 項目 | 内容 |
|---|---|
| **リポジトリ** | [lumichy/api_gateway](https://github.com/lumichy/api_gateway) |
| **開発スタック** | Node.js ≥ 24、TypeScript（直接実行） |
| **外部依存** | **ゼロ（Zero Dependencies）**（`node:http`, `node:sqlite`, `node:child_process` のみ） |
| **受付プロトコル** | OpenAI Chat Completions 互換（`/v1/chat/completions`）、SSEストリーミング対応 |
| **対応プロバイダー** | `openai-compatible`（任意のAPI）、Claude CLI、Codex CLI、CodeBuddy、Antigravity |
| **ルーティング方式** | `model: "auto"`（クォータ残量スコア・クールダウン・同時実行数による自動選択） / 固定指定（`id/model`） |
| **対象環境** | ローカル単一ユーザー開発環境（`127.0.0.1:8787`） |

---

## なぜ「自作 API Gateway」を作ったのか？

![アーキテクチャ概要](https://raw.githubusercontent.com/lumichy/Qiita/main/public/llm-api-gateway-smart-routing-2026/architecture.png)

世の中にはOpenRouterやLiteLLMといった優れたアグリゲーションサービスやプロキシが存在します。それでもローカル専用のゲートウェイを自作したのには、明確な理由があります。

1. **CLIやサブスクリプションを同一エンドポイントで束ねたい**  
   Web APIとして提供されている従量課金モデルだけでなく、Claude CLIや各種ツールのサブスク枠を「OpenAI互換のHTTPエンドポイント」として統一的に扱いたかったためです。
2. **外部依存ゼロで手軽に動かしたい**  
   重厚なDockerコンテナや大量のnpmパッケージに頼らず、Node.js 24の標準機能だけでビルド不要・数ミリ秒で立ち上がるミニマルな構成を追求しました。
3. **「フォールバックの安全性」を自前で厳密に制御したい**  
   ストリーミング出力の途中でプロバイダーを切り替えると、クライアント側で文章が重複・破損します。「チャンクを1文字でも出力した後はフォールバックせず、出力開始前の一時エラー時のみ次の候補へ流す」という堅牢なフェイルオーバー制御を組み込みたかったのです。

---

## API Gateway のコア機能

### 1. OpenAI 互換の単一エンドポイント
ゲートウェイを起動すると、ローカルの `http://127.0.0.1:8787/v1` で待ち受けます。
OpenAI Python SDK、TypeScript SDK、Cursor、Continue、Claude Code、自作エージェントスクリプトなど、あらゆるツールから `base_url` を差し替えるだけで繋がります。

### 2. openai-compatible で任意のプロバイダーを集約
OpenAI標準の仕様に従っているAPIであれば、設定ファイル（`config.local.json`）に追記するだけでコードを1行も書かずに登録できます。

```json
{
  "id": "ark",
  "type": "openai-compatible",
  "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3",
  "apiKeyEnv": "ARK_API_KEY",
  "models": ["deepseek-v4.1-flash"],
  "enabled": true,
  "billingVerified": true,
  "allowAuto": true,
  "priority": 5,
  "maxConcurrency": 3
}
```

DeepSeek、Qwen（Alibaba Cloud）、Gemini（Google AI Studio）、OpenRouter、SiliconFlowなど、世界中のLLMプロバイダーを同一のローカルゲートウェイ配下に同居させられます。

### 3. ルーターの自動選択ロジック（`model: "auto"`）
モデル名に `"auto"` を指定すると、ルーターが以下の手順で最適なプロバイダーを動的に決定します。

```text
クライアント要求 (model="auto")
       │
       ▼
[1. 機能フィルタリング]
・ツール呼び出し / 画像入力 / 複数ターン履歴の対応可否を判定
       │
       ▼
[2. 健全性・クールダウン判定]
・ヘルスチェック失敗、直近のエラーによるクールダウン中、残枠ゼロの候補を除外
       │
       ▼
[3. クォータスコアリング]
・有効期限内の残枠割合（既知データ）を優先評価
・同点時は priority（数値が小さい順）→ IDアルファベット順
       │
       ▼
[4. 同時実行枠の確保 & 試行]
・maxConcurrency 内でリクエスト送信
・混雑（429 / 503）や一時障害なら次の候補へ自動フォールバック！
```

---

## API Gateway の使い方

### ステップ1: リポジトリのクローンと確認

Node.js 24 以降がインストールされていれば、`npm install` すら不要です。

```powershell
git clone https://github.com/lumichy/api_gateway.git api_gateway
cd api_gateway

# 動作環境の確認
node --version # v24+ が必要
```

### ステップ2: 認証キーと設定の準備

ゲートウェイ用のAPIキーを `.env.local` に定義します。

```env
GATEWAY_KEY=your-super-secret-gateway-key-24chars-or-more
GATEWAY_ADMIN_KEY=your-super-secret-admin-key-24chars-or-more
OPENROUTER_API_KEY=sk-or-v1-...
ARK_API_KEY=...
```

設定テンプレートをコピーして、使用したいプロバイダーを有効化します。

```powershell
Copy-Item config.example.json config.local.json
```

### ステップ3: ゲートウェイの起動

```powershell
node --env-file=.env.local src/main.ts --config config.local.json
```

`http://127.0.0.1:8787/v1` でゲートウェイが稼働します。

### ステップ4: クライアントから呼び出す

#### ① Python OpenAI SDK の場合

`base_url` と `api_key` をゲートウェイに向けるだけです。

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:8787/v1",
    api_key="your-super-secret-gateway-key-24chars-or-more",
)

# model="auto" でリクエスト
response = client.chat.completions.create(
    model="auto",
    messages=[
        {"role": "system", "content": "あなたは優秀なエンジニアです。"},
        {"role": "user", "content": "RustとGoの並行処理モデルの違いを端的に解説して"},
    ],
)

print(response.choices[0].message.content)
```

レスポンスヘッダーには `x-gateway-provider` と `x-gateway-model` が付与されるため、「実際にどのプロバイダーがリクエストを処理したか」が一目で分かります。

#### ② Claude Code などのエージェントにカスタムプロバイダーとして設定

Claude Code などのCLIエージェントツールでも、カスタムエンドポイントとして本ゲートウェイを指定可能です。環境変数で上流エンドポイントを本ゲートウェイに向けることで、エージェントの通信をすべてローカルルーター経由に集約できます。

```bash
# Claude Code などのベースURLをローカルゲートウェイに向ける例
export ANTHROPIC_BASE_URL="http://127.0.0.1:8787/v1"
export ANTHROPIC_API_KEY="your-super-secret-gateway-key-24chars-or-more"
```

Cursor や Continue などのエディタ拡張機能でも、OpenAI互換のカスタムプロバイダーとして `http://127.0.0.1:8787/v1` を登録し、モデル名に `auto` を指定するだけでシームレスに機能します。

---

## 悩みを解消する実践ユースケース

### ユースケース1: 複数無料プロバイダー間の自動フェイルオーバー
- **設定方針**: OpenRouterの無料モデル（`priority: 10`）と、別の無料枠プロバイダー（AgnesやArkのフリー枠など、`priority: 10`）を複数登録しておく。
- **動作**: 普段は1つ目の無料プロバイダーでリクエストを処理。ピーク時間帯などでそのプロバイダーが混雑し、`429 Too Many Requests` や `503 Service Unavailable` を返してきた瞬間に、ゲートウェイがそれを検知してクールダウン状態へ隔離。**自動的にもう一方の無料プロバイダーへ即座にリクエストを転送**します。無料プロバイダー同士のフォールバックにより、0円運用のままで高い可用性をキープできます。

### ユースケース2: Claudeの利用上限到達時にCodex/Geminiへフェイルオーバー
- **設定方針**: 開発用メインモデルとしてClaudeを設定し、自動選択リストにCodexおよびGeminiを待機させておく。
- **動作**: Claudeのメッセージ上限や利用枠制限に達した際、通常なら数時間の作業中断を余儀なくされます。しかしこのゲートウェイを経由していれば、自動的にクールダウン期間へ移行し、次の優先候補であるCodexやGeminiへ切り替わって処理が継続します。

### ユースケース3: ツールやスクリプトの設定変更が「永久にゼロ」
- エージェントスクリプトやエディタ側の設定は常に `base_url="http://127.0.0.1:8787/v1"`、`model="auto"` のまま固定。
- 試したい新モデルが登場した時は、ゲートウェイの `config.local.json` に数行追加するだけ。呼び出し側のコードを1文字も触る必要がありません。

---

## 勉強になるコード解説：ルーターのコア実装

このプロジェクトの設計美は、`src/scheduler.ts` に集約されています。
複雑な外部ライブラリを使わず、非同期ジェネレータ（`async *run`）とストリーム制御を駆使して作られています。その核心部分を見てみましょう。

### 1. 候補プロバイダーのフィルタリングとスコアリング

```typescript
// src/scheduler.ts（抜粋・解説用）
const discovered = await Promise.all(
  this.providers.map(async (p): Promise<Candidate | null> => {
    // 無効化されているプロバイダーや、auto不許可のものを除外
    if (!p.enabled || (pinned && p !== pinned)) return null;
    if (!pinned && p.allowAuto === false) return null;

    const model = pinned ? request.model.slice(p.id.length + 1) : p.models[0];
    if (!model) return null;

    // クールダウン中、または残クォータがゼロの候補を除外
    const cd = await this.state.cooldown(p.id);
    if (cd && cd > Date.now()) return null;

    // クォータ残量に基づきスコア（0.0〜1.0）を算出
    const quota = await this.getQuotaSnapshot(p.id);
    const score = quotaScore(quota);

    return { provider: p, model, score, quota };
  })
);
```

各プロバイダーの健全性、クールダウン状態、残クォータ情報を並列で収集し、候補リスト（`candidates`）を作ります。

### 2. ソートとフォールバック実行ループ

```typescript
// スコアの高い順（残枠の余裕がある順）→ priorityが小さい順にソート
candidates.sort((a, b) => {
  if (a.score !== null && b.score !== null) return b.score - a.score;
  if (a.score !== null) return -1;
  if (b.score !== null) return 1;
  return (a.provider.priority ?? 100) - (b.provider.priority ?? 100);
});

// 候補順に実行を試みる
for (const cand of candidates) {
  try {
    // 同時実行枠（concurrency）を確保
    await this.state.acquireConcurrency(cand.provider.id);

    // プロバイダーへリクエスト（非同期ジェネレータでイベントを受信）
    for await (const event of cand.provider.stream(request, signal)) {
      yield event; // クライアントへSSEイベントをストリーミング
    }
    return; // 正常完了したらループ終了
  } catch (err) {
    const error = safeError(err);
    if (!error.retryable) {
      // パラメータ不正など、再試行不可のエラーはフォールバックせず即時throw
      throw error;
    }
    // レートリミット等の場合はクールダウンを記録して次へループ
    await this.state.setCooldown(cand.provider.id, error.retryAfterMs);
    lastError = error;
  } finally {
    await this.state.releaseConcurrency(cand.provider.id);
  }
}
```

ポイントは **「エラー種別の判定（`error.retryable`）」** と **「ストリーミング出力開始後のプロテクト」** です。
クライアントの構文ミス（400エラー）を別プロバイダーに再送しても無意味なので即座にエラーを返します。一方、`429 Rate Limit` や `503 Service Unavailable` のような一時的な障害のみ、クールダウンをセットして次のプロバイダーへとフォールバックします。

---

## 本プロジェクトの制約事項

導入を検討する上で、知っておくべき制約・前提条件があります。

### CLI系プロバイダー特有の制約と前提条件
Claude CLI、Codex CLI、CodeBuddy、Antigravity などのCLI系プロバイダーを利用する場合、以下の制約があります。

- **単一ターンのみ受付**: CLIプロセスを呼び出す構造上、受け付けるのは1件の `user` メッセージと任意の先頭 `system` 指定1件のみです。複数ターンの会話履歴を含むリクエストが来た場合、`auto` ルーティングは構造化履歴に対応した `openai-compatible` プロバイダーにのみ自動で絞り込みます（CLIエイリアスを直指定した場合は 400 エラーとなります）。
- **公式ログインと固定バージョンへの依存**: CLIがあらかじめ端末上で公式アカウントにログイン済みであること、および検証済みの固定バージョン（または許可リストのバージョン）であることが動作の前提条件です。
- **実行可能パラメータの厳格な許可リスト**: セキュリティ保護のため、実行コマンドは `node.exe` またはネイティブ実行ファイルのみに限定され、シェル実行や `.cmd` ファイルの直接呼び出しは拒否されます。
- **ツールの隔離**: CLI側のネイティブツール（ファイル編集やコマンド実行など）は無効化・隔離されます。外部からのツール呼び出しリクエストは、互換API側にのみ転送されます。

### 一般的なシステム制約
- **ローカル単一ユーザー専用**: 認証やレート制御は個人開発向けに簡素化されており、複数人が相乗りするようなマルチテナント用途には設計されていません。
- **設定変更時はプロセスの再起動が必要**: 現行バージョンでは設定のホットリロードは未搭載です。`.env.local` や `config.local.json` を書き換えた後は一度プロセスを再起動する必要があります。
- **ストリーミング開始後のフォールバック不可**: 1チャンクでも文字が出力された後に通信切断が起きた場合、整合性を保つため別モデルへの自動切り替えは行われません。

---

## まとめ

LLMを活用した開発では、「どのモデルを使うか」と同じくらい「どう安定して接続し続けるか」というインフラ面の工夫が開発体験を大きく左右します。

- 複数無料枠の連携で、混雑エラーをものともせず0円運用をキープ
- 有料サブスクの利用上限による作業強制中断を回避
- いつでも好きなモデルを1本のパイプで引き込める

外部依存ゼロ、わずか数百行のTypeScriptで書かれたこのAPI Gatewayは、日々の開発の頼もしい相棒になるはずです。興味のある方はぜひリポジトリを覗いて動かしてみてください。

GitHub: [lumichy/api_gateway](https://github.com/lumichy/api_gateway)

皆さんは普段、複数LLMの使い分けやレート制限対策をどのように工夫されていますか？おすすめの構成があれば、ぜひコメント欄で教えてください！

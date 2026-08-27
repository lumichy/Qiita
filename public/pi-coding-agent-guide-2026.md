---
title: 大道至簡：CodexやClaude Codeを超える極小AIエージェント「Pi」徹底解剖
tags:
  - AI
  - LLM
  - ClaudeCode
  - Agent
  - TypeScript
private: false
updated_at: '2026-08-27T22:07:33+09:00'
id: 83dd2c87bebe0ecd9b96
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

![カバー画像](https://raw.githubusercontent.com/lumichy/Qiita/main/public/pi-coding-agent-guide-2026/cover.png)

Claude Code や Codex、Cursor など、AI コーディングエージェントの進化は目覚ましいものがあります。

しかし、これらのツールを使っていると、こんな違和感を抱いたことはないでしょうか。

- 「裏で勝手に大量のコンテキストやシステムプロンプトが注入されて、トークンがあっという間に溶ける」
- 「複雑な承認プロンプトやサブエージェントが空回りして、肝心のコード修正が進まない」
- 「機能が多すぎてブラックボックス化し、思い通りに挙動をカスタマイズできない」

こうした**過剰な全部入り（All-in-one）エージェントへのアンチテーゼ**として世界中のギークから熱狂的な支持を集めているのが、オープンソースのコーディングエージェント **Pi**（`pi-coding-agent`）です。

ゲームエンジン libGDX の生みの親として知られる **Mario Zechner**（badlogic）氏が開発したこのツールは、「**大道至簡**（究極のシンプルさ）」を掲げ、提供するツールをたった4つに絞り込みながら、驚異的なタスク完走率と低コスト・高速性を実現しています。

この記事では、**Pi Agent** の思想や仕組み、**Composio や Databricks の実測ベンチマークで実証された凄さ**、そして主要プラグインを含む完全攻略手順を徹底解説します。

---

## 1. Pi Agent 基本スペック

まずは **Pi** の基本仕様を整理します。

| 項目 | 詳細・仕様 |
| :--- | :--- |
| **正式名称** | Pi（`@mariozechner/pi-coding-agent`） |
| **開発者** | Mario Zechner（badlogic） |
| **リポジトリ** | `badlogic/pi-mono`（Monorepo構成） |
| **主要言語** | TypeScript / Node.js |
| **提供形態** | CLI（TUI）、Print/JSON、RPC、SDK |
| **基本ツール** | **`read`**, **`write`**, **`edit`**, **`bash`** の4つのみ |
| **拡張機構** | TypeScript Extensions、Skills、Prompt Templates、Themes |
| **対応プロバイダー** | **40以上のプロバイダーに対応**（Anthropic, OpenAI, Google, DeepSeek, Mistral, Groq, OpenRouter, AWS Bedrock, Azure, Ollama, LM Studio 等） |
| **ライセンス** | MIT（オープンソース） |

---

## 2. なぜ「たった4つのツール」が最強なのか？

**Pi** の最大の特徴は、モデルに渡す基本ツールを以下の4つに限定している点です。

1. **`read`**: ファイルの読み込み
2. **`write`**: ファイルの新規作成・上書き
3. **`edit`**: ファイルの部分差分編集
4. **`bash`**: シェルコマンドの実行

サブエージェント機能も、複雑なプランニング専用モードも、デフォルトでは一切入っていません。

### 肥大化したエージェントが抱える問題
多くの商用エージェントは、初心者の使い勝手を優先するあまり、毎ターン膨大な指示プロンプト、ファイルツリーの自動探索ログ、メタデータをコンテキストに詰め込みます。

結果として、
- コンテキストがすぐに枯渇する
- モデルのアテンションが分散し、指示の見落とし（Instruction Drift）が起きる
- 単純な1行修正に数十秒のレイテンシと大量のAPI費用が発生する

という本末転倒な事態に陥りがちです。

---

## 3. 実測ベンチマークで実証された「ミニマル Harness」の圧倒的優位性

「機能を削ぎ落としただけで本当に実用的なのか？」という疑問に対し、業界の最前線から決定的な検証結果が相次いで報告されています。

### ① Composio 検証：The Outcome（結果一覧）
AI ツール統合プラットフォームの Composio は、8種類の主要な Agent Harness を対象に、同一の **DeepSeek V4 Flash** を使って複雑な SaaS 連携（Gmail, GitHub, Slack, Google Sheets など）を含む 30 の実践ワークフローで計 240 回のテストを実施しました（[Composio 公式検証レポート: Finding the Best Harness for DeepSeek V4 Flash](https://composio.dev/content/best-agent-harness-deepseek-v4-flash)）。

レポート内の「**The Outcome**」セクションで公開された結果表の引用が以下です。

#### Composio「The Outcome」比較表（DeepSeek V4 Flash 実行時）

| Harness | Pass rate | Median time | Cost per success |
| :--- | :--- | :--- | :--- |
| **Pi Agent** | **66.7%** | **132.2s** | **$0.028** |
| **Prime Agent** | 62.5%* | 242.1s | $0.131 |
| **OMP** | 56.7% | 272.4s | $0.103 |
| **Claude Code** | 53.3% | 122.7s | $0.195 |
| **Codex** | 53.3% | 245.0s | $0.081 |
| **DeepAgents** | 53.3% | 187.1s | $0.045 |
| **Hermes Agent** | 50.0% | 175.5s | $0.056+ |
| **OpenCode** | 46.7% | 129.7s | $0.073 |

*(出典: Composio "Finding the Best Harness for DeepSeek V4 Flash" より引用)*

#### 「The Outcome」から分かる Pi Agent の圧倒的な強み
1. **最高パス率（66.7%）と最速の実行時間（132.2秒）**:
   全 8 種の Harness 中、**Pi Agent が最も高い成功率を記録**。さらに中央値 132.2 秒という圧倒的な処理速度を叩き出しました。
2. **コストは Claude Code の約 1/7（$0.028 vs $0.195）**:
   成功 1 回あたりにかかる費用はわずか **$0.028**。Claude Code（$0.195）と比較して約 7 分の 1 の低コストです。
3. **プロンプトキャッシュを極限まで活かす設計**:
   Composio は「**トークン総量だけでなく、キャッシュの効きやすさがコストと成功率を決定づける**」と指摘。Pi のシンプルなシステムプロンプトと 4 ツール構成が、DeepSeek の Prefix Caching と完璧に噛み合った結果となりました。

### ② Databricks 検証：パレートフロンティアを Pi が独占
米 Databricks は、実際のプルリクエストとテストスイートを用いた数百万行規模のコードベースで各コーディングエージェントをベンチマーク評価しました（[Databricks 公式ブログ: Benchmarking Coding Agents on Databricks Multi-Million Line Codebase](https://www.databricks.com/blog/benchmarking-coding-agents-databricks-multi-million-line-codebase)）。

以下は、Databricks が公開した「**タスクあたり平均コスト（Cost per task） vs 全体パス率（Overall pass-rate）**」の実測プロット図です。

![Databricks ベンチマーク結果（Cost vs Pass-rate）](https://raw.githubusercontent.com/lumichy/Qiita/main/public/pi-coding-agent-guide-2026/databricks-benchmark.png)

*(出典: Databricks "Benchmarking Coding Agents on Databricks Multi-Million Line Codebase" より引用)*

#### グラフから読み解く Pi Agent の圧倒的な実力
1. **パレート最適曲線（赤点線）のほぼすべてを Pi が支配**:
   グラフ上の赤い点線は「同一コストで最も高い成功率を出す限界線（パレートフロンティア）」を示しています。この曲線を形成しているのは、ほぼすべて **Pi** を Harness にした構成です。
2. **最高パス率 90% を他社ツールの半額で達成**:
   - `Opus 4.8 (pi, xhigh)` は **パス率 90%（最高スコア）** を約 **$2.40** で達成。
   - 一方、`Opus 4.8 (claude code, max)` は約 **$4.40**（約 1.8 倍のコスト）をかけながらパス率は 89% に留まっています。
3. **どのモデル層でも Pi の方が「安くて高精度」**:
   - `GPT 5.5 (pi, med)`（約 $0.90 / 83%） vs `GPT 5.5 (codex, med)`（約 $1.30 / 79%）
   - `GLM 5.2 (pi)`（約 $1.30 / 87%）という高コスパな選択肢も実現。
4. **勝因は「1 ターンあたりの送信コンテキスト量が約 1/3」**:
   Pi のシステムプロンプトは **1,000 トークン未満**。Codex や Claude Code が 3,000〜5,000 トークン以上のメタデータを毎ターン送信しているのに対し、Pi は極めてタイトなコンテキストを維持するため、モデルが集中力を切らさず、トークン浪費も防ぎます。

---

## 4. Pi の4つの動作モードとアーキテクチャ

**Pi** は単なるターミナルツールにとどまらず、4つの顔を持っています。

```
                   ┌─────────────────────────────┐
                   │          Pi Agent           │
                   └──────────────┬──────────────┘
                                  │
         ┌────────────────┬───────┴────────┬────────────────┐
         ▼                ▼                ▼                ▼
   [ Interactive ]   [ Print/JSON ]     [  RPC  ]       [   SDK   ]
    差分描画TUI       CI/CD・スクリプト   プロセス連携     自作Bot・OpenClaw
```

1. **Interactive Mode（対話型 TUI）**:
   自作の TUI ライブラリ `pi-tui` を採用。ターミナル特有の画面チラつきを完全に排除する**差分レンダリング**（Differential Rendering）を実装しており、圧倒的にスムーズな操作感を実現しています。
2. **Print / JSON Mode**:
   出力をプレーンテキストや JSON で標準出力に流すモード。シェルスクリプトや GitHub Actions などの自動化パイプラインに組み込めます。
3. **RPC Mode**:
   他プロセスから標準入出力を介して **Pi** を制御するモード。GUI アプリのバックエンドとして活用できます。
4. **SDK Mode**:
   `@mariozechner/pi-agent-core` をインポートし、自作の Web アプリや Slack ボット、AI エージェントフレームワーク（OpenClaw など）のコアエンジンとして直接組み込めます。

---

## 5. Pi Agent 完全攻略：インストールから初期設定

ここからは、実際に **Pi** を導入して使いこなすまでの基本手順を解説します。

### ステップ1：インストール

Node.js（v18以上推奨）がインストールされた環境で、以下を実行します。

```bash
# npm でグローバルインストール
npm install -g @mariozechner/pi-coding-agent

# または公式インストーラー（Linux / macOS）
curl -fsSL https://pi.dev/install.sh | bash
```

インストール後、ターミナルで `pi` と入力すると起動します。

```bash
pi
```

---

### ステップ2：API キーの設定とプロバイダ認証（`/login`）

**Pi** は **40以上のプロバイダー** に対応しています。初回起動時、利用したいプロバイダの認証を行います。

```bash
/login
```

対話メニューが表示され、以下の主要プロバイダを即座にセットアップできます。

- **Anthropic**: Claude 3.7 Sonnet / Claude 3.5 Sonnet / Opus
- **OpenAI**: GPT-4o / o3-mini
- **Google**: Gemini 2.5 Pro / Flash
- **DeepSeek**: DeepSeek V3 / R1 / V4 Flash
- **OpenRouter / Groq / Mistral / AWS Bedrock / Azure / Ollama（ローカル）** など

環境変数（`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY` 等）を事前に設定している場合は、自動的に認識されます。

---

### ステップ3：モデルの切り替え（`/model`）

セッションの途中で、タスクの難易度に応じてモデルを瞬時に切り替えることができます。

```bash
/model
```

例えば、設計やアルゴリズムの検討は **Claude 3.7 Sonnet** や **DeepSeek R1** で行い、単調なテストコード生成は軽量なモデルに切り替えるといった柔軟な運用が可能です。

---

### ステップ4：会話履歴のツリー管理と巻き戻し（`/tree`）

エージェントと対話していると、「前のステップに戻って別の方針を試したい」という場面が多々あります。**Pi** は会話履歴を線形ではなく**ツリー構造**で保持しています。

```bash
/tree
```

ツリー画面が開き、過去の任意のノードを選択してブランチ（分岐）したり、ロールバックしたりできます。無駄な試行錯誤で履歴を汚さずに済みます。

---

### ステップ5：プロジェクト専用の指示ファイル（`AGENTS.md`）

プロジェクトのルートディレクトリに `AGENTS.md` または `SYSTEM.md` を作成しておくと、**Pi** は起動時にその内容をプロジェクト固有のコンテキストとして自動認識します。

```markdown
# AGENTS.md

## 技術スタック
- Next.js (App Router), TypeScript, Tailwind CSS

## コーディング規約
- コンポーネントは named export を使用すること
- 外部 API 呼び出しには必ず Zod によるバリデーションを挟むこと
- テストは vitest で記述すること
```

---

### ステップ6：自作 Extension を書いてみる（Safety Guard の自作例）

**Pi** の真骨頂は、TypeScript で自分専用の拡張（Extension）を簡単に自作できる点です。

例えば、`rm -rf` や `git push --force`、テーブル削除などの危険なシェルコマンドを検知した際に、確認ダイアログを挟んで事故を防ぐ「Safety Guard」拡張を作ってみましょう。

`~/.pi/extensions/guard.ts`（またはプロジェクト直下の `.pi/extensions/guard.ts`）に以下のコードを配置します。

```typescript
// ~/.pi/extensions/guard.ts
import { ExtensionContext } from "@mariozechner/pi-agent-core";

export default function(ctx: ExtensionContext) {
  ctx.on("tool_call", async (event) => {
    if (event.toolName === "bash") {
      const cmd = event.params.command;
      if (cmd.includes("rm -rf") || cmd.includes("drop database") || cmd.includes("push -f")) {
        const approved = await ctx.ui.confirm(
          `⚠️ 危険なコマンドが検出されました: "${cmd}"\n実行を許可しますか？`
        );
        if (!approved) {
          throw new Error("ユーザーによりコマンド実行がキャンセルされました。");
        }
      }
    }
  });
}
```

配置後、ターミナル上で `/reload` を実行するだけで、再起動なしに即座に自作拡張が有効化されます。

```bash
/reload
```

---

## 6. 主要プラグインの導入と活用ガイド

**Pi** のエコシステムには、コミュニティや公式が提供する便利なパッケージ（Pi Package / Extension / Skill）が多数公開されています。代表的なプラグインと導入手順を紹介します。

### プラグインのインストール方法
ターミナル上で `pi install` コマンドを使用し、`npm:<package-name>` や Git リポジトリを指定してインストールします（セッション内では `/install npm:<package-name>` も利用可能です）。

```bash
# ターミナルからプラグインをインストール
pi install npm:<package-name>
```

---

### ① Web 検索プラグイン（`pi-web-access`）
モデルにリアルタイムの Web 検索能力を付与し、最新ライブラリの公式ドキュメントやエラー情報を取得させます。

```bash
pi install npm:pi-web-access
```

**使い方:**
プロンプト内で「Next.js 15 の最新 Server Actions の書き方を Web で調べて実装して」と指示するだけで、エージェントが必要に応じて検索ツールを自律的に呼び出します。

---

### ② GitHub & PR レビュープラグイン（`pi-github-tools`）
GitHub CLI（`gh`）と連携し、Issue の読み込みや Pull Request の自動差分レビューを行う Skill パッケージです。

```bash
pi install npm:pi-github-tools
```

**使い方:**
```bash
# PRのレビューを依頼
PR #42 の変更内容を確認して、エッジケースの考慮漏れがないかレビューして
```

---

### ③ UI テーマ＆ステータスバー拡張（Themes）
TUI の見た目を好みにカスタマイズし、現在のトークン消費量や Git ブランチを常時表示させる拡張機能です。

インタラクティブなテーマ切り替えを行うには、テーマスイッチャー拡張（`pi-theme-switcher`）や TUI 統合パッケージ（`pi-zentui`）を導入します。

```bash
# テーマ切り替えプラグインをインストール
pi install npm:@codewithkenzo/pi-theme-switcher

# または Starship 風のステータスライン付き総合 TUI 拡張
pi install npm:pi-zentui
```

インストール後、`/theme` コマンドで対話メニューからテーマ（Tokyo Night, Catppuccin, Dracula など）をプレビューしながら切り替えることが可能です。

```bash
/theme
```

> ※ 自作テーマを追加したい場合は、`~/.pi/agent/themes/` 配下に JSON 形式のテーマファイルを配置することで読み込ませることもできます。

---

### ④ Multi-Agent（Sub-agent）オーケストレーションプラグイン
大規模なリファクタリングや複雑な機能開発において、タスクを専門エージェントに分割して並行処理させるプラグインです。

```bash
pi install npm:pi-sub-agents
```

**特徴とメリット:**
- **コンテキスト汚染の防止**: 各サブエージェント（リサーチ担当、実装担当、テスト担当、レビュアー）が独立したコンテキストで作業するため、メインの会話履歴が肥大化しません。
- **モデルの適材適所**: 「全体の設計オーケストレーションは Claude 3.7、単体テストの並列生成は高速・安価な DeepSeek V4 Flash」といったマルチモデル協調が可能です。

**使い方例:**
```bash
# プロンプトでマルチエージェント協調を指示
/subagent 認証機能のリファクタリングを行ってください。
1. サブエージェントA: 既存コードの依存関係を調査
2. サブエージェントB: 新しいAuth0ハンドラーを実装
3. サブエージェントC: 単体テストとE2Eテストを作成・実行
```

---

## 7. 実際に使って感じたメリットと注意点

### メリット
- **圧倒的な軽さとレスポンス**: 余計なコンテキストを盛らないため、初回トークン生成までのレイテンシが極めて短く快適。
- **トークン消費の激減**: 隠されたプロンプトインジェクションがないため、同じタスクをこなした際の API コストが Claude Code 比で体感 3〜5割程度抑えられる。
- **40以上のプロバイダー対応**: お気に入りのローカル LLM（Ollama）から最先端のフロンティアモデルまで自由自在に切り替え可能。
- **完全なコントロール性**: 拡張機能（TypeScript）によって、自分好みのショートカットや安全ガード、通知機能を自由自在に構築できる。

### 注意点・向いていないケース
- **完全全自動を求める人には不向き**: 初心者向けの手取り足取りなガイド機能はないため、ターミナル操作や Git 操作に慣れている開発者向け。
- **拡張機能の作成には TypeScript の知識が必要**: 素のままでも十分強力ですが、真価を発揮するには TypeScript で拡張を書くのがベスト。

---

## 8. まとめ

**Pi** は、肥大化を続ける AI エージェント業界において、「**最小限のツールと最大限の拡張性**」という本質を突いた意欲作です。

- **4つの基本ツール（`read`, `write`, `edit`, `bash`）** のみで動く研ぎ澄まされたアーキテクチャ
- **Composio / Databricks 実測ベンチマーク** で証明された、最高パス率＆圧倒的な低コスト・トークン効率
- **40以上のモデルプロバイダー** をサポート
- **Web検索、Safety Guard、GitHub連携** などのプラグインを柔軟に後付け可能
- **`/login`, `/model`, `/tree`, `/reload`** による直感的なターミナルワークフロー

「AI に勝手に余計なことをされたくない」「自分のワークフローに合わせてエージェントを自由に Hack したい」というエンジニアは、ぜひ一度 `npm install -g @mariozechner/pi-coding-agent` を試してみてください。ターミナルでのコーディング体験がガラリと変わるはずです。

---
title: "OpenHarness：1.1万行のPythonでAI Agentの「黒箱」を丸裸にする"
tags:
  - AI
  - Agent
  - Python
  - LLM
  - OpenHarness
private: false
updated_at: ""
id: null
organization_url_name: null
slide: false
ignorePublish: false
---

![カバー画像](https://raw.githubusercontent.com/lumichy/Qiita/main/public/openharness-agent-architecture-2026/cover.png)

AI Agentのコードを読んだことがありますか？

Claude CodeやCodingAgent系のツールは確かにすごい。コードを書き、テストを走らせ、自律的にバグを直してくれる。でも「中で何が起きているのか」を理解しようと思ってソースを覗くと、そこには51万行のTypeScriptと1,884個のファイルが待ち受けている。正直、3分で閉じました。

香港大学のHKUDSチームが公開した**OpenHarness**は、この問題に対する直球の回答です。Claude Codeのコアアーキテクチャを**わずか1.1万行のPython**で再構築し、「AI Agentの内側がどうなっているか」を誰でも読める形にした。GitHubで公開直後から急速にStar数を伸ばし、現在11.8K Star・2K Forkに到達しています。

この記事では、OpenHarnessのアーキテクチャを分解して「Agentは結局どう動いているのか」を整理します。

## OpenHarnessとは：30秒で把握する基本情報

| 項目 | 内容 |
|------|------|
| **開発元** | 香港大学 HKUDS（Data Science研究所） |
| **カテゴリ** | Agent Harnessフレームワーク（Agent開発基盤） |
| **コア思想** | "The model is the agent. The code is the harness." |
| **コード規模** | Python 1.1万行（93.7%がPython） |
| **ライセンス** | MIT（完全オープンソース） |
| **対応モデル** | Claude / GPT / Kimi / Qwen / DeepSeek / Gemini / Ollama等 |
| **競合・参照元** | Claude Code（51万行）、OpenClaw、nanobot |
| **付属品** | ohmo（個人Agent）— Slack/Discord/Telegram/Feishuで動作 |

ここでまず押さえておきたいのが、OpenHarnessは**Agent「そのもの」ではない**という点。Agentの「外骨格（ハーネス）」です。

LLM（大規模言語モデル）は、そのままでは「テキストを生成するだけ」の存在です。ファイルを読み書きすることもできないし、コマンドを実行することもできない。このLLMに手足と目と記憶を与えて「実際に仕事ができるAgent」に変えるのが、Harnessの役割です。

---

## なぜ今OpenHarnessなのか？——51万行 vs 1.1万行

正直に言うと、「Agent Harnessの仕組み」自体はそこまで新しい概念ではありません。Claude Codeも、OpenClawも、内部でやっていることは基本的に同じアーキテクチャパターンです。

では何がすごいのか？

答えは**「読める」こと**。

Claude Codeの51万行の内訳を見ると、OAuth認証フロー、テレメトリ収集、重厚なReact UI、エンタープライズ向け権限管理など、「Agentの仕組みを理解する」という目的には不要な機能が大量に含まれています。OpenHarnessはそれらを全部削ぎ落として、**Harnessの本質だけを1.1万行に凝縮**した。

私の感覚だと、1.1万行なら集中すれば週末で全部読める。51万行は……数ヶ月はかかります。この差はでかい。

---

## 10のコアサブシステム：アーキテクチャ全体図

OpenHarnessは以下の10個のサブシステムで構成されています。

```
openharness/
  engine/       # 🧠 Agent Loop — 心臓部
  tools/        # 🔧 43個のツール — ファイルI/O、Shell、検索、Web、MCP
  skills/       # 📚 スキル — オンデマンドの知識ローディング(.md)
  plugins/      # 🔌 プラグイン — コマンド、フック、エージェント、MCP
  permissions/  # 🛡️ 権限管理 — 多段階モード、パスルール
  hooks/        # ⚡ ライフサイクル — PreToolUse / PostToolUse
  commands/     # 💬 54個のスラッシュコマンド
  mcp/          # 🌐 MCP — Model Context Protocol クライアント
  memory/       # 🧠 メモリ — 永続的なクロスセッション知識
  coordinator/  # 🤝 マルチAgent — サブエージェント生成、チーム連携
```

一つずつ見ていきます。

### 1. Agent Loop（エンジン）——心臓部

Agentの動作原理は、実はとてもシンプルです。OpenHarnessのAgent Loopは以下のコードに集約されます。

```python
while True:
    response = await api.stream(messages, tools)
    if response.stop_reason != "tool_use":
        break  # モデルが「もうやることない」と判断

    for tool_call in response.tool_uses:
        # 権限チェック → フック → 実行 → フック → 結果格納
        result = await harness.execute_tool(tool_call)
    messages.append(tool_results)
    # ループ続行 — モデルが結果を見て次のアクションを決める
```

たったこれだけ。「モデルに聞く→ツールを実行→結果を返す→また聞く」の無限ループ。この単純なループが、あらゆる複雑なAgentタスクの基盤になっている。

モデルは「何をするか」を決める。Harnessは「どうやるか」を担当する。この分離が設計の核心です。

### 2. Tools（43個のビルトインツール）

Agentの「手足」に当たる部分です。OpenHarnessには43個のツールが組み込まれています。

各ツールの特徴：
- **Pydantic入力バリデーション** — 型安全な構造化入力
- **JSON Schema自己記述** — モデルが自動的にツールの使い方を理解
- **権限チェック統合** — 実行前に必ず権限確認
- **フックサポート** — 実行前後にイベントを挟める

ファイルI/O、Shell実行、Web検索、MCP連携、Agentタスク管理など、実務で必要になるツールが一通り揃っている。カスタムツールの追加も数行で可能です。

```python
from pydantic import BaseModel, Field
from openharness.tools.base import BaseTool, ToolExecutionContext, ToolResult

class MyToolInput(BaseModel):
    query: str = Field(description="Search query")

class MyTool(BaseTool):
    name = "my_tool"
    description = "Does something useful"
    input_model = MyToolInput

    async def execute(self, arguments: MyToolInput, 
                      context: ToolExecutionContext) -> ToolResult:
        return ToolResult(output=f"Result for: {arguments.query}")
```

### 3. Skills（スキルシステム）——Markdownで定義する知識

ここが個人的に一番好きなところ。スキルの定義方法が**ただのMarkdownファイル**。

```
Available Skills:
  - commit: クリーンなgitコミットを作成
  - review: バグ・セキュリティ・品質をレビュー
  - debug: バグを体系的に診断・修正
  - plan: コーディング前に実装計画を設計
  - test: テストを書いて実行
  - simplify: コードをシンプルにリファクタ
  - pdf: PDFの処理（pypdf利用）
  - xlsx: Excelの操作
  - ... 40+
```

自分でスキルを追加するのも、`~/.openharness/skills/my-skill.md` にMarkdownファイルを置くだけ。JSONでもYAMLでもなく**Markdown**にしたのは、人間もLLMも同じフォーマットでそのまま読み書きできるからだと思います。

さらに、[anthropics/skills](https://github.com/anthropics/skills) との互換性もある。つまりClaude Codeのスキルエコシステムをそのまま持ってこれます。

### 4. Plugin System（プラグイン）

Claude Codeの[公式プラグイン](https://github.com/anthropics/claude-code/tree/main/plugins)と互換性あり。12個の公式プラグインが動作確認済みです。

- `commit-commands` — コミット関連コマンド
- `security-guidance` — セキュリティ警告
- `code-review` — コードレビュー
- `pr-review-toolkit` — PRレビュー
- `feature-dev` — 機能開発フロー
- `hookify` — フック拡張

```bash
oh plugin list            # 一覧表示
oh plugin install <source> # インストール
oh plugin enable <name>   # 有効化
```

大手のエコシステム資産をそのまま再利用できるのは、後発プロジェクトとして賢い戦略です。

### 5. Permissions（権限管理）——安全の砦

AI Agentに「危険なコマンドを実行させない」ための仕組み。3段階の権限モードと、パス・コマンドレベルでの細かなルール設定が可能です。

```json
{
  "permission": {
    "mode": "default",
    "path_rules": [{"pattern": "/etc/*", "allow": false}],
    "denied_commands": ["rm -rf /", "DROP TABLE *"]
  }
}
```

開発中に `rm -rf /` を実行されたら洒落にならない。この種の安全弁は、Agentフレームワークとして必須の機能です。

### 6-10. その他のサブシステム

| サブシステム | 機能 |
|------------|------|
| **Hooks** | `PreToolUse` / `PostToolUse` でツール実行前後にカスタムロジックを挟む |
| **Commands** | `/help`, `/commit`, `/plan`, `/resume` 等、54個のスラッシュコマンド |
| **MCP** | Model Context Protocolクライアント。HTTP transport、自動再接続対応 |
| **Memory** | `MEMORY.md` による永続記憶。セッションをまたいで知識を保持 |
| **Coordinator** | サブエージェントの生成・委任、チーム登録、バックグラウンドタスク管理 |

---

## 対応プロバイダー：あらゆるモデルに接続可能

OpenHarnessはAnthropicネイティブだけでなく、OpenAI互換API経由で多数のプロバイダーに接続できます。

| プロバイダー | エンドポイント | 対応モデル例 |
|------------|--------------|-------------|
| **Anthropic** | api.anthropic.com | Claude Sonnet 4.6, Opus 4.6 |
| **Moonshot/Kimi** | api.moonshot.cn | Kimi-K2.5 |
| **OpenAI** | api.openai.com | GPT-5.4, GPT-4.1 |
| **Qwen** | dashscope.aliyuncs.com | Qwen3.5-Flash, Qwen3-Max |
| **DeepSeek** | api.deepseek.com | DeepSeek-Chat, DeepSeek-Reasoner |
| **Google** | generativelanguage.googleapis.com | Gemini 2.5 Flash/Pro |
| **Groq** | api.groq.com | Llama-3.3-70B |
| **Ollama** | localhost:11434 | ローカルモデル全般 |
| **SiliconFlow** | api.siliconflow.cn | DeepSeek-V3 |
| **OpenRouter** | openrouter.ai | 各社モデルの統合アクセス |
| **GitHub Copilot** | OAuth認証 | Copilotサブスクで利用可 |

特筆すべきは**Copilot連携**。既存のGitHub Copilotサブスクリプションをそのままバックエンドとして使えるので、追加のAPIキー不要でAgentが動きます。

```bash
oh auth copilot-login   # ブラウザでGitHub認証
uv run oh --api-format copilot  # Copilotで起動
```

---

## ohmo：パーソナルAgent

OpenHarnessの上に構築された個人用Agentが**ohmo**。Feishu / Slack / Telegram / Discordと接続して、コードを書き、テストを走らせ、PRを開くところまで自動でやってくれます。

```bash
ohmo init      # ワークスペースを初期化
ohmo config    # チャンネルとプロバイダーを設定
ohmo gateway start  # ゲートウェイ起動
```

`~/.ohmo/` ディレクトリ配下に `soul.md`（長期的な性格）、`identity.md`（アイデンティティ）、`user.md`（ユーザー情報）、`memory/`（個人記憶）が配置される設計。Hermes Agentの記憶システムと似た思想ですね。

---

## クイックスタート：3ステップで起動

### 1. インストール

**Linux / macOS / WSL：**
```bash
# ワンクリックインストール
curl -fsSL https://raw.githubusercontent.com/HKUDS/OpenHarness/main/scripts/install.sh | bash

# または pip
pip install openharness-ai
```

**Windows（PowerShell）：**
```powershell
# ワンクリックインストール
iex (Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/HKUDS/OpenHarness/main/scripts/install.ps1')

# または pip
pip install openharness-ai
```

> **注意：** Windowsでは `oh` が `Out-Host` のエイリアスと競合するため、`openh` コマンドを使ってください。

### 2. セットアップ

```bash
oh setup   # 対話型ウィザードでプロバイダーを選択・認証
# Windows: openh setup
```

### 3. 起動

```bash
oh   # インタラクティブモード
# Windows: openh
```

**非インタラクティブモード（スクリプト向け）：**
```bash
oh -p "Explain this codebase"                    # 単発プロンプト
oh -p "List all functions" --output-format json   # JSON出力
oh -p "Fix the bug" --output-format stream-json   # ストリーミングJSON
```

**Dry Run（安全プレビュー）：**
```bash
oh --dry-run    # 設定・認証状態・ツールを確認（モデル実行なし）
```

Dry Runは `ready` / `warning` / `blocked` の3段階で準備状況を報告してくれる。環境構築のトラブルシューティングに便利です。

---

## メリットと制約

### ✅ メリット

- **可読性**：1.1万行で全アーキテクチャが理解可能。Agent開発の最良の教材
- **拡張性**：カスタムツール・スキル・プラグインの追加が数行〜数十行で完結
- **互換性**：Claude Code のスキル・プラグインエコシステムを再利用可能
- **モデル非依存**：Anthropic、OpenAI、Qwen、DeepSeek、ローカルモデルまで幅広く対応
- **MITライセンス**：商用利用含めて完全に自由

### ⚠️ 制約

- **プロダクション向けではない**：テレメトリ、HA構成、エンタープライズ認証は削除されている。本番環境で使うなら自前で補強が必要
- **TypeScript版なし**：Python一本。Node.jsエコシステムとの統合は手間がかかる
- **ドキュメントがまだ薄い**：READMEは充実しているが、深い設計思想のドキュメントはこれから
- **ohmoは発展途上**：Telegram/Slack/Discord/Feishu対応だが、まだ粗削りな部分がある

---

## こんな人に向いている

**向いている：**
- 🎓 AI Agentの内部構造を理解したい学生・研究者
- 🔧 自社ドメインに特化したカスタムAgentを構築したい開発者
- 🧪 ツール呼び出し・マルチAgent連携のプロトタイプを素早く試したい人
- 📖 Claude Codeの仕組みを学びたいが51万行は読めない人

**向いていない：**
- 🏢 エンタープライズ規模のAgent基盤をすぐに本番投入したいチーム
- 🖥️ TypeScript / Node.js前提のプロジェクト
- 🤖 「とりあえずAgentを使いたい」だけで内部構造に興味がない人（その場合はClaude Codeをそのまま使うべき）

---

## まとめ：「読めるAgent」の価値

OpenHarnessの最大の貢献は、技術的なブレークスルーではありません。AI Agentのアーキテクチャを**「読める」サイズに落とし込んだこと**です。

- Agent Loopの仕組み
- ツール呼び出しと権限制御の実装
- スキルとプラグインの設計パターン
- マルチAgentの連携方法
- 永続メモリの管理

これらすべてが1.1万行のPythonに収まっている。大手が何十万行かけて構築したものの「本質部分」だけを抜き出した、いわばAgentアーキテクチャの教科書。

個人的には、実際にソースを読んでみてAgent LoopとPermissionチェッカーの実装が一番勉強になりました。「あ、結局こんなシンプルなループの上に全部乗っかっているのか」という感覚は、READMEを読むだけでは得られない。

AI Agentの仕組みに少しでも興味があるなら、まずは `engine/` ディレクトリの数百行を読んでみてください。Agentの「魔法」が、ただの `while True` ループだったことに気づくはずです。

あなたは普段、AI Agentのコードを読む派ですか？　それとも「動けばOK」派？　コメントで教えてください。

**GitHub**: [https://github.com/HKUDS/OpenHarness](https://github.com/HKUDS/OpenHarness)

---
title: AIエージェントの仕組みを学ぶ・創る——軽量・透明な制御Harness「lumichy-agent」解説
tags:
  - AI
  - Python
  - LLM
  - OpenAI
  - Claude
private: false
updated_at: '2026-08-10T20:03:11+09:00'
id: a267b3148b914dce376a
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

# AIエージェントの仕組みを学ぶ・創る——軽量・透明な制御Harness「lumichy-agent」解説

![カバー画像](https://raw.githubusercontent.com/lumichy/Qiita/main/public/lumichy-agent-framework-guide-2026/cover.png)

LLM（大規模言語モデル）を活用したAIエージェント開発において、LangChainなどの巨大な既存フレームワークは機能が非常に豊富な一方、抽象化の階層が深く内部処理がブラックボックス化しやすいという一面があります。

「エージェントが内部でどう思考し、どうツールを呼び出しているのかを正確に理解したい」
「自社のエンタープライズ要件に合わせて、無駄な依存のないシンプルで堅牢な制御基盤（Harness）から自作したい」

そうしたニーズに応えるために作られたのが、GitHubで公開されている **`lumichy-agent`** です。

`lumichy-agent` は、何でもこなす重厚なフレームワークを目指すのではなく、**コードの見通しが良く透明性の高いシンプルな Harness（制御基盤）** を提供することを目的としています。AIエージェントの動向や内部の仕組みを学ぶ教材として、あるいは自社専用のエンタープライズ級エージェントを構築するための「ベース構造」として活用するのに最適なライブラリです。

本記事では、`lumichy-agent` のコア設計思想、イベント駆動型ランタイムの仕組み、マルチLLM対応、サンドボックスコード実行、そして階層型マルチエージェント連携までの全体像を詳しく解説します。

---

## 1. lumichy-agent とは？

[lumichy/lumichy-agent (GitHub)](https://github.com/lumichy/lumichy-agent) は、1つのPythonプロジェクトに組み込むだけで、シンプルなリサーチアシスタントから高度な組織型マルチエージェントまでを自由に拡張構築できる**Python製の軽量・自律型AIエージェントHarness**です。

![主要機能エコシステム](https://raw.githubusercontent.com/lumichy/Qiita/main/public/lumichy-agent-framework-guide-2026/agent-features.png)

### 💡 主な特徴と設計思想

- 🔄 **透明性の高いイベント駆動型ランタイム**: 単なる繰り返しループではなく、明示的な状態マシン（`THINK → ACT → OBSERVE → REFLECT → FINAL`）を採用。思考やエラーからの自己回復プロセスが完全に視覚化・制御可能。
- 🔌 **マルチプロバイダー対応（Provider-Agnostic）**: OpenAI、Anthropic、さらに `base_url` を介したローカルLLM（llama.cpp, vLLM, Ollama等）をコード変更なしで柔軟に切り替え可能。
- 🏢 **階層型マルチエージェント（Hierarchical Multi-Agent）**: 親エージェントが動的に生成された `delegate_to_*` ツールを経由して子エージェントにタスクを委譲。
- 📦 **安全なサンドボックス環境**: ローカルサブプロセスだけでなく、[E2B](https://e2b.dev) を活用した隔離サンドボックス環境でPythonやShellコードを安全実行。
- 🧠 **シンプルで軽量なHarness構成**: 依存ライブラリが少なくコードベースがコンパクトなため、ソースコードを直接読んで動作を理解・改造することが容易。
- 🔍 **完全なトレーサビリティ（Hierarchical Tracing）**: すべての思考、ツール呼び出し、出力を `AgentTrace` に記録し、後から追跡・再生成・監査が可能。
- 🌐 **A2A (Agent2Agent) プロトコル対応**: Remote A2A サーバーとしてエージェントを配信し、Agent Card に基づいて相互にツール呼び出しが可能。

---

## 2. コアアーキテクチャ：5つの状態を巡るイベント駆動ランタイム

`lumichy-agent` の最大の技術的特徴は、明確に定義された**5状態のイベント駆動ランタイム**です。

![状態マシン図](https://raw.githubusercontent.com/lumichy/Qiita/main/public/lumichy-agent-framework-guide-2026/agent-runtime-state.png)

### 🔄 状態遷移のライフサイクル

```
[ THINK (思考) ]
      ↓
[ ACT (ツール実行・行動) ]
      ↓
[ OBSERVE (結果観察) ]
      ↓
[ REFLECT (反省・自己評価) ] ── (エラー・不満足) ──→ [ THINK に戻りアプローチを変更 ]
      ↓ (タスク完了)
[ FINAL (最終出力) ]
```

1. **`THINK` (思考)**: ユーザーのプロンプトと過去の文脈、アクティブな Skill を読み込み、次にとるべき行動を決定。
2. **`ACT` (行動)**: ツール（Web検索、Python実行、ファイル読み書き、サブエージェント呼び出しなど）を起動。
3. **`OBSERVE` (観察)**: ツールの実行結果や出力を収集し、コンテキストに注入。
4. **`REFLECT` (反省)**: 得られた結果が期待通りか、エラーが発生していないかを検証。もしツール実行で例外や想定外の結果が出た場合、単に同じ間違いを繰り返すのではなく、**アプローチを変更して `THINK` へ戻る**。
5. **`FINAL` (完了)**: タスクが完了したと判断された時点でユーザーへ結果を返却。

従来の単純なReActパターンでは「エラー出力をそのまま次のプロンプトに流し込んで同じ失敗をする」ことが多々ありましたが、`REFLECT` ステートを挟むことで**エラーの自己修復能力**が飛躍的に向上しています。

---

## 3. 主要機能のディープダイブ

### 3.1 マルチプロバイダー & ローカルLLM対応 (Provider-Agnostic)

`LlmProvider` インターフェースにより、コードを一切変更することなく、OpenAI や Anthropic、あるいはローカルにデプロイされた LLM を切り替えられます。

```python
from lumichy_agent import Agent

# OpenAI (gpt-4o-mini) を使用する例
agent_openai = Agent(
    provider="openai",
    model="gpt-4o-mini"
)

# Anthropic (Claude 3.5 Sonnet) を使用する例
agent_claude = Agent(
    provider="anthropic",
    model="claude-3-5-sonnet-20240620"
)

# vLLM や llama.cpp でローカル稼働しているモデルを呼び出す例
agent_local = Agent(
    provider="openai",
    base_url="http://localhost:8000/v1",
    model="Qwen2.5-Coder-32B-Instruct"
)
```

`.env` ファイルで `DEFAULT_PROVIDER` や `DEFAULT_BASE_URL` を指定しておけば、ソースコード上は完全ノースペックで環境変数主導の運用が可能です。

### 3.2 宣言的ツール定義とサンドボックス実行

ツールの作成は `@tool` デコレータを付与するだけで、型ヒントから自動的に JSON Schema が生成・バリデーションされます。

```python
from lumichy_agent.tools import tool

@tool
def calculate_growth_rate(initial_value: float, final_value: float) -> str:
    """初期値と最終値から成長率(%)を計算します。"""
    rate = ((final_value - initial_value) / initial_value) * 100
    return f"成長率: {rate:.2f}%"
```

また、コード実行ツール (`python_eval`, `bash`) はローカルサブプロセス実行だけでなく、**E2B ([e2b.dev](https://e2b.dev)) サンドボックス** をサポートしています。悪意あるコードの実行リスクを排除しながら、安全なクラウドコンテナ上でデータ分析やコードテストを行わせることができます。

```python
# E2B クラウドサンドボックス内で安全にコードを実行させる構成
agent_sandboxed = Agent(
    code_execution="e2b"
)
```

### 3.3 階層型マルチエージェント & A2Aプロトコル

複雑なプロジェクトでは、単一のエージェントにすべてをやらせるのではなく、専門のエージェントチームを編成する方が精度・スピードともに向上します。

`lumichy-agent` では、親エージェントが子エージェントを自動的に識別し、`delegate_to_<child_name>` という専用ツールとして呼び出せる仕組みを備えています。

```python
from lumichy_agent import Agent

# 専門子エージェント
researcher = Agent(name="researcher", system_prompt="Web調査と情報収集に特化したエージェント")
coder = Agent(name="coder", system_prompt="Pythonコードの記述とレビューに特化したエージェント")

# 親オーケストレーター
parent_agent = Agent(
    name="orchestrator",
    children=[researcher, coder]
)

# 親エージェントが自動的に delegate_to_researcher や delegate_to_coder をツールとして活用！
```

さらに、**A2A (Agent2Agent) プロトコル** に対応しており、別のサーバーで動作しているリモートエージェントを Agent Card 経由で探索・連携させることも可能です。

---

## 4. クイックスタートガイド

それでは、実際に `lumichy-agent` を使ってエージェントを動かす手順を見てみましょう。

### インストール

```bash
git clone https://github.com/lumichy/lumichy-agent.git
cd lumichy-agent
pip install -e .

# 必要に応じたオプショナル機能のインストール
pip install -e ".[e2b]"   # E2B コード実行サンドボックス
pip install -e ".[rag]"   # ローカルベクトル検索 RAG
pip install -e ".[a2a]"   # A2A プロトコル連携
```

### `.env` の設定

```bash
cp .env.example .env
```

OpenAIを使用する場合の最小構成：
```env
DEFAULT_PROVIDER="openai"
DEFAULT_MODEL="gpt-4o-mini"
OPENAI_API_KEY="your-actual-openai-api-key"
```

### エージェントの実行サンプル

```python
from lumichy_agent import Agent
from lumichy_agent.tools import tool

@tool
def get_current_time() -> str:
    """現在の時刻を取得します。"""
    import datetime
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# エージェントの初期化と実行
agent = Agent(
    name="assistant",
    tools=[get_current_time]
)

result = agent.run("現在時刻を確認し、挨拶メッセージを考えてください。")
print(result)
```

実行すると、内部のイベント駆動状態マシンが起動し、`THINK` → `get_current_time` ツールの呼び出し (`ACT`) → 実行結果の確認 (`OBSERVE`) → `REFLECT` を経て、完璧な回答が出力されます。

---

## 5. まとめ

`lumichy-agent` は、フレームワークの複雑さに振り回されることなく、**堅牢で自己修復可能なAIエージェントをシンプルに構築できる**強力なツールキットです。

- **状態マシンベースの確実なタスク遂行**
- **マルチプロバイダー & ローカルLLMへの柔軟な対応**
- **E2B サンドボックスや A2A プロトコルなどの先進的機能**

LLMを活用した自律型エージェント開発や、マルチエージェントシステムの導入を検討されている方は、ぜひ [lumichy/lumichy-agent (GitHub)](https://github.com/lumichy/lumichy-agent) をチェックして試してみてください！

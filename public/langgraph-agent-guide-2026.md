---
title: LangGraph実践入門：自作エージェントから卒業して現場で動くAIエージェントを構築する完全ガイド
tags:
  - Python
  - AI
  - LLM
  - Agent
  - LangChain
private: false
updated_at: '2026-09-12T18:19:40+09:00'
id: f646eb1d0d01eb67943b
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

![カバー画像](https://raw.githubusercontent.com/lumichy/Qiita/main/public/langgraph-agent-guide-2026/cover.png)

以前、こちらの記事（[AIエージェントの仕組みを学ぶ・創る——軽量・透明な制御Harness「lumichy-agent」解説](https://qiita.com/lumichy/items/a267b3148b914dce376a)）で、依存関係を極限まで削ぎ落とした自作エージェントフレームワークの設計と実装を紹介しました。

スクラッチでループ構造（THINK → ACT → OBSERVE）やツール呼び出しを一から組むと、LLMエージェントが内部で何を考え、どう動いているのか、その「解像度」が一気に上がります。エージェントの基本原理を学ぶアプローチとして、自作以上に適した方法はありません。

でも、いざ「実務の現場で安定して動くエージェント」を本番運用しようとした瞬間、容赦ない現実の壁に直面します。

- 複数ユーザーの会話セッションをどう永続化・分離するか？
- 危険なアクション（DB更新やメール送信）の直前で一時停止し、人間の承認を得るには？
- 失敗したタスクだけを指数バックオフで自動リトライさせるには？
- 過去の任意のステップに巻き戻して状態を修正し、再実行（タイムトラベル）できるか？
- 複数ノードの並列実行や動的ファンアウトはどう制御する？

これらをすべてスクラッチで車輪の再発明をして保守し続けるのは、あまりにもコストが高すぎます。

そこで現在、プロダクション環境のデファクトスタンダードとして最も支持されているのが **LangGraph** です。

本記事では、自作エージェントで基本原理を掴んだ開発者に向けて、「**なぜ実務ではLangGraphが選ばれるのか**」「**他のフレームワークと何が違うのか**」を整理し、手元のPython環境でそのままコピー＆ペーストで動かせる完全なサンプルコードとともに、Subagent（階層型マルチエージェント）を含めたLangGraphの主要機能を徹底解剖します。

---

## 1. なぜ今LangGraphなのか？——フレームワーク比較

LLMエージェントのフレームワークは群雄割拠です。CrewAI、AutoGen、そして従来のLangChain（AgentExecutor）など、多くの選択肢が存在します。

その中で、なぜ多くの企業やエンジニアが最終的にLangGraphに行き着くのでしょうか。

### 主要フレームワークとの比較表

| 項目 | LangGraph | CrewAI | AutoGen (Microsoft) | 従来のLangChain (AgentExecutor) | 自作スクラッチ (lumichy-agent等) |
|---|---|---|---|---|---|
| **コア設計思想** | 循環グラフ（State Machine） | ロールプレイング型協調 | 対話型マルチエージェント | 直線的チェーン＋固定ループ | 最小限の制御Harness |
| **フロー制御性** | **極めて高い**（コードで明示） | 中（プロンプト依存が高い） | 中〜高（会話ターン制御） | 低（ブラックボックス） | **完全自由**（自前実装） |
| **状態管理** | **明示的なState & Reducer** | エージェント内隠蔽 | メッセージ履歴中心 | 単純なMemoryクラス | 独自実装 |
| **人間の介入 (HITL)** | **ネイティブ対応**（Interrupt） | 限定的 | 会話入力による一時停止 | コールバック等で自前実装 | ループ内で自前実装 |
| **永続化 / 短期記憶** | **Checkpointer**（スレッド単位） | 独自キャッシュ | メッセージストア | Memoryコンポーネント | DB等を自前接続 |
| **タイムトラベル** | **標準サポート** | 非対応 | 非対応 | 非対応 | 自前実装 |
| **本番運用・耐障害性** | **RetryPolicy / Durability** | 自前実装が必要 | 自前実装が必要 | 不安定になりやすい | 自前実装が必要 |
| **学習コスト** | やや高め（グラフ概念の理解） | 低い（直感的） | 中程度 | 低〜中 | 仕組みの理解が必要 |

### LangGraphが選ばれる3つの決定打

#### ①「ブラックボックスな自律」ではなく「コードによる精密制御」
初期のフレームワーク（CrewAIや初期のLangChain AgentExecutorなど）は、「プロンプトに役割を与えればAI同士が勝手に会話して問題を解決してくれる」という魔法を見せてくれました。デモ動画としては映えますが、業務システムでは「**いつ終了するかわからない**」「**意図しないループに陥る**」「**出力フォーマットがブレる**」という致命的な問題を引き起こします。

LangGraphは、エージェントの思考プロセスを **有向グラフ**（Directed Graph）としてコード上で明示的に定義します。どこで分岐し、どこでループし、いつ終了するかを開発者が100%掌握できるため、業務要件に耐えうる決定論的な制御が可能です。

#### ② 状態（State）と Reducer による堅牢なデータ受け渡し
ノード間でやり取りするデータは、Pythonの `TypedDict` で厳密に型定義されます。さらに「値を上書きするのか」「リストに追記（Reducer）するのか」をフィールドごとに宣言できるため、複数ノードが並列実行されてもデータの不整合が起きません。

#### ③ 本番運用に必要なプリミティブ（永続化・中断・巻き戻し）が標準装備
実務で絶対に避けて通れない「セッションの永続化」「人間による承認（Human-in-the-loop）」「トークン単位のストリーミング」「ステップのリトライ」が、コアアーキテクチャの段階から組み込まれています。後付けのハックで苦しむ必要がありません。

---

## 2. 実行環境の準備（インストールとLLM設定）

本記事で紹介するサンプルコードを手元で動かすための準備を整えましょう。

### 必要なパッケージのインストール

ターミナルで以下のコマンドを実行し、必要なライブラリをインストールします。

```text
pip install -U langgraph langchain langchain-openai pydantic
```

### LLMの準備（APIキーの設定）

LLMを使用するコードを動かす場合は、環境変数にAPIキーを設定します。

```text
# Windows (PowerShell) の場合
$env:OPENAI_API_KEY = "your-api-key-here"

# Mac / Linux (Bash) の場合
export OPENAI_API_KEY="your-api-key-here"
```

Pythonコード内で初期化する場合は、`langchain.chat_models` の `init_chat_model` を使うのが2026年現在のベストプラクティスです。OpenAI、Anthropic、あるいはOllamaなどのローカルモデルも統一されたインターフェースで扱えます。

```python
from langchain.chat_models import init_chat_model

# OpenAI を使う場合（OPENAI_API_KEY 環境変数を参照）
llm = init_chat_model("gpt-4o-mini", model_provider="openai", temperature=0)

# 例: Anthropic を使う場合
# llm = init_chat_model("claude-3-5-sonnet-latest", model_provider="anthropic")
```

> **Note**: 本記事のコードのうち、「グラフの骨格」「StateとReducer」「Human-in-the-loopの承認フロー」「Time Travel」「RetryPolicy」「Subagent（サブグラフ）」などのセクションは、**LLM APIキーがなくても完全にそのまま手元で実行可能**です。まずはローカル環境でPythonスクリプトとして動かしてみてください。

---

## 3. LangGraphの基本概念：State・Node・Edge・Reducer

LangGraphを構成するコア要素は、たったの **3つ**（＋1つの補助概念）です。

- **State**: ノード間で共有されるデータ構造（Pythonの `TypedDict`）。
- **Node**: Stateを受け取り、**更新したい差分**（dict）を返す通常のPython関数。
- **Edge**: ノード間の遷移ルール（通常の `add_edge` と条件分岐の `add_conditional_edges`）。
- **Reducer**: 同じフィールドに更新があった際の合成ルール（上書きか、追記か）。

### 最小構成（Hello World）

まずはLLMを呼ばずに、LangGraphの最小構成が動く様子を確認しましょう。以下のコードは単体でそのまま実行できます。

```python
from typing import TypedDict
from langgraph.graph import StateGraph, START, END

# 1. State の定義（全ノードがやり取りする型）
class SimpleState(TypedDict):
    text: str

# 2. Node の定義（State を受け取り、更新する dict を返す）
def step_a(state: SimpleState) -> dict:
    return {"text": state["text"] + " -> Node A"}

def step_b(state: SimpleState) -> dict:
    return {"text": state["text"] + " -> Node B"}

# 3. Graph の構築
builder = StateGraph(SimpleState)
builder.add_node("node_a", step_a)
builder.add_node("node_b", step_b)

# 4. Edge の接続（START -> node_a -> node_b -> END）
builder.add_edge(START, "node_a")
builder.add_edge("node_a", "node_b")
builder.add_edge("node_b", END)

# 5. コンパイルして実行
graph = builder.compile()
result = graph.invoke({"text": "Start"})

print("実行結果:", result)
# 出力: 実行結果: {'text': 'Start -> Node A -> Node B'}
```

### Reducer の重要性：上書きか、蓄積か

LangGraphで初心者が最もつまずきやすいのが **Reducer** です。

Stateのフィールドに型だけを書いた場合、後から実行されたノードの値によって**上書き**されます。一方で、ログやメッセージ履歴のように「リストに追記したい」場合は、`Annotated[型, operator.add]` を使って合成方法を宣言します。

そのまま動かして挙動の差を確かめてみましょう。

```python
from typing import Annotated, TypedDict
import operator
from langgraph.graph import StateGraph, START, END

class ReducerState(TypedDict):
    # reducer なし: 新しい値で上書きされる
    current_step: str
    # reducer あり (operator.add): リストが結合されて蓄積される
    logs: Annotated[list[str], operator.add]

def worker_1(state: ReducerState) -> dict:
    return {"current_step": "Step 1 完了", "logs": ["worker_1 が処理しました"]}

def worker_2(state: ReducerState) -> dict:
    return {"current_step": "Step 2 完了", "logs": ["worker_2 が処理しました"]}

builder = StateGraph(ReducerState)
builder.add_node("w1", worker_1)
builder.add_node("w2", worker_2)
builder.add_edge(START, "w1")
builder.add_edge("w1", "w2")
builder.add_edge("w2", END)

app = builder.compile()
result = app.invoke({"current_step": "初期状態", "logs": ["開始"]})

print("current_step (上書き):", result["current_step"])
print("logs (追記・蓄積):", result["logs"])
# 出力:
# current_step (上書き): Step 2 完了
# logs (追記・蓄積): ['開始', 'worker_1 が処理しました', 'worker_2 が処理しました']
```

---

## 4. 現場で使えるワークフロー制御パターン

LangGraphは、LLMを組み込んだ高度なワークフローパイプラインを驚くほど明快に表現できます。

![ワークフローアーキテクチャ図](https://raw.githubusercontent.com/lumichy/Qiita/main/public/langgraph-agent-guide-2026/architecture.png)

### パターン1: Routing（条件分岐）

入力内容に応じて次の行き先を振り分けるパターンです。分岐関数（`route_by_intent`）が文字列を返し、その文字列に対応するノードへ遷移します。

```python
from typing import Literal, TypedDict
from langgraph.graph import StateGraph, START, END

class RouteState(TypedDict):
    query: str
    response: str

def classifier(state: RouteState) -> dict:
    # 実際にはここでLLMで意図分類を行う
    return {}

def route_by_intent(state: RouteState) -> Literal["tech_support", "billing_support"]:
    if "料金" in state["query"] or "請求" in state["query"]:
        return "billing_support"
    return "tech_support"

def tech_support(state: RouteState) -> dict:
    return {"response": "技術サポート窓口です。エラーログを確認してください。"}

def billing_support(state: RouteState) -> dict:
    return {"response": "請求窓口です。ご契約プランの確認を行えます。"}

builder = StateGraph(RouteState)
builder.add_node("classifier", classifier)
builder.add_node("tech_support", tech_support)
builder.add_node("billing_support", billing_support)

builder.add_edge(START, "classifier")
builder.add_conditional_edges("classifier", route_by_intent, ["tech_support", "billing_support"])
builder.add_edge("tech_support", END)
builder.add_edge("billing_support", END)

router_app = builder.compile()

print(router_app.invoke({"query": "APIの料金プランを教えてください", "response": ""}))
# 出力: {'query': 'APIの料金プランを教えてください', 'response': '請求窓口です。ご契約プランの確認を行えます。'}
```

### パターン2: Parallelization（並列実行・集約）

複数のノードを同時に走らせ、Reducerで結合した後に集約ノードへ渡すパターンです。

```python
from typing import Annotated, TypedDict
import operator
from langgraph.graph import StateGraph, START, END

class ParallelState(TypedDict):
    topic: str
    results: Annotated[list[str], operator.add]
    summary: str

def search_web(state: ParallelState) -> dict:
    return {"results": [f"Web検索結果: {state['topic']} は急成長中です"]}

def search_internal_db(state: ParallelState) -> dict:
    return {"results": [f"社内DB結果: {state['topic']} に関する案件が3件あります"]}

def aggregate(state: ParallelState) -> dict:
    combined = " / ".join(state["results"])
    return {"summary": f"集約レポート: [{combined}]"}

builder = StateGraph(ParallelState)
builder.add_node("search_web", search_web)
builder.add_node("search_internal_db", search_internal_db)
builder.add_node("aggregate", aggregate)

# START から両ノードへエッジを引くと並列実行される
builder.add_edge(START, "search_web")
builder.add_edge(START, "search_internal_db")

# 両方の完了を待って集約ノードへ
builder.add_edge(["search_web", "search_internal_db"], "aggregate")
builder.add_edge("aggregate", END)

parallel_app = builder.compile()
print(parallel_app.invoke({"topic": "AIエージェント", "results": [], "summary": ""}))
```

### パターン3: Orchestrator-Worker（`Send` API による動的ファンアウト）

「入力された章の数だけ並列にワーカーを起動したい」という場合、LangGraphでは **`Send` API** を使用します。

```python
from typing import Annotated, TypedDict
import operator
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send

class ReportState(TypedDict):
    theme: str
    sections: list[str]
    section: str
    contents: Annotated[list[str], operator.add]

def planner(state: ReportState) -> dict:
    # テーマに応じて章を決定
    return {"sections": ["導入", "アーキテクチャ解説", "まとめ"]}

def orchestrator(state: ReportState):
    # 各章ごとに worker ノードへの Send オブジェクトを動的生成
    return [Send("worker", {"section": s}) for s in state["sections"]]

def worker(state: ReportState) -> dict:
    return {"contents": [f"## {state['section']}\n内容の執筆完了"]}

builder = StateGraph(ReportState)
builder.add_node("planner", planner)
builder.add_node("worker", worker)

builder.add_edge(START, "planner")
builder.add_conditional_edges("planner", orchestrator, ["worker"])
builder.add_edge("worker", END)

app = builder.compile()
res = app.invoke({"theme": "LangGraph", "sections": [], "section": "", "contents": []})
print("生成された章一覧:\n" + "\n".join(res["contents"]))
```

### パターン4: Evaluator-Optimizer（自己修正ループ）

生成ノードと評価ノードを行き来させ、品質基準を満たすまでループするパターンです。無限ループを防ぐため、**最大試行回数ガード**をStateに持たせるのが鉄則です。

```python
from typing import Literal, TypedDict
from langgraph.graph import StateGraph, START, END

class CodeGenState(TypedDict):
    code: str
    test_passed: bool
    attempts: int

def generator(state: CodeGenState) -> dict:
    attempt = state.get("attempts", 0) + 1
    # 2回目の生成で合格コードを出すシミュレーション
    code = "print('Hello World')" if attempt >= 2 else "print('bug')"
    return {"code": code, "attempts": attempt}

def evaluator(state: CodeGenState) -> dict:
    passed = "Hello World" in state["code"]
    return {"test_passed": passed}

def check_result(state: CodeGenState) -> Literal["generator", "__end__"]:
    if state["test_passed"] or state["attempts"] >= 3:
        return END
    return "generator"

builder = StateGraph(CodeGenState)
builder.add_node("generator", generator)
builder.add_node("evaluator", evaluator)

builder.add_edge(START, "generator")
builder.add_edge("generator", "evaluator")
builder.add_conditional_edges("evaluator", check_result, ["generator", END])

optimizer_app = builder.compile()
print(optimizer_app.invoke({"code": "", "test_passed": False, "attempts": 0}))
# 出力: {'code': "print('Hello World')", 'test_passed': True, 'attempts': 2}
```

---

## 5. 自律型ReActエージェント（Tool Calling）の実装

LLMが思考し、自ら外部ツールを呼び出して結果を反映するReActエージェントは、ビルトインの `ToolNode` と `tools_condition` を組み合わせることで構築できます。

```python
from langchain.chat_models import init_chat_model
from langchain_core.tools import tool
from langgraph.graph import MessagesState, StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition

# 1. 外部ツールの定義
@tool
def calculate_tax(price: int) -> int:
    """指定された金額の税込価格（10%）を計算して返します"""
    return int(price * 1.10)

tools = [calculate_tax]

# 2. モデルにツールをバインド
llm = init_chat_model("gpt-4o-mini", model_provider="openai", temperature=0)
llm_with_tools = llm.bind_tools(tools)

# 3. エージェントノードの定義
def agent_node(state: MessagesState) -> dict:
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

# 4. グラフの構築（MessagesState は messages リストを自動管理）
builder = StateGraph(MessagesState)
builder.add_node("agent", agent_node)
builder.add_node("tools", ToolNode(tools))

builder.add_edge(START, "agent")

# LLMがツール実行を要求した場合は "tools" へ、通常テキストなら END へ分岐
builder.add_conditional_edges("agent", tools_condition)
builder.add_edge("tools", "agent")  # ツール実行結果を持って再度 agent へ戻る

react_agent = builder.compile()

# 実行
query = {"messages": [("user", "5000円の税込価格を計算してください")]}
result = react_agent.invoke(query)
print("エージェント回答:", result["messages"][-1].content)
```

> **Tip**: 実は上記の構成は、LangGraphが提供するユーティリティ `create_react_agent(llm, tools)` を呼び出すだけで1行で生成することも可能です。仕組みを理解した後はそちらを使うとコード量を削減できます。

---

## 6. 実務で必須となる「記憶」の設計（短期・長期）

### 短期メモリ：Checkpointer と `thread_id`

会話スレッドごとに文脈を保持するには、コンパイル時に `checkpointer` を渡し、呼び出し時に `thread_id` を指定します。

```python
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import MessagesState, StateGraph, START, END

# モックLLMノード（APIキー不要で動作検証可能）
def chatbot(state: MessagesState) -> dict:
    last_msg = state["messages"][-1].content
    return {"messages": [{"role": "ai", "content": f"了解しました: {last_msg}"}]}

builder = StateGraph(MessagesState)
builder.add_node("chatbot", chatbot)
builder.add_edge(START, "chatbot")
builder.add_edge("chatbot", END)

# チェックポインタを渡してコンパイル
app = builder.compile(checkpointer=InMemorySaver())

# スレッド 1 で会話
cfg_1 = {"configurable": {"thread_id": "session-user-1"}}
app.invoke({"messages": [{"role": "user", "content": "私の好物はラーメンです"}]}, cfg_1)

# スレッド 1 の状態を確認（会話履歴が保持されている）
snapshot = app.get_state(cfg_1)
for m in snapshot.values["messages"]:
    print(f"{m.type}: {m.content}")

# スレッド 2 で実行してもスレッド 1 の履歴は干渉しない
cfg_2 = {"configurable": {"thread_id": "session-user-2"}}
res_2 = app.invoke({"messages": [{"role": "user", "content": "こんにちは"}]}, cfg_2)
print("スレッド2の件数:", len(res_2["messages"]))  # 2件（分離されている）
```

本番運用では `InMemorySaver` を `PostgresSaver` や `RedisSaver` に差し替えるだけで、ステートレスなAPIサーバー環境でも安全に永続化できます。

### 長期メモリ：Store によるユーザー知識の永続化

会話スレッドがリセットされても、ユーザーの好みやプロファイルを保持し続けたい場合は **Store** を使います。

```python
from langgraph.store.memory import InMemoryStore

# メモリストアの初期化
store = InMemoryStore()

# ("users", "alice") という namespace にプロファイルを格納
store.put(("users", "alice"), "profile", {"preferred_lang": "Python", "experience": "3年"})

# 別のセッションから取得
stored_data = store.get(("users", "alice"), "profile")
print("長期メモリから取得:", stored_data.value)
# 出力: 長期メモリから取得: {'preferred_lang': 'Python', 'experience': '3年'}
```

---

## 7. 人間が介入する「Human-in-the-loop」（Interrupts）

エージェントを本番運用する上で最も重要な「人間の承認待ち」フローです。

LangGraphの **`interrupt()`** は、呼び出された瞬間にグラフの実行を中断し、Stateをチェックポインタに完全保存します。その後、人間が確認して `Command(resume=...)` を送ることで、安全に再開できます。

以下のコードは単体でそのまま動きます。

```python
from typing import Literal, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt, Command
from langgraph.checkpoint.memory import InMemorySaver

class ApproveState(TypedDict):
    action: str
    answer: str
    result: str

def ask_human(state: ApproveState) -> dict:
    # ここで実行が中断！引数のテキストが人への質問になる
    human_answer = interrupt(f"操作「{state['action']}」を実行しますか？ (yes/no)")
    return {"answer": str(human_answer).strip().lower()}

def route_decision(state: ApproveState) -> Literal["do_action", "cancel"]:
    return "do_action" if state["answer"] in ("yes", "y") else "cancel"

def do_action(state: ApproveState) -> dict:
    return {"result": f"【成功】{state['action']} を実行しました"}

def cancel(state: ApproveState) -> dict:
    return {"result": f"【中止】{state['action']} をキャンセルしました"}

builder = StateGraph(ApproveState)
builder.add_node("ask_human", ask_human)
builder.add_node("do_action", do_action)
builder.add_node("cancel", cancel)

builder.add_edge(START, "ask_human")
builder.add_conditional_edges("ask_human", route_decision, ["do_action", "cancel"])
builder.add_edge("do_action", END)
builder.add_edge("cancel", END)

# Interrupt には Checkpointer が必須
app = builder.compile(checkpointer=InMemorySaver())

config = {"configurable": {"thread_id": "approval-thread-1"}}

# 1. 実行すると interrupt() の位置で停止する
pending = app.invoke({"action": "本番データベースのテーブル削除", "answer": "", "result": ""}, config)
print("① 停止しました。人への質問:", pending["__interrupt__"][0].value)

# 2. 人間が承認して再開する
final_result = app.invoke(Command(resume="yes"), config)
print("② 再開後の最終結果:", final_result["result"])
```

承認待ちの間にサーバープロセスが再起動しても、DB（Postgres等）にStateが保存されているため、数日後に再開しても何の問題もありません。

---

## 8. 巻き戻しとデバッグ：「Time Travel」

「何ステップか進んだ後に、途中のパラメータを修正して別の世界線で再実行したい」という場合、LangGraphのタイムトラベル機能が威力を発揮します。

```python
from typing import Annotated, TypedDict
import operator
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import InMemorySaver

class TTState(TypedDict):
    text: str
    steps: Annotated[list[str], operator.add]

def step_1(state: TTState) -> dict:
    return {"steps": ["Step 1 実行"]}

def step_2(state: TTState) -> dict:
    return {"steps": ["Step 2 実行"]}

builder = StateGraph(TTState)
builder.add_node("step_1", step_1)
builder.add_node("step_2", step_2)
builder.add_edge(START, "step_1")
builder.add_edge("step_1", "step_2")
builder.add_edge("step_2", END)

tt_app = builder.compile(checkpointer=InMemorySaver())
cfg = {"configurable": {"thread_id": "tt-demo"}}

# 1. 通常実行
tt_app.invoke({"text": "Initial", "steps": []}, cfg)

# 2. 過去のチェックポイント履歴を取得
history = list(tt_app.get_state_history(cfg))
print(f"保存されたチェックポイント数: {len(history)}")

# step_1 完了時点（次に step_2 が控えている状態）を探す
target_checkpoint = next(s for s in history if s.next == ("step_2",))
print("巻き戻し先時点のデータ:", target_checkpoint.values)

# 3. 過去の状態に新しい値を注入して別の分岐を作成
new_branch = tt_app.update_state(target_checkpoint.config, {"steps": ["【タイムトラベルで差し替え】"]})

# 4. その地点から再開実行！
branch_result = tt_app.invoke(None, new_branch)
print("再開実行後の結果:", branch_result["steps"])
```

---

## 9. 本番運用のための耐障害性（RetryPolicy）

APIのレート制限やネットワークの一時的な切断に耐えるため、LangGraphではノード単位で自動リトライポリシーを設定できます。

以下は、「最初の2回は意図的に例外を投げ、3回目で成功するノード」を `RetryPolicy` で自動復旧させる実験コードです。そのまま実行して動作を確認できます。

```python
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.types import RetryPolicy

class ResilientState(TypedDict):
    status: str

# 試行回数をカウントするクロージャ
attempts = {"count": 0}

def flaky_service(state: ResilientState) -> dict:
    attempts["count"] += 1
    if attempts["count"] < 3:
        print(f"  [試行 {attempts['count']}] 一時エラーが発生しました... 再試行します")
        raise ConnectionError("一時的なネットワーク遮断")
    return {"status": f"試行 {attempts['count']} 回目で無事成功！"}

builder = StateGraph(ResilientState)
# ConnectionError を検知したら最大3回まで自動リトライ
builder.add_node(
    "flaky_service",
    flaky_service,
    retry_policy=RetryPolicy(max_attempts=3, retry_on=ConnectionError)
)
builder.add_edge(START, "flaky_service")
builder.add_edge("flaky_service", END)

resilient_app = builder.compile()

print("実行開始:")
result = resilient_app.invoke({"status": ""})
print("最終結果:", result)
# 出力:
#   [試行 1] 一時エラーが発生しました... 再試行します
#   [試行 2] 一時エラーが発生しました... 再試行します
# 最終結果: {'status': '試行 3 回目で無事成功！'}
```

---

## 10. 階層型Subagent（サブグラフ）によるエージェントのモジュール化

実務で複雑なエージェントを構築する際、すべての処理を1つの巨大なグラフに詰め込むと、状態管理が破綻してメンテナンスが困難になります。

LangGraphの最も洗練された機能の1つが **Subgraphs**（サブグラフ）です。

「**コンパイル済みのグラフは、そのまま別の親グラフのノードとして登録できる**」 という極めて強力な性質を持っています。これにより、専門の「子エージェント（Subagent）」を独立して開発・テストし、メインエージェントにパーツとして組み込む階層型アーキテクチャが自然に構築できます。

以下のコードは、子エージェント（リサーチ担当Subagent）を親エージェント（レポート作成担当）に組み込む完全な実行例です。

```python
from typing import TypedDict
from langgraph.graph import StateGraph, START, END

# --- 1. 子エージェント（Subagent: リサーチ専門グラフ）の定義 ---
class SubagentState(TypedDict):
    topic: str
    research_data: str

def fetch_facts(state: SubagentState) -> dict:
    return {"research_data": f"【{state['topic']}の調査データ】2026年にはAIエージェントが主流化"}

def analyze_facts(state: SubagentState) -> dict:
    return {"research_data": state["research_data"] + " -> 分析完了: 導入効果は30%向上"}

sub_builder = StateGraph(SubagentState)
sub_builder.add_node("fetch", fetch_facts)
sub_builder.add_node("analyze", analyze_facts)
sub_builder.add_edge(START, "fetch")
sub_builder.add_edge("fetch", "analyze")
sub_builder.add_edge("analyze", END)

# 子エージェントを単体でコンパイル（これ単体でユニットテストが可能！）
research_subagent = sub_builder.compile()

# --- 2. 親エージェント（Main Agent / 統括グラフ）の定義 ---
class ParentState(TypedDict):
    topic: str
    research_data: str  # 子エージェントと共有されるキー（自動マッピング）
    final_report: str

def review_and_format(state: ParentState) -> dict:
    return {
        "final_report": f"=== 最終レポート ===\nテーマ: {state['topic']}\n内容: {state['research_data']}\nステータス: 承認済"
    }

parent_builder = StateGraph(ParentState)

# ★ ここが核心: コンパイル済みの子エージェントをそのまま1つのノードとして登録！
parent_builder.add_node("research_agent", research_subagent)
parent_builder.add_node("writer_agent", review_and_format)

parent_builder.add_edge(START, "research_agent")
parent_builder.add_edge("research_agent", "writer_agent")
parent_builder.add_edge("writer_agent", END)

main_agent = parent_builder.compile()

# 実行
result = main_agent.invoke({"topic": "LangGraph活用法", "research_data": "", "final_report": ""})
print(result["final_report"])
# 出力:
# === 最終レポート ===
# テーマ: LangGraph活用法
# 内容: 【LangGraph活用法の調査データ】2026年にはAIエージェントが主流化 -> 分析完了: 導入効果は30%向上
# ステータス: 承認済
```

### Subagent設計の3大メリット

1. **完全な関心の分離**: 親Stateと子Stateで同名のキー（上記の `topic`, `research_data`）だけが自動的に受け渡され、子エージェント内部の細かな中間変数は親側に漏れ出しません。
2. **単体テストの容易性**: `research_subagent` を親から切り離して、子エージェント単体でモックや評価テストを回せます。
3. **チーム分担開発**: Aチームが「リサーチSubagent」、Bチームが「コーディングSubagent」を独立して開発し、最後に親グラフで1行で結合できます。

---

## 11. 機能逆引きチートシート

実装時に手元でさっと確認できる早見表です。

| 実装したい要件 | 使用する API / クラス | 実装のポイント |
|---|---|---|
| **順次実行** | `add_edge(A, B)` | 固定パイプラインの結合 |
| **条件分岐** | `add_conditional_edges(...)` | 分岐関数の戻り値と遷移先リストを定義 |
| **並列処理** | `START` から複数ノードへ `add_edge` | ファンイン時はリストで指定 |
| **動的ファンアウト** | `Send("node", payload)` | 実行時に生成したワーカー数分並列実行 |
| **ループ・自己改善** | 前のノードへ戻る条件エッジ | **最大ループ回数ガード**を必ずStateに持たせる |
| **値の蓄積・追記** | `Annotated[list, operator.add]` | Reducerでリストを自動マージ |
| **会話履歴の管理** | `MessagesState` / `add_messages` | メッセージIDに基づくスマートな上書き・追加 |
| **ツール呼び出し** | `bind_tools` + `ToolNode` | `create_react_agent` なら1行で構成可能 |
| **スレッド内記憶**（短期） | `InMemorySaver` / `PostgresSaver` | 実行時に `thread_id` を指定 |
| **横断記憶**（長期） | `InMemoryStore` / `BaseStore` | ノードの引数に `store` を追加してアクセス |
| **人間の承認待ち** | `interrupt()` + `Command(resume=...)` | グラフが中断し、再開時に値を注入 |
| **過去の状態修正** | `get_state_history` + `update_state` | チェックポイントを指定してタイムトラベル |
| **階層型Subagent** | コンパイル済みグラフを `add_node` | サブグラフとして独立開発・親子でキーを共有 |
| **リアルタイム出力** | `graph.stream(..., stream_mode=...)` | `"updates"`, `"values"`, `"messages"` を使い分け |
| **障害復旧・リトライ** | `RetryPolicy` | ノード登録時に `retry_policy` を設定 |
| **宣言的記述** | `@entrypoint` / `@task` | グラフを定義せず関数デコレータで記述可能（Functional API） |

---

## 12. まとめと今後の展望

スクラッチで「lumichy-agent」を作った経験からLangGraphに触れて感じたのは、「**エージェント開発で誰もが直面する泥臭い課題が、すべて計算し尽くされた抽象化で解決されている**」という圧倒的な完成度です。

自作の経験があるからこそ、「なぜStateが必要なのか」「なぜReducerが必要なのか」「なぜCheckpointerが分離されているのか」が手に取るように理解できます。

- **仕組みの学習・研究・極限の軽量化** → 自作スクラッチエージェント
- **実務・本番プロダクトでの堅牢な運用** → LangGraph

という使い分けが、現時点でのベストプラクティスだと確信しています。

### さらなる上級応用に向けて

今回は単一グラフからSubagent（サブグラフ）の基礎〜実践機能までを紹介しましたが、LangGraphの可能性はさらに広がっています。

- **階層型マルチエージェント協調**（Multi-Agent Supervisor）: LLMによる動的ルーティングと複数Subagentの自律調停
- **分散実行とステート永続化**（PostgresSaver / RedisSaver）: 本番Kubernetesクラスタ上での耐障害性アーキテクチャ
- **LangGraph Platform / Studio**: ローカルGUIでのグラフ可視化・ブレークポイント設定・デバッグ環境

これらの高度なマルチエージェント協調や開発基盤についても、今後の記事でじっくり掘り下げて解説する予定です。ぜひ楽しみにお待ちください。

---

> **参考リソース:**
> - [LangGraph 公式ドキュメント](https://docs.langchain.com/oss/python/langgraph/overview)
> - [自作エージェント解説記事：lumichy-agent](https://qiita.com/lumichy/items/a267b3148b914dce376a)

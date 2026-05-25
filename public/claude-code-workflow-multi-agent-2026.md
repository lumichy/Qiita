---
title: MCPとSkillsに続く第3の革命：Claude Code WorkflowがultraworkでAgentをコードに焼き付ける
tags:
  - AI
  - claudecode
  - Agent
  - LLM
  - workflow
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: false
---

# MCPとSkillsに続く第3の革命：Claude Code WorkflowがultraworkでAgentをコードに焼き付ける

![cover](https://raw.githubusercontent.com/lumichy/Qiita/main/public/claude-code-workflow-multi-agent-2026/cover.png)

Anthropicが`claude-code@v2.1.47`のChangeLogにこっそり追加し、直後に削除した機能がある。

ChangeLogから消えたにも関わらず、コード本体からは削除されていない。現在も動作する。そしてAnthropic公式ドキュメントにも、まだ一行も記載がない——。

それが、**Workflow（ワークフロー）** 機能だ。

MCP（Model Context Protocol）が「AIに手足を与えた」、Skillsが「AIに作業手順書を与えた」とするなら、Workflowは「**AIのチームワークを固定コードとして結晶化させる**」機能だ。これは、MCP以来最大の破壊的イノベーションになる。

この記事では、Workflowの有効化方法、実戦演示、他機能との差異、そして6種類の形態を図解で完全解説する。

---

## クイックリファレンス

| 項目 | 内容 |
|------|------|
| 対応バージョン | `claude-code@v2.1.47` / `v2.1.48` 以降 |
| 有効化方法 | `export CLAUDE_CODE_WORKFLOWS=1` |
| 呼び出しキーワード | `ultrawork`（入力後に彩色グラデーション表示） |
| 記述言語 | JavaScript（自動生成 or 手動作成） |
| スクリプト保存期間 | デフォルト3日（ユーザーパスに移動で永続化） |
| 公式ドキュメント | **未掲載**（2025年5月現在） |
| 競合概念 | MCP、Skills、Subagent、Agent Teams |

---

## 1. Workflow機能の有効化

方法は拍子抜けするほどシンプルだ。

```bash
# Step 1: 環境変数を明示的に有効化
export CLAUDE_CODE_WORKFLOWS=1

# Step 2: Claude Codeを起動
claude
```

起動後、プロンプトで `ultrawork` と入力すると、そのキーワードが**彩色グラデーション**に変化する。これがWorkflow機能が有効である視覚的な証拠だ。

:::note info
`export` は現在のセッションにのみ適用される。永続化したい場合は `~/.bashrc` または `~/.zshrc` に追記しておくこと。
:::

---

## 2. 実戦演示：PRコードレビューWorkflow

### プロンプト例

```
ultrawork 現在のPRに対してmulti-agentのreview workflowを生成して実行してください
```

### 何が起きるか

Claude Codeは以下のシーケンスを自動実行する：

1. **設計フェーズ**：Workflowの全体設計を宣言（「3段階のレビューWorkflowを構築します」）
2. **コンテキスト生成**：`context.md` をプロジェクトパスに自動生成
3. **スクリプト自動作成**：300行超のJavaScriptコードを自動記述
4. **並列実行開始**：複数の専門レビュアーAgentが同時起動

```javascript
// Workflowスクリプトの構造（自動生成例）
export default {
  name: "PR Multi-Agent Review",
  description: "コードレビュー・セキュリティ検査・パフォーマンス分析を並列実行",
  
  stages: [
    {
      name: "Review",      // ← フェーズ1：並列レビュー
      parallel: true,
      agents: [/* ... */]
    },
    {
      name: "Validation",  // ← フェーズ2：相互検証
      /* ... */
    },
    {
      name: "Report",      // ← フェーズ3：統合レポート生成
      /* ... */
    }
  ]
};
```

`Ctrl + O` でスクリプトを展開し、リアルタイムで内容を確認できる。

### 進捗の追跡

```bash
/workflows
```

このコマンドで、実行中の全Agentの状態・処理時間・消費Token・呼び出したツール一覧をリアルタイム確認できる。**これがWorkflowの最大の強みの一つ**——ブラックボックスにならない透明性だ。

---

## 3. MCP・Skills・Subagentとの根本的な違い

Workflow登場以前から存在する類似機能との差異を整理しておく。

| 機能 | 起動方法 | 複用性 | 追跡性 | 固定化 |
|------|---------|--------|--------|--------|
| **Subagent** | 自然言語で即時 | ❌ 使い捨て | ❌ なし | ❌ なし |
| **Agent Teams** | 自然言語 + 人間主導 | △ 限定的 | △ 手動 | ❌ なし |
| **Skills** | モデルが自動発見 | ✅ 高い | ❌ なし | △ Prompt固定 |
| **Workflow** | `ultrawork` 明示指定 | ✅ 非常に高い | ✅ `/workflows` | ✅ JSスクリプト |

### Subagentとの違い

Subagentは「主AgentがサブAgentを一時的に派生させる」仕組みだ。自然言語一行で起動できるが、**同じ処理を再現することができない**。毎回微妙に異なる動作になる。

```
# Subagent（再現性なし）
このファイルをレビューして → Agent起動 → 結果返却 → 終了（ロストする）
```

Workflowは「流れをJavaScriptコードとして固定」する。他のチームメンバーがスクリプトをコピーするだけで、**全く同じ精度の処理が再現できる**。

### Skillsとの違い

Skillsは「大モデルが文脈に応じて自動発見・自動発火するベストプラクティス文書」だ。対してWorkflowは：

- **明示的宣言**：`ultrawork` キーワードで手動トリガー
- **構造固定**：JSスクリプトでステージ・Agent数・順序を確定
- **品質管理可能**：Evaluator-Optimizerパターンで自動品質チェックを組み込める

:::note warn
**本質的な違いを一言で言えば**：
Skillsは「AIに賢い振る舞いを教える」、Workflowは「AIのチームワークをコードに焼き付ける」。
:::

---

## 4. Workflowスクリプトの3大必須要素

最小構成のWorkflowスクリプトには、以下の3要素が必要だ：

```javascript
export default {
  // ① メタデータ（name と description は必須）
  name: "My Workflow",
  description: "このワークフローの説明",

  // ② Agentの呼び出し（少なくとも1回必要）
  stages: [
    {
      name: "Process",
      run: async (ctx) => {
        const result = await ctx.runAgent({
          prompt: "タスクの指示をここに書く"
        });
        return result;
      }
    }
  ],

  // ③ return による結果の返却（必須）
  output: (results) => results
};
```

この3要素を満たせば、どれだけ複雑な処理も構造化できる。

---

## 5. Workflowが支援する6種類の形態

Workflowが対応する6種類のパターンを、それぞれのユースケースとともに解説する。

### ① Pipeline（流水線）

![Pipeline Workflow](https://raw.githubusercontent.com/lumichy/Qiita/main/public/claude-code-workflow-multi-agent-2026/workflow-pipeline.png)

最も基本的な形態。**前段の出力が次段の入力**となる直列処理だ。各Agentが専門性を持ち、バトンを渡していく。

- **適したユースケース**：コードレビュー → 脆弱性検査 → レポート生成
- **特徴**：シンプルで予測可能、デバッグが容易
- **注意点**：どこか1ステージで詰まると全体が止まる

---

### ② Parallel（同期聚合）

![Parallel Workflow](https://raw.githubusercontent.com/lumichy/Qiita/main/public/claude-code-workflow-multi-agent-2026/workflow-parallel.png)

Orchestratorが複数のWorker Agentに**タスクを同時分散**し、全完了後に結果を集約する形態。

- **適したユースケース**：コードレビュー + セキュリティ検査 + パフォーマンス分析を同時実行
- **特徴**：処理時間が大幅短縮（直列の1/N程度）
- **注意点**：集約ロジックが複雑になりやすい

---

### ③ Evaluator-Optimizer（対抗検証）

![Evaluator-Optimizer Workflow](https://raw.githubusercontent.com/lumichy/Qiita/main/public/claude-code-workflow-multi-agent-2026/workflow-evaluator.png)

**生成AgentとEvaluator Agentが対峙し、品質基準を満たすまでループ**する形態。GAN（敵対的生成ネットワーク）の発想をWorkflowに持ち込んだものだ。

- **適したユースケース**：テストが通るまでコードを自動修正、品質基準を満たすまでドキュメントを書き直す
- **特徴**：人手を介さずに自動で品質を引き上げる
- **注意点**：無限ループを防ぐための最大反復回数の設定が重要

---

### ④ Routing（ルーティング）

![Routing Workflow](https://raw.githubusercontent.com/lumichy/Qiita/main/public/claude-code-workflow-multi-agent-2026/workflow-routing.png)

RouterがInputの種類を判断し、**最適な専門Agentへ振り分ける**形態。

- **適したユースケース**：バグ報告 → Bug Fix Agent、機能追加要望 → Feature Agent、ドキュメント依頼 → Docs Agent
- **特徴**：専門性の最大化、汎用Agentより高品質な出力
- **注意点**：分類精度がシステム全体の品質に直結する

---

### ⑤ Orchestrator-Workers（累積式）

![Orchestrator-Workers Workflow](https://raw.githubusercontent.com/lumichy/Qiita/main/public/claude-code-workflow-multi-agent-2026/workflow-orchestrator.png)

Orchestratorが全体計画を立案し、**動的にWorkerを割り当てながら結果を蓄積していく**形態。

- **適したユースケース**：大規模リポジトリのリファクタリング、複数ファイルにまたがるバグ修正
- **特徴**：Orchestratorが進捗に応じてプランを調整できる柔軟性
- **注意点**：Orchestrator自体の判断品質が全体を左右する

---

### ⑥ Nested（嵌套式）

![Nested Workflow](https://raw.githubusercontent.com/lumichy/Qiita/main/public/claude-code-workflow-multi-agent-2026/workflow-nested.png)

**WorkflowがWorkflowを呼び出す**再帰的な構造。大きな問題を小さなWorkflowに分解し、それぞれが独自のAgent群を持つ。

- **適したユースケース**：ディープリサーチ（[検索WF] + [検証WF] + [合成WF] → 最終レポート）
- **特徴**：極めて複雑なタスクを整理された構造で処理できる
- **注意点**：深さが増すほどデバッグが難しくなる。階層は3層以内を推奨

---

## 6. 適用シーン

Workflowが特に力を発揮する場面を整理する。

| シーン | 推奨パターン | 効果 |
|--------|------------|------|
| 多次元コードレビュー | Parallel + Pipeline | 複数観点を同時に、段階的に深化 |
| クロスドメイン調査 | Nested + Parallel | 独立した調査を並列実施して統合 |
| 設計案の探索 | Parallel + Evaluator | 複数案を生成し品質で絞り込む |
| バグ・脆弱性スキャン | Orchestrator-Workers | 大量ファイルを動的分散処理 |
| 多ファイルリファクタリング | Pipeline + Routing | 順序立てて、種別ごとに専門処理 |
| 多言語ドキュメント翻訳 | Parallel | 言語ごとのAgentを同時起動 |

---

## 7. スクリプトの永続化と共有

Workflowスクリプトのデフォルト保存期間は**3日間**だ。有効期限が来ると自動削除される。

本番環境で継続利用したい場合は、ユーザーレベルのパスに移動する：

```
# Claude Codeに自然言語で指示するだけでOK
このWorkflowスクリプトをユーザーパスにコピーして永続保存してください
```

永続保存したスクリプトは：
- 次回以降も直接呼び出し可能
- チームメンバーへのコピーで**全く同じWorkflowを再現可能**
- GitHubにコミットしてオープンソース化できる

これが今後「GitHub上に成千上万のWorkflowオープンソースプロジェクトが現れる」と予測する理由だ。

---

## まとめ

Workflowは「自然言語のプロンプトで記述してきたAIへの指示」を、**再現可能・追跡可能・品質管理可能なJavaScriptコードに昇華させる**機能だ。

- **MCP**が「AIに何ができるか」を定義し
- **Skills**が「AIにどうやるかを教え」
- **Workflow**が「AIのチームワークをコードに固定する」

3つが揃って初めて、真の意味での**Harness Engineering**——AIのポテンシャルを制御・再現・最大化するエンジニアリング——が実現する。

Anthropicが公式ドキュメントへの掲載を準備しているとすれば、それはWorkflowがまだ「熟成中」だからかもしれない。だからこそ、今がいち早く習得する絶好のタイミングだ。

あなたのチームが今最も繰り返している「AI作業」は何だろうか。それがWorkflow化の最初の候補だ。ぜひコメントで教えてほしい。

---

## 参考

- [Anthropic Claude Code 公式ドキュメント](https://docs.anthropic.com/claude/docs/claude-code)
- [Claude Code Changelog (v2.1.47)](https://github.com/anthropics/claude-code)
- 関連記事：[MCP vs Skills：AIエージェントの「手足」と「脳」](https://qiita.com/lumichy/items/9a76d579704434dcdbaa)

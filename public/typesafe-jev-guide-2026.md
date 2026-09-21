---
title: 文章を書かないAI「Jev」徹底解剖：70msで判断だけを返す仕組みと実践活用法
tags:
  - AI
  - LLM
  - TypeScript
  - Vercel
  - API
private: false
updated_at: '2026-09-21T13:44:52+09:00'
id: b95b3f127f452e126af7
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

![文章を書かないAI「Jev」の仕組み](https://raw.githubusercontent.com/lumichy/Qiita/main/public/typesafe-jev-guide-2026/cover.png)

「LLMに頼みたいのは文章の執筆ではなく、このエラーログがどのチームの管轄かという判断だけなのに、なぜ毎回長文のJSON出力を待たなければならないのか」

生成AIを本番システムの監視アラート、トリアージ基盤、あるいは自律エージェントの意思決定ループに組み込んだ経験があるエンジニアなら、誰もが一度はこの壁に直面したことがあるはずです。OpenAIのStructured OutputsやJSONモードを使えば出力形式こそ保証されますが、モデル内部では依然として1トークンずつ文字列を組み立てる自己回帰デコードが走っています。結果として数百ミリ秒から数秒の遅延が生じ、出力トークン課金もじわじわと積み上がります。

こうした生成AI特有のボトルネックを打破するアプローチとして登場したのが、米TypeSafe AI社が2026年9月に公開した **Jev**（System One Model）です。

Jevの核心は、「文章の生成を完全に放棄し、事前に定義された選択肢ごとの確率と確信度だけを返す」ことに特化した点にあります。応答速度は公称 **70〜500ms**、入力100万トークンあたりわずか **0.042ドル**、そして出力トークンという概念自体が存在しないため **出力課金は完全無料** です。

本記事では、話題のJevが従来のLLMと何が違うのか、なぜ桁違いに速くて安価に動作するのかを仕組みレベルで解明します。さらに、SaaSのインシデントトリアージを題材にした実用コード、curlによる本家API・Vercel AI Gatewayの実機呼び出し手順、そしてプログラム・Jev・LLMを組み合わせた三位一体のハイブリッドアーキテクチャまでを包括的に解説します。

---

## 1. 手書きの報告書 vs コックピットの計器盤：Jev の本質を直感的に掴む

Jevの動作思想を最も鮮明に表すメンタルモデルが、「手書きの報告伝票と、航空機コックピットの計器盤」の対比です。

従来のLLMを使った分類やルーティングは、いわば **現場担当者がペンを走らせる「手書きの報告書」** です。たとえば本番環境で「DB接続数が上限に達し、決済APIで504エラーが頻発している」という障害が発生し、担当オンコール班（`database`, `backend`, `sre`, `security`）を自動決定したい場面を考えます。開発者はプロンプトに次のような制約を課してきました。

> 「次のアラートログを解析し、最初に対応すべき班を `{"target_team": "..."}` のJSON形式のみで出力してください。余計な解説は不要です。」

この指示を受けたLLMの内部では、`{`、`"target_team"`、`:`、`"database"`、`}` と、1トークンずつ文脈確率を計算しながらテキストを書き連ねる処理が行われます。プログラム側は返ってきた文字列を受け取り、文字化けや欠落がないか慎重に解読（JSONパース）し、キーが存在するか型バリデーションを行い、ようやく次のパイプラインへ引き渡します。

![手書きの報告書とコックピット計器盤の比較](https://raw.githubusercontent.com/lumichy/Qiita/main/public/typesafe-jev-guide-2026/fig1-essay-vs-marksheet.png)

これに対してJevは、**「コックピットの警告インジケーター（計器盤）」** そのものです。

航空機のコックピットでは、エンジン油圧の異常が起きたとき、誰かが紙に「油圧が低下しています」と文章を書いてパイロットに渡したりはしません。あらかじめ盤面に配線された計器のランプが点灯し、針がビシッと振れることで、電気信号として瞬時に状況を伝えます。

Jevもまったく同じアプローチを採っています。
オーケストレーター（プログラム）があらかじめ計器盤（選択肢の枠組み）を提示しておき、Jevはそのすべての計器に対して「どれくらいの強さ（確率）で針を振るか」を一度に通電（フォワードパス計算）して返します。

この設計がもたらすアーキテクチャ上のメリットは、次の3点に集約されます。

1. **テキスト生成ループ（Autoregressive Loop）の完全撤廃**: 文章を1文字ずつ作文するプロセスが存在しないため、モデルの計算がたった1パスのフォワードパスで完了し、70msという超低遅延を叩き出します。
2. **型エラー発生率が物理的に 0%**: あらかじめ配線された計器の針を振るだけなので、想定外のラベルが出力されたりJSON構文が壊れたりする余地がそもそも存在しません。パーサーを構えて「構文エラーが起きないか」と怯える必要は皆無です。
3. **全候補の確率分布が同時に手に入る**: 単一の正解ラベルを無理やり1つに絞り込むのではなく、「database: 0.81」「backend: 0.14」のように全計器の振れ幅が同時に得られるため、コード側でグラデーションを持った精密な分岐ロジックを組むことができます。

AIに作文をさせず、配線された計器盤に直接シグナル（確率）を流し込むこと。これこそがJevの本質です。

---

## 2. state と questions の入出力モデル

Jevへのリクエストは、極めてシンプルな2つの要素で成り立っています。

- **state**: 判断の文脈となる入力データ。自然言語のテキストはもちろん、監視システムのアラートJSONやログオブジェクトをそのまま渡せます。
- **questions**: stateに対して評価したい型付きの「問い」。

![stateとquestionsの入出力モデル](https://raw.githubusercontent.com/lumichy/Qiita/main/public/typesafe-jev-guide-2026/fig2-state-and-questions.png)

### 3つの型（Question Types）

Jevでは、目的に応じて以下の3種類の型から質問を組み立てます。

| 型名 | 用途 | 返却されるデータ |
|:---|:---|:---|
| **Choice** | 複数の選択肢から1つを選択（担当チーム振り分け、カテゴリ分類など） | 最有力候補、全選択肢の確率分布、確信度（confidence） |
| **Score** | 段階評価（インシデント深刻度、不満度、優先度など） | 確率で重み付けした期待値スコア、各段階の確率分布、確信度 |
| **Noul** | Yes / No の二値判定（セキュリティ侵害の有無、スパム判定など） | Yesである確率（0.0 〜 1.0） |

特筆すべきは、**これら性質の異なる複数の問いを、1回のリクエストでまとめて並列評価できる点** です。

たとえば、先ほどの決済APIのデッドロック障害に対して、「セキュリティ攻撃の兆候はあるか（Noul）」「インシデントの深刻度（Score）」「初動対応チーム（Choice）」の3つの観点で同時に診断したい場合、リクエストは以下のようになります。

```json
{
  "model": "jev-latest",
  "state": {
    "alert": "HighCPUUtilization (>95%)",
    "service": "payment-api",
    "log": "Deadlock detected during batch settlement run",
    "env": "production"
  },
  "questions": {
    "is_security_risk": {
      "type": "noul",
      "instructions": "外部からの不正アクセスやDDoS攻撃、脆弱性攻撃の兆候はあるか"
    },
    "incident_severity": {
      "type": "score",
      "instructions": "インシデントの深刻度レベルを判定してください",
      "criteria": [
        "P3: 軽微な警告（業務影響なし）",
        "P2: 一部機能遅延（業務影響あり）",
        "P1: サービス全断（緊急対応必須）"
      ]
    },
    "oncall_team": {
      "type": "choice",
      "instructions": "初動対応を担当すべきオンコール班",
      "criteria": {
        "dba": "データベースのデッドロック、スロークエリ、コネクション枯渇",
        "sre": "インフラリソース、Kubernetesクラスタ、ネットワーク過負荷",
        "backend": "アプリケーションのロジックバグ、例外エラー",
        "security": "認証認可侵害、情報漏洩、不正アクセス"
      }
    }
  }
}
```

Jevからのレスポンスは以下のオブジェクトになります。

```json
{
  "model": "jev-latest",
  "answers": {
    "is_security_risk": {
      "type": "noul",
      "noul": 0.01
    },
    "incident_severity": {
      "type": "score",
      "score": 1.85,
      "legend": {
        "0": "P3: 軽微な警告（業務影響なし）",
        "1": "P2: 一部機能遅延（業務影響あり）",
        "2": "P1: サービス全断（緊急対応必須）"
      },
      "probabilities": {
        "0": 0.02,
        "1": 0.11,
        "2": 0.87
      },
      "confidence": 0.82
    },
    "oncall_team": {
      "type": "choice",
      "choice": "dba",
      "probabilities": {
        "dba": 0.81,
        "backend": 0.14,
        "sre": 0.04,
        "security": 0.01
      },
      "confidence": 0.79
    }
  }
}
```

ここで注目したいのが `incident_severity` の `score: 1.85` です。
離散的なラベルを1つ選ぶのではなく、各段階の確率（P1が87%、P2が11%）で重み付けされた連続値（期待値）が返ってくるため、「P2とP1の境界線上にあり、P1寄りの極めて深刻な状態である」というニュアンスが数値だけで即座に判別できます。

---

## 3. 不確実性を操る：確信度（Confidence）を活用した動的カスケード設計

実務においてJevを組み込む際、最大の武器となるのがレスポンスに含まれる **確信度（confidence）** です。

従来のLLMに「自分の判断にどれくらい自信があるか1〜10で答えて」と尋ねても、モデルは自分を客観視できず、常に高得点を返す傾向があります（Overconfidence問題）。また、APIが返す対数確率（`logprobs`）を利用しようとしても、JSONの構造トークン（`{`, `"`, `:`など）の確率が混ざり込んでしまい、判断対象のラベル単体に対する純粋な信頼度を取り出すのは至難の業でした。

これに対し、Jevのレスポンスに含まれる **確信度（confidence）** は、選択肢群のソフトマックス確率分布の「尖り具合（情報エントロピーの低さ）」を0.0〜1.0に数学的に正規化した指標です。さらに、Jevは確率の **キャリブレーション（Calibration）** を重視した学習を行っているため、「確信度0.90」と報告された判断を集めると、統計的におよそ9割が実際に正解となります。

この「AIが自身の不確実性を正確に把握している」という特性を活かすことで、単なる条件分岐を超えた **「動的モデルカスケード（Dynamic Model Cascade）」** という高度なシステム設計が可能になります。

![確信度ゲーティングによる動的カスケードパイプライン](https://raw.githubusercontent.com/lumichy/Qiita/main/public/typesafe-jev-guide-2026/fig3-confidence-gating.png)

### 3層カスケードのアーキテクチャ

上の図に示すように、Jevを第1ステージの「軽量ゲーティングゲート（門番）」として配置し、確信度のスコアに応じて後続の処理パイプラインを3つの階層へ動的に振り分けます。

1. **Fast-Path（即時自動実行パス / confidence ≥ 0.85）**:
   - 入力の約80〜90%を占める定型・自明なケース。
   - 人手を介さず、また重量級LLMも起動せず、Jevの70ms・$0.042という極小リソースのままDB更新やPagerDuty自動発報を即座に完了させます。
2. **Human-in-the-Loop（協調承認パス / 0.50 ≤ confidence < 0.85）**:
   - 2つの選択肢が拮抗している境界領域のケース。
   - 無理に自動化して事故を起こすのを防ぐため、Slackや管理画面に「上位2候補とそれぞれの確率」を提示し、人間のオペレーターにワンクリック承認を求めます。
3. **Deep Reasoning Fallback（深層推論モデルへの自動昇格 / confidence < 0.50）**:
   - 複合要因が絡む未知のエッジケース。
   - Jev単体で決め打ちせず、Chain-of-Thought（思考連鎖）が可能な重量級推論LLM（ClaudeやGPT-4.5、o3など）へ自動転送し、長文ログの深層解析を実行させます。

TypeScriptでのカスケードオーケストレーションの実装例は以下のようになります。

```typescript
interface JevAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

interface AlertEvent {
  id: string;
  payload: Record<string, any>;
  rawLogs: string;
}

async function handleIncidentCascade(event: AlertEvent, jevResult: JevAnswer) {
  const { choice, probabilities, confidence } = jevResult;

  // Layer 1: Fast-Path（高確信度 ➔ 70msで全自動完了）
  if (confidence >= 0.85) {
    console.log(`[Fast-Path] Alert ${event.id} auto-routed to ${choice} (conf: ${confidence})`);
    await executeAutomatedRouting(event.id, choice);
    return;
  }

  // Layer 2: Human-Assisted（中確信度 ➔ オペレーターへの確率付きサジェスト）
  if (confidence >= 0.50) {
    const topCandidates = Object.entries(probabilities)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2);

    console.log(`[Human-Assist] Alert ${event.id} requires approval. Candidates:`, topCandidates);
    await notifySlackForOneClickApproval(event.id, choice, topCandidates, confidence);
    return;
  }

  // Layer 3: Deep Reasoning Fallback（低確信度 ➔ 思考型重量級LLMへ昇格）
  console.warn(`[Deep-Fallback] Alert ${event.id} is complex (conf: ${confidence}). Escalating to Deep LLM.`);
  const deepAnalysis = await callHeavyweightReasoningLLM({
    systemPrompt: "You are a senior SRE diagnosing an ambiguous system incident.",
    context: event.rawLogs,
    jevCandidates: probabilities
  });
  await applyDeepRemediation(event.id, deepAnalysis);
}
```

このアーキテクチャの真価は、**「システム全体の平均レスポンスとコストをJev水準（ミリ秒・ほぼゼロコスト）に抑えつつ、難解なエッジケースでは重量級LLMの圧倒的な推論力を発揮させる」** という、速度・コスト・精度のトレードオフの完全な解消にあります。

---

## 4. 普通のLLMとの違いを仕組みレベルで解説

なぜJevはこれほど速く、安く、そして型エラーを起こさないのでしょうか。従来のLLM、Structured Outputs、専用分類モデルと比較しながら、内部メカニズムを整理します。

### アーキテクチャの比較表

| 比較項目 | 従来のLLM（自由文） | LLM + Structured Outputs | 専用分類モデル（BERT等） | TypeSafe Jev |
|:---|:---|:---|:---|:---|
| **出力データ** | 自然言語テキスト | 制約付きJSON文字列 | 固定クラスID | 型付き確率分布・確信度 |
| **生成メカニズム** | 自己回帰（1トークンずつループ） | 自己回帰（文法制約付きループ） | 単一フォワードパス（Softmax） | **単一フォワードパス（多質問並列）** |
| **事前学習 / 調整** | 不要（プロンプトのみ） | 不要（スキーマ指定のみ） | 大量の教師データによる学習必須 | **不要（自然言語で質問定義）** |
| **レイテンシ** | 800ms 〜 数秒 | 500ms 〜 数秒 | 数十ms | **70ms 〜 500ms** |
| **入力コスト** | 標準 | 標準 | 自前サーバーコスト | **極小（$0.042 / 1M tokens）** |
| **出力コスト** | 生成トークン課金 | 生成トークン課金 | なし | **完全無料（$0）** |
| **確率のキャリブレーション** | 不可（Logprobsは得られる） | 困難（JSON構造トークンが混在） | 手法依存 | **公式キャリブレーション済み** |

### なぜ自己回帰ループ（Autoregressive Loop）を捨てると速いのか

ChatGPTをはじめとする一般的なDecoder-Only言語モデルは、前に入力されたトークン列をもとに「次に来る1トークン」の確率を計算し、サンプリングした単語を文末に追加して、再びモデルに入力し直すという **自己回帰（Autoregressive）デコードループ** を実行します。

50トークンのJSONを出力する場合、モデルの全重みをメモリから読み出す処理（Memory Bandwidth Bound）を最低でも50回繰り返さなければなりません。どれほどサーバーのGPUが強力でも、このループ構造が根本的なレイテンシの壁となります。

一方、Jevは **出力をトークンとして生成しません**。
入力された `state` と `questions` をTransformerエンコーダーに通し、各問いの選択肢に対応する潜在表現のロジット（Logits）を計算してSoftmaxにかけるだけです。計算は **たった1回のフォワードパス（Forward Pass）** で完結します。

さらに、質問が複数あっても入力の自己注意（Self-Attention）計算を共有できるため、並列に答えを算出しても計算量が跳ね上がりません。これが、70msという驚異的なレスポンスと出力トークン課金ゼロの物理的な理由です。

---

## 5. 実践：curl による API 呼び出し実例

それでは、実際にJevを呼び出す具体的な手順を見ていきましょう。
現在、Jevは **TypeSafe AI 公式 API** と **Vercel AI Gateway** の2つの経路から利用可能です。接続先によってエンドポイントやヘッダー仕様、さらには一部の型名が異なるため、それぞれの正しいcurl呼び出し実例を整理します。

### 事前準備：APIキーの設定

使用するプロバイダに応じて環境変数を設定します。

```bash
# 公式 API を利用する場合
export TYPESAFE_API_KEY="sk-..."

# Vercel AI Gateway を利用する場合
export AI_GATEWAY_API_KEY="ey..."
```

```powershell
# PowerShell の場合
$env:TYPESAFE_API_KEY = "sk-..."
$env:AI_GATEWAY_API_KEY = "ey..."
```

---

### 実例①：TypeSafe AI 公式 API（本家）

公式APIのエンドポイントは `https://api.typesafe.ai/v1/systemone` です。
モデル名（`jev-latest`）はリクエストボディ内で指定し、Yes/No形式の問いには公式の正式型名である `"type": "noul"` を使用します。

リリース直前にクリティカルバグが発見された状況を題材に、トピック分類（Choice）、緊急度判定（Score）、対応要否（Noul）を1回で並列評価します。

```bash
curl -X POST https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $TYPESAFE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "jev-latest",
    "state": "The new system is scheduled to be released next month, but several critical bugs have been found during testing. It may be difficult to release the system on schedule. We need to decide how to proceed at tomorrow'\''s meeting.",
    "questions": {
      "topic": {
        "type": "choice",
        "instructions": "What is the main topic of this message?",
        "criteria": {
          "schedule": "Schedule or deadline",
          "quality": "Quality or bugs",
          "cost": "Cost or budget",
          "other": "Other topic"
        }
      },
      "urgency": {
        "type": "score",
        "instructions": "How urgent is this situation?",
        "criteria": [
          "Very low urgency",
          "Low urgency",
          "Moderate urgency",
          "High urgency",
          "Very high urgency"
        ]
      },
      "requires_action": {
        "type": "noul",
        "instructions": "Does this message require a specific action or decision?"
      }
    }
  }' | python -m json.tool
```

**返却されるレスポンス:**

```json
{
  "model": "jev-latest",
  "answers": {
    "topic": {
      "type": "choice",
      "choice": "schedule",
      "probabilities": {
        "schedule": 0.54,
        "quality": 0.43,
        "cost": 0.01,
        "other": 0.02
      },
      "confidence": 0.51
    },
    "urgency": {
      "type": "score",
      "score": 3.42,
      "legend": {
        "0": "Very low urgency",
        "1": "Low urgency",
        "2": "Moderate urgency",
        "3": "High urgency",
        "4": "Very high urgency"
      },
      "probabilities": {
        "0": 0.00,
        "1": 0.02,
        "2": 0.08,
        "3": 0.36,
        "4": 0.54
      },
      "confidence": 0.76
    },
    "requires_action": {
      "type": "noul",
      "noul": 0.98
    }
  },
  "usage": {
    "prompt_tokens": 84,
    "completion_tokens": 0
  }
}
```

注目すべき点として、レスポンスの `usage.completion_tokens` が **`0`** になっています。文章を一切生成しないため、出力トークンのカウントは常にゼロです。

---

### 実例②：Vercel AI Gateway 経由での呼び出し

Vercel AI Gatewayを利用する場合、エンドポイントは `https://ai-gateway.vercel.sh/v4/ai/evaluation-model` となります。
公式APIとは以下の重大な相違点があるため注意が必要です。

1. **モデル指定はヘッダーで行う**: リクエストボディではなく、専用ヘッダー `ai-model-id: typesafe-ai/jev` でモデルを指定します（ボディには `model` を含めません）。
2. **Yes/No型の名称は `"boolean"`**: 公式APIでは `"noul"` でしたが、Vercelのプロトコル仕様では **`"boolean"`** を要求します。
3. **専用プロトコルヘッダー**: `ai-gateway-protocol-version` や `ai-evaluation-model-specification-version` の付与が必要です。
4. **Zero Data Retention（ゼロデータ保持）**: `providerOptions` でログの非保持設定（`true` / `false`）を制御できます。

```bash
curl -X POST https://ai-gateway.vercel.sh/v4/ai/evaluation-model \
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -H "ai-gateway-protocol-version: 0.0.1" \
  -H "ai-gateway-auth-method: api-key" \
  -H "ai-evaluation-model-specification-version: 4" \
  -H "ai-model-id: typesafe-ai/jev" \
  -d '{
    "state": "The new system is scheduled to be released next month, but several critical bugs have been found during testing. It may be difficult to release the system on schedule. We need to decide how to proceed at tomorrow'\''s meeting.",
    "questions": {
      "topic": {
        "type": "choice",
        "instructions": "What is the main topic of this message?",
        "criteria": {
          "schedule": "Schedule or deadline",
          "quality": "Quality or bugs",
          "cost": "Cost or budget",
          "other": "Other topic"
        }
      },
      "urgency": {
        "type": "score",
        "instructions": "How urgent is this situation?",
        "criteria": [
          "Very low urgency",
          "Low urgency",
          "Moderate urgency",
          "High urgency",
          "Very high urgency"
        ]
      },
      "requires_action": {
        "type": "boolean",
        "instructions": "Does this message require a specific action or decision?"
      }
    },
    "providerOptions": {
      "gateway": {
        "zeroDataRetention": false
      }
    }
  }' | python -m json.tool
```

---

### 実装時のTips：リトライハンドリング（429 / 529）

公式ドキュメントおよびクライアント実装において、リトライを試みるべきHTTPステータスコードとして一般的なレートリミット（`429 Too Many Requests`）に加えて **`529 Site is overloaded`** が明記されています。

一時的なトラフィック集中による負荷時は、指数バックオフ（Exponential Backoff: 1秒 ➔ 2秒 ➔ 4秒...）を挟んで再試行することで、堅牢なパイプラインを構築できます。

---

## 6. Jevの特徴を生かした実践活用例

Jevの特性（超低遅延、低コスト、型安全性、確信度の提供）を最大限に生かせるユースケースを紹介します。

### 1. 問い合わせ・チケットの一次振り分け & トリアージ
- **課題**: CS（カスタマーサポート）の受電やチャットで、担当部署の割り振りや緊急度の判定にLLMを使うと、1リクエストあたり数秒待たされユーザー体験が悪化する。
- **Jevの活用**: ユーザーが送信ボタンを押した瞬間（70ms以内）に「担当部署（Choice）」「感情の激しさ（Score）」「解約リスク（Noul）」を同時判定。怒り心頭の顧客は優先キューへ即座にエスカレーションし、自明な定型質問は該当チームのBotへ直接パスします。

### 2. 多面的なリアルタイム・コンテンツモデレーション
- **課題**: 投稿型サービスで、スパム、ヘイトスピーチ、個人情報の露出、ステルスマーケティングなど複数のポリシーを1回のAPI呼び出しでチェックしたい。
- **Jevの活用**: 1つのstateに対して「ポリシーA違反」「ポリシーB違反」「ポリシーC違反」をすべてNoulで定義して一括判定。違反確率が0.95を超えた投稿はDB保存前に即時遮断し、0.5〜0.8のグレーゾーンのみモデレーターの審査ダッシュボードへ回します。

### 3. RAG（検索拡張生成）の高速リランキング & 関連度フィルタ
- **課題**: ベクトル検索で上位20件のチャンクを取得したものの、本当にユーザーの質問の回答に必要なコンテキストが含まれているかどうかの判定（リランキング）に高価なLLMを使うと遅延が深刻化する。
- **Jevの活用**: 取得した各チャンクをstateに、質問との適合度（Choice: `highly_relevant`, `partially_relevant`, `irrelevant`）をJevで並列評価。無関係なノイズチャンクを70msで一掃し、厳選されたコンテキストのみを本番生成LLMに渡すことで、生成LLM側のトークン代削減とハルシネーション抑制を同時に達成できます。

### 4. AIエージェントの自律ルーター（Tool Selection）
- **課題**: LangChainやLlamaIndexなどのAIエージェントで、次にどのツールを実行すべきかをLLMに推論させると、ステップごとに数秒の思考時間が発生する。
- **Jevの活用**: エージェントの現在状態（直前の実行結果やユーザーの目的）をstateにし、次に使うべきツール（Choice: `search`, `calculator`, `database`, `finish`）をJevで決定。確信度が高い場合はミリ秒単位でツールが発火し、エージェントのタスク完了速度が劇的に向上します。

---

## 7. プログラム・Jev・LLMの役割分担アーキテクチャ

どれほど優れたモデルであっても、銀の弾丸は存在しません。公式ドキュメント（Jev jaggedness）でも、現行のJevが不得意とする領域が明確にアナウンスされています。

### Jevが苦手なこと（絶対に任せてはいけないタスク）

1. **数え上げと四則演算**: 「このリストの中に商品は何個あるか？」「合計金額はいくらか？」といった数値計算は信用できません。
2. **日付や時刻の前後関係比較**: 「有効期限が30日以上過ぎているか？」といった判定は苦手です。日付のパースや差分日数の計算はコードで行うべきです。
3. **意図の忖度（裏読み）**: 質問文に書かれた文字通りの定義で判定するため、曖昧な指示では精度が落ちます。クライテリア（選択基準）は具体的に記述する必要があります。
4. **文章の生成**: 言うまでもありませんが、自然言語のテキストは1文字も出力できません。

### 最強の布陣：三位一体ハイブリッド構成

Jevを実戦投入する際のベストプラクティスは、**プログラム、LLM、Jevの3者に得意分野を徹底的に分担させること** です。

- **プログラム（司令塔）**: 確定的なビジネスルール、四則演算、日付比較、DB連携、そして確信度に応じたワークフローの分岐制御を担当する。
- **Jev（高速判断エンジン）**: 状況の文脈解釈、型付きの分類、スコアリング、スパム判定など、曖昧なインプットの「解釈と確率付け」を70msで担当する。
- **LLM（表現・文章生成エンジン）**: 最終的にユーザーへ返信するメールのドラフト作成や、要約文の執筆など、「文章そのものを生み出すリッチな作業」だけを担当する。

すべてを巨大なLLMに丸投げするのではなく、Jevという軽量な「判断専門AI」を前段のゲートキーパーに据えることで、システム全体のレスポンスは数倍に跳ね上がり、APIコストは数十〜数百分の一に圧縮されます。

---

## まとめ

Jevの登場は、AIアプリケーションの設計思想に大きなパラダイムシフトをもたらしました。

「言語モデル＝文章を書くもの」という固定観念を捨て、**「文章を理解して、型安全な確率だけを返す極小の判断器」** として特化させたことで、これまで速度やコストの壁に阻まれていたリアルタイム処理や大規模トリアージが現実的なものとなりました。

自社のワークフローで「LLMの出力JSONから特定フィールドの値だけを取り出して分岐に使っている」箇所があれば、そこはまさにJevに置き換える絶好のチャンスです。まずはVercel AI Gatewayや公式APIのcurlコマンドから、その圧倒的なレスポンスの速さを体感してみてはいかがでしょうか。

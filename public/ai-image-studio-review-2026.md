---
title: "Agnes AIが無制限無料！LLM×画像生成で知識漫画・インフォグラフィックを自動生成するOSSアプリ「AI画像スタジオ」徹底解説"
tags:
  - AI
  - NextJS
  - TypeScript
  - 画像生成
  - LLM
private: false
updated_at: ''
id: ''
organization_url_name: null
slide: false
ignorePublish: true
---

![カバー画像](https://raw.githubusercontent.com/lumichy/Qiita/main/public/ai-image-studio-review-2026/cover.png)

「画像生成AIを使ってみたいけど、Midjourney の月額料金はちょっと…」「インフォグラフィックをAIで作りたいが、プロンプトが難しすぎる」

そんな悩みを一気に解決するWebアプリを作ってみました。**AI画像スタジオ**（[lumichy/ai-image-studio](https://github.com/lumichy/ai-image-studio)）は、**Agnes AIの無制限・無料API**を活用し、テキスト入力だけで知識漫画・インフォグラフィック・通常の画像生成をGUI操作で実現できるフルスタックWebアプリです。

LLM（大規模言語モデル）が「AIによるプロンプト補完」を担い、ユーザーが日本語で簡単なキーワードを入力するだけで、**複雑な画像生成プロンプトを自動生成して美しいビジュアルを出力します**。

本記事ではこのアプリの機能・実装・操作方法を徹底解説します。

---

## 基本情報クイックリファレンス

| 項目 | 内容 |
|------|------|
| リポジトリ | [lumichy/ai-image-studio](https://github.com/lumichy/ai-image-studio) |
| フレームワーク | **Next.js 14**（App Router フルスタック） |
| 言語 | TypeScript |
| 画像生成エンジン | **Agnes AI**（`apihub.agnes-ai.com`）  |
| LLM（構成生成） | Tencent LKEAP など OpenAI 互換エンドポイント |
| **Agnes AI 料金** | **無制限・無料** |
| 対応言語 | 中文 / English / **日本語** |
| 主な生成モード | テキスト→画像、画像→画像、インフォグラフィック、知識漫画 |

:::note info
**Agnes AIは現在、完全無料・無制限でAPIを提供**しています。月額料金や従量課金は一切なし。これがこのアプリの最大の強みです。MidjourneyやDALL-Eの代替として、コスト0で本格的な画像生成が利用できます。
:::

---

## 4つの生成モード

### 1. テキスト→画像（Text-to-Image）

シンプルなテキストプロンプトから画像を生成するベーシックモード。

**操作方法：**
1. 「プロンプト」欄に生成したい画像の説明を入力（最大500文字）
2. スタイルをGUIボタンで選択（6種類）
3. サイズ（1:1正方形 / 16:9横版 / 9:16縦版 / 4:3横長）を選択
4. 「画像を生成」ボタンをクリック

**選択可能なスタイル：**
- アニメ（デフォルト）
- リアル
- 油絵
- サイバーパンク
- 水彩
- 写真

![テキスト→画像モードのUI](https://raw.githubusercontent.com/lumichy/Qiita/main/public/ai-image-studio-review-2026/main-page.png)
*左パネルにプロンプト入力欄・スタイル選択・サイズ選択。右パネルに生成結果が表示される*

![生成された画像とダウンロード機能](https://raw.githubusercontent.com/lumichy/Qiita/main/public/ai-image-studio-review-2026/generate-result.png)
*実際に「サッカーをしている少年」を「水彩」スタイル・16:9横版で生成した結果。生成プロンプトと、生成された画像をダウンロードするボタンが右パネルに表示される*

---

### 2. 画像→画像（Image-to-Image）

参考画像をアップロードし、プロンプトに従って画像を編集・変換するモード。Agnes API の `extra_body.image` パラメータを活用して、参照画像のURLを渡す仕組みです。

**操作方法：**
1. 参考画像をアップロード（Base64エンコード後、一時ホストにアップロードしてURL取得）
2. 編集内容をプロンプトで指定
3. 「画像を生成」ボタンをクリック

---

### 3. インフォグラフィック生成（最重要機能）

このアプリの最大の特徴機能です。テーマを入力するだけで、LLMが**適切なレイアウト・スタイルを自動でレコメンド**し、複雑なインフォグラフィックを生成します。

**用意されているレイアウト（20種類以上）：**

| レイアウト名 | 用途 |
|---|---|
| AIにお任せ | AI自動マッチ（デフォルト推奨） |
| ベントーグリッド | マルチトピックの概要 |
| 線形進行 | タイムライン・プロセス |
| 二項比較 | A vs B の比較 |
| 比較マトリックス | 多要素比較 |
| 階層レイヤー | ピラミッド・優先度 |
| ツリー分岐 | 分類・系譜 |
| ハブ＆スポーク | 中心概念＋関連 |
| 構造分解 | 断面・分解図 |
| アイスバーグモデル | 表面vs隠れた要素 |
| ブリッジ | 問題-解決 |
| ファネル | 変換・絞り込み |
| ダッシュボード | メトリクス・KPI |
| コミックストリップ | ナラティブ・シーケンス |

**インフォグラフィックスタイル（12種類以上）：**
- 手作りクラフト（デフォルト）
- クレイメーション（3D粘土）
- かわいい系（パステル）
- 絵本水彩
- チョークボード（黒板）
- サイバーパンク（ネオン）
- ボールドグラフィック（コミック調）
- アンティーク学術（レトロ）
- 技術ブループリント
- 折り紙 など

![インフォグラフィックのオプション選択画面](https://raw.githubusercontent.com/lumichy/Qiita/main/public/ai-image-studio-review-2026/infographic-options.png)
*レイアウト・スタイル・アスペクト比をGUIで選択。「AIにお任せ」を選べばLLMが最適な組み合わせを推薦する*

**2ステップの生成フロー：**
1. **テーマ入力＋おすすめ取得**：テーマを入力し「おすすめを取得」をクリック → LLMがテーマを分析し、最適なレイアウト＋スタイルの組み合わせを複数提案
2. **生成実行**：提案を確認して「インフォグラフィックを生成」をクリック → Agnes AIが実際の画像を生成

**▼ 実際の生成サンプル（テーマ：「How LLM AI Agents Work」/ レイアウト：ハブ＆スポーク / スタイル：クラフト）**

![infographic-sample](https://raw.githubusercontent.com/lumichy/Qiita/main/public/ai-image-studio-review-2026/infographic-sample.png)
*Planning・Tool Use・Memory・Action の4要素をハブから放射状に展開したインフォグラフィックが自動生成された。ハブ＆スポークレイアウト・クラフトスタイルの組み合わせをインフォグラフィック機能が自動選択*

---

### 4. 知識漫画生成（Knowledge Comic）

テーマを入力するとLLMがストーリーボード（コマ割り構成案）を生成し、そのままAIがコマ割り漫画を描きます。技術解説・歴史・概念説明を漫画形式で自動生成できるユニークな機能です。

**アートスタイル（6種類）：**
- ligne-claire（クリアライン）
- マンガ
- リアル
- インクブラシ
- チョーク
- ミニマリスト

**トーン（7種類）：**
- ニュートラル・温かみ・ドラマチック・ロマンチック・エネルギッシュ・ヴィンテージ・アクション

**コマ割りレイアウト（7種類）：**
- スタンダード・シネマティック・高密度・スプラッシュ・混合・ウェブトゥーン・4コマ

**▼ 実際の生成サンプル（テーマ：「How Git Works」 / スタイル：マンガ / 4コマ）**

![manga-sample](https://raw.githubusercontent.com/lumichy/Qiita/main/public/ai-image-studio-review-2026/manga-sample.png)
*git commit→ git branch → 独立開発 → git merge の流れをクリーンな4コママンガスタイルで自動生成。アートスタイル・トーン・コマ割りを各自カスタマイズ可能*

---

## 技術実装ポイント（エンジニア向け）

### アーキテクチャ：Next.js 14 App Router フルスタック

```
ai-image-studio/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # ルートレイアウト
│   │   ├── page.tsx            # メインページ（Client Component）
│   │   └── api/
│   │       └── generate/
│   │           ├── text-to-image/  # テキスト→画像エンドポイント
│   │           ├── image-to-image/ # 画像→画像エンドポイント
│   │           ├── infographic/    # インフォグラフィックエンドポイント
│   │           └── comic/          # 知識漫画エンドポイント
│   ├── components/             # UIコンポーネント群
│   └── lib/
│       ├── agnes.ts            # Agnes AI APIクライアント
│       ├── constants.ts        # プロンプトテンプレート・サイズ定義
│       └── i18n-context.ts     # 多言語コンテキスト
```

### Agnes AI API の呼び出し構造

```typescript
// src/lib/agnes.ts より

const API_BASE_URL = 'https://apihub.agnes-ai.com/v1';
const API_KEY = process.env.AGNES_API_KEY;

// テキスト→画像
const body = {
  model: 'agnes-image-2.1-flash',
  prompt: fullPrompt,
  extra_body: { response_format: 'url' },
  size: '1024x1024',
};

// 画像→画像（参照画像URLを extra_body.image に配列で渡す）
const body = {
  model: 'agnes-image-2.1-flash',
  prompt: fullPrompt,
  extra_body: {
    response_format: 'url',
    image: [imageUrl],  // 参照画像URLの配列
  },
};
```

### LLMによるプロンプト自動補完の仕組み

インフォグラフィック・知識漫画では、ユーザーが入力したシンプルなテーマをLLMが分析し、Agnes AIへ渡す**詳細なプロンプトに変換**します。

1. ユーザーが「Reactの動作原理」と入力
2. LLM（OpenAI互換エンドポイント）がテーマを分析
3. テーマに最適なレイアウト・スタイルの組み合わせ（Combo）を複数候補として提案
4. ユーザーが候補を確認・選択
5. 選択されたComboをベースに詳細プロンプトを組み上げてAgnes AIに送信

```typescript
// インフォグラフィックのCombo型定義（InfographicFlow.tsx）
interface Combo {
  layoutId: string;    // レイアウトID（例: 'linear-progression'）
  layoutName: string;  // レイアウト表示名（例: '線形進行'）
  styleId: string;     // スタイルID（例: 'craft'）
  styleName: string;   // スタイル表示名（例: '手作りクラフト'）
  rationale: string;   // LLMによる選択理由の説明
}
```

### 多言語対応（i18n）

React Context を使ったシンプルなi18n実装。`useI18n()` フックで中文・English・日本語を切り替えられます。

```typescript
const { t } = useI18n();
const label = t('common.reset');  // "リセット"（日本語時）
```

---

## ローカルでのセットアップ

```bash
# 1. リポジトリをクローン
git clone https://github.com/lumichy/ai-image-studio.git
cd ai-image-studio

# 2. 依存関係のインストール
npm install

# 3. 環境変数を設定
```

```yaml
# .env.local の設定例
AGNES_API_BASE_URL: https://apihub.agnes-ai.com/v1
AGNES_API_KEY: sk-xxxxxxxxxxxx   # Agnes AIで無料取得

# LLM（インフォグラフィック・漫画の構成生成に必要）
OPENAI_API_BASE_URL: https://api.lkeap.cloud.tencent.com/v1
OPENAI_API_KEY: sk-xxxxxxxxxxxx  # OpenAI互換なら何でもOK
```

```bash
# 4. 開発サーバー起動
npm run dev
# → http://localhost:3000/ でアクセス可能
```

---

## まとめ

AI画像スタジオは、以下の3点が際立ったOSSアプリです。

- **コスト0で本格的な画像生成**：Agnes AIの無制限・無料APIにより、月額料金なしでMidjourney品質の画像生成が可能
- **LLMによるプロンプト自動補完**：ユーザーは日本語でシンプルなキーワードを入力するだけ。レイアウト・スタイルの最適な組み合わせをAIが提案
- **知識漫画・インフォグラフィックという独自ユースケース**：教育コンテンツ・技術記事の図解・SNS投稿用インフォグラフィックを全自動で生成可能

Next.js + TypeScriptでの実装はクリーンで拡張しやすく、新しいレイアウトやスタイルの追加も容易です。Agnes AIのAPIが無料である今のうちに、ぜひ試してみてください！

---

**実際に試してみた方は、どんなインフォグラフィックや漫画を生成しましたか？**
コメント欄にぜひシェアしてください！ 🎨

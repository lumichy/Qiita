---
title: "Qwen-Image-2.1徹底解剖：2Kネイティブ出力＋マルチ画像編集をComfyUIで完全制覇"
tags:
  - AI
  - Qwen
  - ComfyUI
  - 画像生成
  - OpenSource
private: false
updated_at: ""
id: null
organization_url_name: null
slide: false
ignorePublish: false
---

![Qwen-Image-2.1 カバーイラスト](https://raw.githubusercontent.com/lumichy/Qiita/main/public/qwen-image-2-1-guide-2026/cover.png)
*※本記事の挿絵はすべて、ComfyUI上で動作するQwen-Image-2.1を用いて実際にローカル生成したものです（キャラクター：Doodle-PalsのCurio。機械に描かれた「Text」「Edit」「RGBA」の英字もQwen-Image-2.1自身による直接描画です）。*

「テキストから綺麗な絵を出したい」と「手持ちの画像の特定箇所だけを直したい」。

画像生成AIを触っていると、この2つは日常茶飯事です。しかしこれまでのオープンソース（OSS）界隈では、画像を生成するモデルと、生成した画像を修正するモデルが別々に存在していて、「生成はこちら、修正はあちら」と別々のツールを組み合わせる複雑な追加作業が当たり前でした。

「1つのモデルで、生成も、パーツ修正も、背景の透過切り抜きも、全部ネイティブにこなせないのか？」

そんな現場のフラストレーションを一撃で吹き飛ばすモデルが、2026年9月20日にAlibabaのQwenチームからオープンソースとして投下されました。それが **Qwen-Image-2.1** です。

驚くのはそのサイズ感です。**わずか7B（70億）パラメータ**——GPT-4oやMidjourney v7などの商用モデルが非公開の超大規模ウェイトで動いているのに対し、Qwen-Image-2.1はコンシューマー向けGPU（16GB VRAM、INT8量子化なら8GB〜）で動く「普通のPC用モデル」です。

それでいて、**25ステップ・約20秒で2048×2048の高精細画像を1枚生成**できます。しかも以下の能力をすべて1つのモデルに詰め込んでいます。

- **画像生成と画像編集の完全統合**: 単一モデルで新規生成も部分修正もこなす
- **ネイティブ透過PNG（RGBA）生成**: 切り抜きツール不要で背景透過アセットを直接出力
- **ネイティブ2K（2048×2048）直接出力**: 高解像度化の追加処理なしで高精細出力
- **最大10枚のリファレンス画像指定**: 複数の参照画像を組み合わせた精密な編集が可能

本記事では、この注目の新星 **Qwen-Image-2.1** の構造と特徴、先行する人気モデル（Z-Image-Turbo、Krea、そしてOpenAIの最新GPT Image 2.5）との実測比較、そしてComfyUIでの具体的なセットアップ・活用手順まで一気に解説します。

---

## 1. 基本スペック＆クイックリファレンス

まずはモデルの全貌を把握するためのスペック一覧です。

| 項目 | 詳細仕様 | 現場目線での評価 |
|---|---|---|
| **開発元** | Alibaba Qwen Team | 信頼のQwenブランド。テキスト・マルチモーダル双方の知見が凝縮 |
| **リリース日** | 2026年9月20日 | リリース直後からComfyUI公式テンプレートが整備 |
| **モデル規模** | 7B DiT（32 Single-Stream DiT layers） | 扱いやすいサイズ。混合粒度アテンションとKVキャッシュ再利用で高効率 |
| **テキストエンコーダ** | Qwen3-VL（8B）+ Qwen3.5（9B）PE | プロンプト理解力と日英タイポグラフィ（文字描画）が極めて優秀 |
| **ネイティブ解像度** | 1024×1024 〜 最大 2048×2048（2K） | ハイレゾFix不要で破綻の少ない大画面出力が可能 |
| **推奨サンプラー / スケジューラ** | Euler / Simple | 極めて標準的なサンプラーで素直に追従 |
| **推奨CFG** | **1.0**（ネガティブプロンプト非使用時） | **超重要**。SD感覚で7.0などに上げると絵が崩壊します |
| **推奨ステップ数** | 25〜40 steps | 25ステップでも十分に破綻のない描画が可能 |
| **特殊機能** | ネイティブRGBA（透過）、最大10枚参照マルチ画像編集 | Web・ゲーム開発者やデザイナーへのキラー機能 |
| **動作VRAM要件** | BF16: 12〜16GB / INT8量子化: 8GB〜 | GeForce RTX 4060 Ti / 5060 Tiクラスで余裕のローカル駆動 |

---

## 2. Qwen-Image-2.1 4つの強み

実際にローカル環境で動かしてみて「これは制作フローが変わる」と確信したポイントを4つに絞って紹介します。

### ① 生成（T2I）と編集（Image Edit）の完全統合

従来の画像生成では、「ベース画像を生成するワークフロー」と「生成後の画像を読み込んで修正するワークフロー」で全く異なるパイプラインを組む必要がありました。

Qwen-Image-2.1は、テキストからの画像生成と、画像を与えての指示編集（Image-to-Image / Inpainting / Reference Edit）を**同じモデルの重み**でそのまま処理します。

「髪の色だけを変えたい」「左手に持っている小物をノートPCに差し替えたい」といった指示を自然言語で与えるだけで、元の構図やキャラクターの特徴を維持しながらピンポイントで書き換えてくれます。

### ② プロンプト一発で背景が抜ける「ネイティブ透過PNG（RGBA）」

個人的に最も衝撃を受けたのがこれです。プロンプトの中に特定の指定を入れるだけで、**アルファチャンネル付きの透過PNGが直接出力**されます。

これまでキャラクター素材やUIパーツを作るときは、白背景で生成した後にRemBGなどの切り抜きノードを通したり、Photoshopで輪郭をなぞったりしていました。しかし、髪の毛の隙間や半透明の光など、後処理の切り抜きではどうしてもフチにゴミが残ります。

Qwen-Image-2.1はモデル内部でアルファチャンネルを同時に生成するため、輪郭のブレンドが極めて自然。Webサイトのアセットやゲームの立ち絵制作において、作業工数が半分以下に圧縮されます。

### ③ アップスケーラー要らずの「ネイティブ2K（2048×2048）」出力

近年のモデルは1024×1024基準が多く、高解像度化にはUltimate SD Upscaleやタイルサンプリングが必須でした。しかし、アップスケールの過程で顔が別人になったり、意図しないディテールが勝手に増えたりするのが長年の悩みどころ。

Qwen-Image-2.1は**ネイティブで4メガピクセル（2048×2048）の出力**をサポートしています。一度のサンプリングで破綻なく細部まで描き切るため、拡大処理によるアーティファクトの心配がありません。

### ④ 最大10枚のリファレンス画像を使ったマルチ画像編集

編集ワークフローでは、最大10枚のリファレンス画像（`<image1>`〜`<image10>`）をプロンプト内で直接参照できます。

例えば「`<image1>`の人物に、`<image2>`の服を着せて、`<image3>`の背景に立たせる」といった、複数素材の合成やスタイル維持が自然言語のプロンプトだけで指示可能です。

---

## 3. 人気モデルとの徹底比較（Z-Image-Turbo / Krea / GPT Image 2.5）

現在、画像生成AIのシーンで話題を集めている主要モデルたちと横並びで比較してみましょう。

![比較イラスト](https://raw.githubusercontent.com/lumichy/Qiita/main/public/qwen-image-2-1-guide-2026/comparison.png)
*※天秤で各モデル（Z-Turbo / Qwen 2.1 / GPT-2.5）の特徴を比較するCurio（Qwen-Image-2.1ローカル生成。テーブル下のモデル名も直接描画）*

| 比較項目 | **Qwen-Image-2.1** | **Z-Image-Turbo** | **Krea 2** | **GPT Image 2.5（OpenAI）** |
|---|---|---|---|---|
| **提供形態** | オープンウェイト公開 | OSS（Apache 2.0） | クラウドサービス（重み非公開） | 商用クラウドAPI / ChatGPT |
| **開発元** | Alibaba Qwen Team | Alibaba Tongyi-MAI | Krea AI | OpenAI |
| **モデル規模** | 7B DiT | 6B S3-DiT | 非公開（独自基底） | 非公開（Flare / Sunburst） |
| **生成速度** | 25〜40 steps（約20〜30秒） | **8 steps（コンシューマーGPUで2〜4秒）** | 数秒〜（リアルタイムキャンバスあり） | 数秒〜十数秒（API経由） |
| **ネイティブ解像度** | **2048×2048（2K）** | 1024×1024 | 最大4K対応 | 可変（高解像度対応） |
| **透過PNG（RGBA）生成** | **ネイティブ対応** | 非対応（後処理が必要） | 非対応 | 非対応 |
| **画像編集・マルチ参照** | **最大10枚参照（強力）** | 別モデル（Z-Image-Edit）で対応 | スタイル転送・ムードボード | Sketch / Comment-based Editing |
| **文字描画（タイポ）** | 英・中・日（極めて高精度） | 英・中（高精度） | 英語中心 | 英語中心（2.5で向上） |
| **ローカル完全動作** | **可能（ComfyUI等）** | **可能（ComfyUI等）** | 不可（クラウド専用） | 不可（クラウド限定） |
| **ライセンス / コスト** | Qwen Research License ※商用利用は要確認 | Apache 2.0（無料） | 月額課金（$9〜）/ クレジット制 | API従量課金 / ChatGPT Plus |

### vs Z-Image-Turbo：超高速ドラフトか、決定打の統合力か

同じAlibaba系列から出ている **Z-Image-Turbo**（Tongyi-MAIチーム開発の6Bモデル）は、**わずか8ステップで出力される驚異的な推論速度**が最大の武器です。業務用GPU（H800等）では1秒未満、コンシューマーGPUでも2〜4秒で生成できます。

- **Z-Image-Turboが勝る点**: とにかく速い。アイデアの壁打ち、プロンプトの試行錯誤、リアルタイムプレビュー用途では無敵のスピード感を誇ります。ライセンスもApache 2.0で商用利用が自由です。
- **Qwen-Image-2.1が勝る点**: 1枚の完成度、ネイティブ2Kの解像感、透過PNGの直接生成、そして複数画像のリファレンスを組み合わせた緻密な編集能力。

「Z-Image-Turboで高速に構図を探り、本番の一枚や編集作業はQwen-Image-2.1で仕上げる」という組み合わせが、今後のOSS環境における最強の布陣になりそうです。

> ⚠️ **ライセンスに注意**: Qwen-Image-2.1は「Qwen Research License」で公開されており、個人・研究利用は無料ですが**商用利用には別途ライセンス取得が必要**です。商用プロダクトへの組み込みを検討している場合は公式ページで条件を確認してください。

### vs Krea：クラウド完結の洗練されたUIか、自由度のローカルか

**Krea** は、リアルタイムキャンバスやスタイル転送、ムードボードからのビジュアル生成など、デザイナー向けの直感的なUIが非常に洗練されています。

- **Kreaが勝る点**: 面倒なモデルのダウンロードや環境構築が不要。ブラウザを開いてすぐに手描きスケッチと連動した生成が楽しめます。
- **Qwen-Image-2.1が勝る点**: 完全ローカルで動作するため、通信容量や月額クレジット残高を気にする必要が一切ありません。さらにComfyUIで自分好みのバッチ処理や外部ツール連携パイプラインを無限に拡張できます。

### vs GPT Image 2.5（OpenAI）：商用最高峰と比べるとどうなのか？

2026年9月8日にOpenAIが投入した **GPT Image 2.5**（高速版Flareと高画質版Sunburst）は、ChatGPT上で手描きスケッチや「Image Comments（画像への直接注記）」による編集ができるなど、編集体験を大幅に引き上げました。

- **GPT Image 2.5が勝る点**: 自然言語の意図理解の深さはさすがOpenAI。曖昧な指示や長文のプロンプトでも破綻なく汲み取ってくれます。API一本で叩ける手軽さも魅力です。
- **Qwen-Image-2.1が勝る点**: 
  1. **コストゼロ＆完全プライベート**: 機密情報を含む製品画像や未公開キャラクターでもローカルGPUで安全に処理可能。
  2. **コンテンツ制約がない**: 商用API特有の過度なセーフティガードに引っかかって弾かれるストレスがありません。
  3. **ネイティブ透過RGBA出力**: GPT Image 2.5でも透過PNGのネイティブ生成はできないため、Web・ゲーム制作者にとっては明確なアドバンテージです。

---

## 4. ComfyUIでの利用手順（環境構築・生成・編集）

それでは、実際にローカルのComfyUIで動かす手順を解説します。

![パイプラインイラスト](https://raw.githubusercontent.com/lumichy/Qiita/main/public/qwen-image-2-1-guide-2026/pipeline.png)
*※ノード間を繋いで自動化パイプラインを構築するCurio（Qwen-Image-2.1ローカル生成。「Input」と「2K Output」のラベルも直接描画）*

### 4.1 モデルのセットアップ

ComfyUI側での難しい準備は一切不要です。使いたいテンプレートを開くと、**不足しているモデルファイルが自動的に検出され、ダウンロードリンクが表示されます**。表示に従ってすべてダウンロードするだけでセットアップ完了です。

> **VRAM 16GBの筆者からのひとこと**:
> ダウンロード時に量子化バージョンを選べる場合は、迷わず **INT8量子化版（`int8_convrot`）** を選んでください。BF16版を載せるとVRAMがカツカツになり、他のアプリやOSの描画も重くなります。INT8版なら生成クオリティを肉眼で判別できないレベルで維持したまま、推論も安定します。

### 4.2 テンプレートギャラリーからワークフローを選ぶ

モデルを配置したら、ComfyUIのトップ画面にある **「テンプレート」** タブを開いてください。`Qwen Image 2.1` で絞り込むと、公式が用意したワークフローが3件ヒットします。

![ComfyUI テンプレートギャラリー](https://raw.githubusercontent.com/lumichy/Qiita/main/public/qwen-image-2-1-guide-2026/template-gallery.png)
*ComfyUIのテンプレート検索画面。「Qwen Image 2.1」で絞り込むと「画像編集」「テキストから画像へ」「背景を除去」の3テンプレートが表示される*

| テンプレート名 | 用途 |
|---|---|
| `Qwen Image 2.1：画像編集` | 手持ち画像に自然言語で修正指示を与える |
| `Qwen Image 2.1：テキストから画像へ` | テキストから画像を新規生成する基本ワークフロー |
| `背景を除去：Qwen Image 2.1` | アルファチャンネル付き透過PNGを直接出力 |

テンプレートを選択すると、ノードが自動展開された状態でキャンバスに読み込まれます。ゼロからノードを組む必要はなく、**プロンプト入力欄とモデルパスを確認するだけで即座に動かせます。**

### 4.3 テキストから画像生成（Text-to-Image）

基本設定と透過PNGを出すプロンプトのコツです。

#### ワークフローの主要パラメータ

![T2Iワークフロー全体像](https://raw.githubusercontent.com/lumichy/Qiita/main/public/qwen-image-2-1-guide-2026/workflow-t2i.png)
*「テキストから画像へ」テンプレートを開いた状態。左の「解像度セレクター」→中央の「Text to Image（Qwen Image 2.1）」ノード→右の「画像を保存」の3ブロック構成*

テンプレートを開くと、以下のノードがキャンバス上に展開されています。最初に確認すべき箇所を順番に示します。

1. **モデルロードノード（中央ノード内）** — `unet_name`・`clip_name`・`vae_name`・`PE_model` の4項目に配置したモデルのファイル名が正しく入っているか確認
2. **メインパラメータ（同ノード内）**
   - `cfg`: **`1.0`**（ここを絶対に変えない）
   - `steps`: `25`（仕上げは `40`）
   - `sampler`: `euler` / `scheduler`: `simple`
   - `width` × `height`: `1024 × 1024`（32の倍数で指定）
3. **解像度セレクター（左ノード）** — アスペクト比とメガピクセル数を直感的に変更できる。変更するとwidth/heightに自動反映される
4. **positive_prompt（中央ノード上部）** — ここにプロンプトを入力するだけで生成開始

実際に動かしてみると、プロンプト追従性が想像以上に素直です。以下は「空を泳ぐクジラに乗る少女」を描いたサンプルです。

#### T2I 実写サンプル：空飛ぶクジラ

```text
A magical children's picture book illustration of a giant friendly blue whale 
flying through the sky above the clouds.

A little girl wearing a red dress is sitting safely on the whale's back, 
holding onto a small golden star-shaped handle.

The whale gently swims through fluffy white clouds. Below them are tiny mountains, 
forests, rivers and colorful villages. Birds fly alongside the whale.

The whale has a friendly smiling face, large kind eyes and soft rounded features.

Magical children's storybook illustration, watercolor and colored pencil, 
soft pastel colors, whimsical fantasy, adorable characters, gentle outlines, 
dreamy atmosphere.

Golden sunset light, pink and orange clouds, soft atmospheric perspective, 
sparkling magical particles.

Wide cinematic composition, strong sense of scale, clear foreground and background, 
charming and emotionally uplifting, suitable for a children's picture book.
```

![Qwen-Image-2.1 T2I生成サンプル：空飛ぶクジラ](https://raw.githubusercontent.com/lumichy/Qiita/main/public/qwen-image-2-1-guide-2026/sample-t2i-whale.jpg)
*上記プロンプトをそのまま入力して生成した1枚。CFG=1.0・25ステップ・1024×1024。赤いワンピースの少女、金色のハンドル、背景の山と村、横を飛ぶ鳥——プロンプトに書いた要素がほぼ全て再現されている。*

プロンプトのコツは「**被写体→情景→スタイル→ライティング→カメラ構図**」の順に段落を分けて書くこと。箇条書きにするよりも自然言語の段落のほうがQwen3-VLのテキスト理解力を活かせます。

#### 透過PNG（背景透過）を出力するプロンプト定型句

背景を抜いた被写体を出したい場合は、プロンプトを以下のように構成します。

```text
This is an RGBA format image with transparency. 
A cute robot mascot holding a glowing lightbulb, vector style, clean edges. 
The image has an alpha channel and a transparent background.
```

保存ノードで **PNG形式・RGBA** を選択すれば、背景が完全に透明な素材画像が手に入ります。

### 4.4 画像編集（Image Edit）の手順

手持ちの写真や画像に修正を加える場合は、画像編集用テンプレートを使います。実際にやってみた例として、普段着の少年写真から野球ユニフォーム姿に変える編集を試しました。結果は驚くほどきれいで、顔の特徴や姿勢を維持したまま、服だけがピンポイントで差し替わっています。

![画像編集ワークフロー全体像](https://raw.githubusercontent.com/lumichy/Qiita/main/public/qwen-image-2-1-guide-2026/workflow-edit.png)
*「画像編集」テンプレートの構成。左の「画像を読み込む」ノードに写真をドロップ→中央「Image Edit（Qwen Image 2.1）」ノードでimage_1〜image_10の参照スロットとパラメータを設定→右の「画像を保存」へ。image_a/image_bの2出力も確認できる*

**ノード構成の手順：**

1. **「画像を読み込む」ノード（左端）** で編集対象の画像を読み込む（これが `<image1>` になる）
   - テンプレートを開くと、このノードがすでにキャンバス上に配置されているので、写真をドロップするだけ
2. 追加で参照したい画像があれば、LoadImageノードをもう1つキャンバスに追加して繋ぐ（`<image2>`、`<image3>`...）
3. **CLIPTextEncodeノード（プロンプト欄）** に修正指示を英語で記述する
4. KSamplerの **Denoise（デノイズ強度）** はデフォルト（1.0）のまま使用。編集系ワークフローは内部でマスキングを自動処理するため、手動でInpaintマスクを塗る必要はない

**実際に使っているプロンプト例：**

```text
# 服装の変更（筆者実測）
In <image1>, change the boy's casual outfit to a red baseball uniform 
with white pinstripes and a matching cap, keeping his face, hairstyle, 
and pose exactly the same.

# 局所的な修正
In <image1>, change the character's white sneakers to bright red leather boots, 
keeping everything else exactly the same.

# 複数画像の合成
Apply the jacket style from <image2> onto the person in <image1>, 
placing them in a rainy neon city background.
```

マスクを手動で細かく塗らなくても、モデルが「何を変えて、何を維持すべきか」を文脈から理解してくれます。実際に試した結果を見てください。

#### Image Edit 実写サンプル：服の色をネイビー→赤に変更

使用したプロンプトはこれだけです。

```text
In <image1>, change the color of the boy's jacket from dark navy to bright red, 
keeping his face, hairstyle, cap, pose, and background exactly the same.
```

**Before（元画像）**

![服色編集 Before：ネイビー](https://raw.githubusercontent.com/lumichy/Qiita/main/public/qwen-image-2-1-guide-2026/sample-edit-before.jpg)
*元の画像：ネイビーのジャケットを着た少年。野球帽・バットを持つポーズ・背景のグラウンドはそのまま*

**After（編集後）**

![服色編集 After：赤](https://raw.githubusercontent.com/lumichy/Qiita/main/public/qwen-image-2-1-guide-2026/sample-edit-after.jpg)
*編集後：ジャケットのみ赤に変更。顔の輪郭・髪型・帽子・バットのグリップ・背景のボケ感まで一切変わっていない*

顔の影の落ち方・肌の質感・帽子の刺繍まで完全に保持されています。「変えたいのは服の色だけ」という1文の指示で、Photoshopを使ったような精度の選択的編集が実現しています。

> **ポイント**: 日本語プロンプトでも動作しますが、指示の精度は英語のほうが明確に高いです。特に「どこを変えて、どこを変えないか」の境界を伝える表現は英語の方が素直に通ります。

---

## 5. まとめ：2026年秋、ローカル画像生成は「統合」の新時代へ

Qwen-Image-2.1を触って強く感じたのは、**「画像生成と画像編集の境界線が完全に消え去った」** という点です。

「生成して、切り抜いて、修正して、アップスケールする」というかつての多段階パイプラインが、この7Bモデル1本に集約されつつあります。しかもそれがプロプライエタリなクラウドサービスの中だけでなく、自宅のグラフィックボードで自由に動かせるオープンソースとして提供されている意義は計り知れません。

皆さんはこの強力な統合能力、特に「透過PNGの直接生成」や「10枚参照マルチ編集」を、日々の開発やクリエイティブワークフローにどう組み込みますか？ 

おすすめのプロンプトテクニックやComfyUIカスタムノードの組み合わせがあれば、ぜひコメント欄で教えてください！

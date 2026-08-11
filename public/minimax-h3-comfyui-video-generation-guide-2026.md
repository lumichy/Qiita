---
title: オープンソースAI動画生成モデル「MiniMax H3」× ComfyUI 徹底解説ガイド——ローカル構築から実践動画生成まで
tags:
  - AI
  - comfyui
  - 動画生成
  - Python
  - 画像生成
private: false
updated_at: '2026-08-11T18:45:27+09:00'
id: d86f7efbed757e5f740f
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

# オープンソースAI動画生成モデル「MiniMax H3」× ComfyUI 徹底解説ガイド——ローカル構築から実践動画生成まで

![カバー画像](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/cover.png)

AIによる画像生成や動画生成の進化は目覚ましく、近年では個人PCやローカル環境でも映画品質の動画生成が現実的になってきました。

2026年8月、中国のAIスタートアップ MiniMax（海螺 AI / Hailuo AI）は、最新のオープンソース全模態（マルチモーダル）AI動画生成モデル **「MiniMax H3 (Hailuo H3)」** を正式オープンソース公開しました。

本記事では、MiniMax H3 の概要・特徴、ノードベース画像・動画生成ツール **ComfyUI** の基本、そして ComfyUI の最新テンプレート機能を活用して複雑な手動配線なしで MiniMax H3 のワークフローを構築し、テキスト動画（Text-to-Video）および画像動画（Image-to-Video）を生成する実践的な手順を詳しく解説します。

---

## 1. MiniMax H3 (Hailuo H3) の紹介

### 1.1 全模態（マルチモーダル）統合動画生成モデル
**MiniMax H3** は、単なる「テキストから映像を作る（Text-to-Video）」だけのモデルではありません。テキスト、静止画像、ビデオ、音声、キャラクター参照、カメラワークなどのマルチモーダルコンテキストを1つのアーキテクチャ（H3-Context-IR）で統一理解し、**「映像と同期した高音質ステレオ音声（32kHz）」を同時に自動生成する全模態動画生成モデル**です。

![作品デモサンプル](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/demo-samples.png)

### 💡 MiniMax H3 の主なスペックと特徴

- **ネイティブ音声同期**: 映像生成と同時に 32kHz ステレオ音声を生成。リップシンク（口型合わせ）も中・英・日・韓・仏など11言語に対応。
- **高解像度 & 柔軟なフレーム数**: 4秒〜15秒の長さ、最大 2K 解像度の動画生成をサポート。
- **高い制御性（Controllability）**: 文本、参照画像、プロンプトベースのカメラ制御、スタイル転送までを高精度にコントロール。
- **商用ライセンス**: 日本などの指定地域において、年間売上2,000万ドル（約30億円）未満の個人・企業は無料で商用利用・改変・再配布が可能（MiniMax H3 Community License）。

### 💻 動作要件・VRAM（グラフィックボード）
公式の未量子化モデルは約40GBものサイズがありますが、ComfyUI の動的メモリ搬送（Layer-by-Layer Offload）や GGUF / 量子化モデル（Q2〜Q4）を活用することで、**VRAM 8GB 〜 12GB（メインメモリ 32GB 以上推奨）の環境でもローカル動作が可能**です。

---

## 2. ComfyUI の紹介

### 2.1 ノードベース動画・画像生成パイプライン
**ComfyUI** は、Stable Diffusion や Flux、MiniMax H3 などの生成AIモデルを、グラフィカルなノード（パーツ）同士をパイプラインで配線・接続して操作するオープンソースの環境です。

![ComfyUI ワークフロー](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/comfyui-workflow.png)

### ComfyUI が選ばれる理由
- **テンプレート機能の充実**: 最新の ComfyUI では標準テンプレート機能が用意されており、複雑なノード配線をゼロから手動で組む必要がありません。
- **メモリ効率の高さ**: GPU VRAM に必要な層だけを動的にロードし、不要な時はメインメモリ（RAM）へ一時退避させるため、VRAM容量が少ない環境でも大型モデルが動作します。
- **拡張性**: GGUF 量子化ノードやカスタム拡張を組み込むことで、ローカル環境に合わせた柔軟なチューニングが可能です。

---

## 3. ComfyUI で MiniMax H3 ワークフローを構築し、テキスト動画（Text-to-Video）を生成する手順

以前は複雑なノード構成やモデル配置を手動で行う必要がありましたが、最新の ComfyUI では**テンプレート機能を使うことで手動配線なしで一発構築**が可能です。

### Step 1: ComfyUI のアップデートとテンプレート選択
ComfyUI を最新版にアップデート後、メニューの **テンプレート（Templates）** またはテンプレートセンターを開きます。

一覧から **「MiniMax H3 (Text to Video)」** を選択するだけで、必要なノード群と配線があらかじめ組み上がった状態で読み込まれます。

![テンプレート選択画面](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/template-select.png)
*▲ ComfyUI のテンプレート一覧に標準追加された MiniMax H3 (Text to Video)*

### Step 2: 必要モデルのプリセット確認
テンプレートを読み込むと、MiniMax H3 の動作に必要な以下のモデル群が自動的に指定・参照されます（合計約40GB）。

- **Diffusion Model**: `minimax_h3_f12va_pruned_int8_convrot.safetensors` (約19.5GB)
- **Audio VAE**: `minimax_h3_audio_vae_fp32.safetensors` (577MB)
- **Video VAE**: `minimax_h3_video_vae_fp16.safetensors` (4.85GB)
- **Text Encoder**: `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` (約14.6GB)

![指定モデルの確認画面](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/model-preset.png)
*▲ テンプレート呼び出し時にセットされるモデル構成*

複雑な手動フォルダ分けや配線は不要で、テンプレートに沿ってモデルを取得・ロードするだけでセットアップが完了します。

### Step 3: VRAM節約・GGUF量子化モデルの利用（オプショナル）
VRAM容量（8GB〜12GBクラス）を節約したい場合や、ローカルPC環境に合わせて軽量化して動かしたい場合は、GGUF形式に量子化されたモデルを利用します。

テンプレート内のサンプラーサブグラフを開き、**`Unet Loader (GGUF)`** などの量子化用ノードへ差し替えてモデルを指定してください。

#### 📥 量子化モデルのダウンロードリンク
コミュニティによって量子化された MiniMax H3 GGUF モデルは、以下の Hugging Face リポジトリからダウンロード可能です：

- **MiniMax H3 GGUF リポジトリ**: [molbal/MiniMax-H3-GGUF (Hugging Face)](https://huggingface.co/molbal/MiniMax-H3-GGUF)
  - **推奨軽量モデル**: `minimax_h3_fl2va_pruned_fp8_Q4_0.gguf` (約11.4GB) または `Q4_K_M`
  - **配置先**: ダウンロードした `.gguf` ファイルは `ComfyUI/models/unet/` フォルダへ配置し、`Unet Loader (GGUF)` ノードで参照します。

### Step 4: テキストプロンプト入力と実行
プロンプト入力ノードに目的の生成文章（例: `少年が体育館でバスケットボールをドリブルしながら前進する`）を入力し、**「Queue Prompt」** を押すだけでテキストからの動画生成がスタートします。

---

## 4. 作品の紹介（Text-to-Video & Image-to-Video）

MiniMax H3 × ComfyUI ワークフローを用いて作成した動画表現の作例を紹介します。

> ⚠️ **お知らせ**: 下記のデモ画像およびGIFアニメーションはプレースホルダー表記です。実際の動的GIFおよび完成動画ファイルは後で入れ替えます。

---

### 作例 1: テキストから動画生成 (Text-to-Video)

**【使用プロンプト】**
> *少年が体育館でバスケットボールをドリブルしながら前進する*

![作例1: Text-to-Videoデモ](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/demo-samples1.gif)
*▲ 【プレースホルダー】Text-to-Video の生成結果フレーム*

---

### 作例 2: 静止画から動画生成 (Image-to-Video)

**【参照元入力イメージ (Input Source Image)】**
![参照元入力画像 ](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/demo-samples2.png)
*▲ 【プレースホルダー】参照元入力静止画*

**【プロンプト & 入力設定】**
> *Input Image: 上記写真 / Prompt: 少年が武術の構えから一連のカンフー動作を行う*


![作例2: Image-to-Video生成結果デモ](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/demo-samples2.gif)
*▲ 【プレースホルダー】Image-to-Video 生成結果アニメーション*

---

## 5. まとめ

**MiniMax H3 × ComfyUI** は、最新のテンプレート機能を活用することで手動の複雑な配線なしに構築できる最先端のオープンソース動画生成環境です。

- ComfyUI テンプレート機能によるワンクリック構築
- 音声同期＆マルチ言語リップシンク対応
- GGUF量子化による柔軟なローカル環境最適化

ぜひ ComfyUI の最新テンプレートを活用して、MiniMax H3 による動画生成をお試しください！

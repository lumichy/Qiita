---
title: オープンソースAI動画生成モデル「MiniMax H3」× ComfyUI 徹底解説ガイド——ローカル構築から実践動画生成まで
tags:
  - AI
  - ComfyUI
  - 動画生成
  - Python
  - 画像生成
private: false
updated_at: ''
id: ''
organization_url_name: null
slide: false
ignorePublish: true
---

# オープンソースAI動画生成モデル「MiniMax H3」× ComfyUI 徹底解説ガイド——ローカル構築から実践動画生成まで

![カバー画像](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/cover.png)

AIによる画像生成や動画生成の進化は目覚ましく、近年では個人PCやローカル環境でも映画品質の動画生成が現実的になってきました。

2026年8月、中国のAIスタートアップ MiniMax（海螺 AI / Hailuo AI）は、最新のオープンソース全模態（マルチモーダル）AI動画生成モデル **「MiniMax H3 (Hailuo H3)」** を正式オープンソース公開しました。

本記事では、MiniMax H3 の概要・特徴、ノードベース画像・動画生成ツール **ComfyUI** の基本、そして ComfyUI を用いて MiniMax H3 のローカルワークフローを構築し、テキストから動画（Text-to-Video）および画像から動画（Image-to-Video）を生成する実践的な手順を詳しく解説します。

---

## 1. MiniMax H3 (Hailuo H3) の紹介

### 1.1 全模態（マルチモーダル）統合動画生成モデル
**MiniMax H3** は、単なる「テキストから映像を作る（Text-to-Video）」だけのモデルではありません。テキスト、静止画像、ビデオ、音声、キャラクター参照、カメラワークなどのマルチモーダルコンテキストを1つのアーキテクチャ（H3-Context-IR）で統一理解し、**「映像と同期した高音質ステレオ音声（32kHz）」を同時に自動生成する全模態動画生成モデル**です。

![作品デモサンプル](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/demo-samples.png)

### 💡 MiniMax H3 の主なスペックと特徴

- **ネイティブ音声同期**: 映像生成と同時に 32kHz ステレオ音声を生成。リップシンク（口型合わせ）も中・英・日・韓・仏など11言語に対応。
- **高解像度 & 柔軟なフレーム数**: 4秒〜15秒の長さ、最大 2K 解像度の動画生成をサポート。
- **高い制御性（Controllability）**: 文本、参照画像、プロンプトベースのカメラ制御、スタイル転送までを高精度にコントロール。
- **グローバル評価（Artificial Analysis 等）**: 動画編集能力において世界トップクラスのスコアを獲得。

### 💻 動作要件・VRAM（グラフィックボード）
公式の未量子化フル精度モデルはハイエンド環境（32GB VRAM x 2以上）を推奨しますが、ComfyUI の動的メモリ搬送（Layer-by-Layer Offload）や GGUF / 量子化モデル（Q2〜Q4）を活用することで、**VRAM 8GB 〜 12GB（メインメモリ 32GB 以上推奨）の一般的なグラフィックカード搭載PCでもローカル動作が可能**です。

---

## 2. ComfyUI の紹介

### 2.1 ノードベース動画・画像生成パイプライン
**ComfyUI** は、Stable Diffusion や Flux、Sora系/動画生成モデルなどのAI生成AIモデルを、グラフィカルなノード（パーツ）同士をパイプラインで配線・接続して操作するオープンソースのノードベースUI環境です。

```
[ Model Loader ] ──→ [ Sampler ] ──→ [ VAE Decode ] ──→ [ Save Video ]
                          ↑
[ Text Prompt (CLIP) ] ───┘
```

### ComfyUI が選ばれる理由
- **メモリ効率の高さ**: GPU VRAM に必要な層だけを動的にロードし、不要な時はメインメモリ（RAM）やストレージへ一時退避させるため、VRAM容量が少ない環境でも大型モデルが動作します。
- **ワークフローの共有・再利用**: 構築したノード構成（ワークフロー）を `.json` または画像埋め込みで簡単に保存・再利用できます。
- **拡張性**: カスタムノードを追加することで、MiniMax H3 などの最新オープンソースモデルへ即座に対応可能です。

---

## 3. ComfyUI で MiniMax H3 ワークフローを構築し、テキストから動画（Text-to-Video）を生成する手順

ComfyUI 環境で MiniMax H3 を動作させ、テキストプロンプトから動画を出力する具体的な構築手順をステップ・バイ・ステップで解説します。

![ComfyUI ワークフロー](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/comfyui-workflow.png)

### Step 1: ComfyUI の準備と最新化
MiniMax H3 の固有ノードや最新ローダーを利用するため、ComfyUI を **v0.27 以降の最新バージョン** にアップデートします。
ComfyUI 統合版（Portable版）をお使いの場合は、`update_comfyui.bat` または ComfyUI Manager から本体を更新してください。

### Step 2: MiniMax H3 モデルファイルの配置
Hugging Face や Official / Community リポジトリから以下の必要なモデルファイルをダウンロードし、指定フォルダへ配置します。

- **Diffusion / Model Checkpoint** (`ComfyUI/models/diffusion_models/` または `checkpoints/`): `minimax_h3_quant.safetensors`
- **Text Encoder / CLIP** (`ComfyUI/models/clip/`): `t5xxl_fp16.safetensors`
- **VAE / Audio Encoder** (`ComfyUI/models/vae/`): `minimax_vae.safetensors` / WavTokenizer

### Step 3: ノードの構築と配線（Text-to-Video ワークフロー）

1. **`Load Diffusion Model` ノード**: ダウンロードした `MiniMax H3` モデルを選択。
2. **`CLIP Text Encode (Prompt)` ノード**:
   - **Positive Prompt**: 生成したい映像の詳細な説明（例: `A futuristic cyberpunk hovercar driving fast through a rainy neon city at night, 4k cinematic`）
   - **Negative Prompt**: 排除したい要素（例: `blurry, low quality, static, distorted`）
3. **`MiniMax Sampler` / `KSampler` ノード**:
   - **Steps**: `20 〜 30`
   - **CFG Scale**: `6.0 〜 7.5`
   - **Sampler**: `euler` / `dpmpp_2m`
   - **Scheduler**: `normal` または `ddim`
4. **`VAE Decode` ノード**: 潜在変数（Latent）をカラーフレーム画像シーケンスにデコード。
5. **`Video Combine` / `VHS Video Combine` ノード**: 生成された連番フレームと音声を結合し、`.mp4` 動画として保存。

### Step 4: レンダリング実行
ノードの接続を確認したら、右側メニューの **「Queue Prompt」** をクリックして生成を開始します。VRAM 12GB 環境の場合、5秒間の480p/720p動画が約4〜6分程度でレンダリングされます。

---

## 4. 作品の紹介（Text-to-Video & Image-to-Video）

MiniMax H3 × ComfyUI ワークフローを用いて作成した動画表現の作例を紹介します。

> ⚠️ **お知らせ**: 下記のデモ画像およびGIFアニメーションはプレースホルダー表記です。実際の動的GIFおよび完成動画ファイルは後で入れ替えます。

---

### 作例 1: テキストから動画生成 (Text-to-Video)

**【使用プロンプト】**
> *Prompt: A futuristic cyberpunk hovercar speeding through a rainy neon-lit megacity at night, camera panning smoothly, cinematic lighting, 4k resolution.*

- **特徴**: ネオンの光が反射する濡れた路面、車体の滑らかなカメラワーク、リアルな雨の質感とエンジン音・雨音が同期して生成されます。

<!-- プレースホルダー: テキストから動画生成デモGIF (※実際のGIFは後で入れ替えます) -->
![作例1: Text-to-Videoデモ (後で動画/GIFに差し替え)](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/demo-samples.png)
*▲ 【プレースホルダー】Text-to-Video の生成結果フレーム（※実際の動的GIFは後で入れ替え予定）*

---

### 作例 2: 静止画から動画生成 (Image-to-Video)

**【入力素材】**
静止画のポートレート（キャラクター画像） + テキスト音声プロンプト。

- **特徴**: 1枚の静止画キャラクターが、カメラに向かって自然に目を瞬かせ、表情を動かしながら唇を噛み合わされて自然に会話を開始します（11言語対応のリップシンク技術）。

<!-- プレースホルダー: 画像から動画生成デモGIF (※実際のGIFは後で入れ替えます) -->
![作例2: Image-to-Videoデモ (後で動画/GIFに差し替え)](https://raw.githubusercontent.com/lumichy/Qiita/main/public/minimax-h3-comfyui-video-generation-guide-2026/demo-samples.png)
*▲ 【プレースホルダー】Image-to-Video の生成結果フレーム（※実際の動的GIFは後で入れ替え予定）*

---

## 5. まとめ

**MiniMax H3 × ComfyUI** の組み合わせは、オープンソースの AI 動画生成における新たな金字塔と言えます。

- 映像と音声の一体同期生成
- ComfyUI による自由で軽量なローカル環境構築
- テキスト・画像からの多彩な映像表現

ぜひ ComfyUI に MiniMax H3 ワークフローを取り入れ、最先端の AI 動画生成を体験してみてください！

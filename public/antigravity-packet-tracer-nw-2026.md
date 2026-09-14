---
title: AIと挑むCisco Packet Tracer：0から5ステップで構築するエンタープライズNW実践
tags:
  - Cisco
  - Network
  - BGP
  - OSPF
  - AI
private: false
updated_at: '2026-09-15T07:38:26+09:00'
id: ff669691e369dcf1f158
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

![AIと挑むCisco Packet Tracer](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/cover.png)

AIの進化はコード生成やアプリ開発にとどまりません。いまやインフラ、とりわけネットワーク（NW）の設計・学習・検証プロセスすら根本から変えつつあります。

CCNAやCCNPの参考書を開き、ルーティングテーブルの仕組みやBGPのパス属性を暗記する。しかし、試験対策のコマンドを覚えただけでは、実務で遭遇するマルチサイトWANやルーティング再配送、L2延伸の複雑さには到底太刀打ちできません。かといって、高価な実機ルータやL3スイッチを何台も自宅に並べるのは現実的ではないはずです。

そこで注目したいのが、**AIエージェント（Antigravity）** と **Cisco Packet Tracer** を掛け合わせた実践型の学習スタイル。

GUIでちまちまとケーブルを配線し、機器をクリックしてコマンドを1行ずつ叩く時代は終わりました。AIと対話しながらトポロジをコード（Python/XML）で動的に組み立て、0から5ステップでエンタープライズ級のマルチサイトネットワークを立ち上げていく。その過程で、eBGP、OSPF Area 0、相互再配送（Mutual Redistribution）、VLAN/SVI、さらには広域専用線（COLT）によるL2延伸まで、実務直結のNWアーキテクチャを体系的に体得できます。

本記事では、各ステップで実際に **AIへ投入した指示プロンプト** と **生成されたPacket Tracerトポロジ画面** をすべて明記しながら、3拠点＋専用線接続のエンタープライズ環境を構築する全プロセスを解説します。最後に直面したリアルなトラブルシューティングの記録まで余すところなく公開します。

## ステップ0：手動GUIからの脱却と、AIによる .pkt 内部構造の解読

従来のネットワーク学習では、Packet Tracer のキャンバス上にルータアイコンをドラッグ＆ドロップし、マウスで線を1本ずつ結び、CLI ウィンドウを開いてホスト名や IP アドレスをポチポチ入力していました。正直、デバイスが10台を超えたあたりで配線ミスや設定漏れが多発し、本質的なルーティング学習に入る前に力尽きてしまいがちです。

### 「この作業、コードで自動化できないか？」から始まった調査

「インフラエンジニアたるもの、GUI の手作業から脱却してトポロジ構築を自動化したい」——そう考えたものの、Packet Tracer の独自保存形式である `.pkt` ファイルは一見するとブラックボックスなバイナリに見えます。

そこで、AI エージェント（Antigravity）に既存の `.pkt` ファイルを読み込ませ、内部構造の解析を依頼しました。

すると、驚くべき事実が判明します。
実は `.pkt` ファイルの実体は、デバイスの座標、ポート間の結線関係、さらには各機器の Cisco IOS スタートアップコンフィグまでがすべて **XML 形式のデータ構造** として記述され、圧縮されていたのです。

```
【AI による .pkt ファイル構造の解析結果】
.pkt (独自バイナリに見える保存ファイル)
 └── 実体は圧縮された XML データ構造
      ├── <NETWORK>: デバイス一覧（ルータ、スイッチ、PC の座標と機種型番）
      ├── <LINKS>: ポート結線情報（Fa0/1 <-> Gi0/0/0 などの配線定義）
      └── <DEVICE_CONFIG>: 各機器の Cisco IOS コンフィグ（BGP / OSPF / VLAN 設定そのもの）
```

### Python スクリプトによる .pkt 自動生成パイプラインの確立

「XML のスキーマさえ解析できれば、Python から動的にトポロジを組み立てて `.pkt` を直接生成できるのではないか？」

この仮説のもと、AI エージェントと対話しながら XML 生成ロジックを設計。要件（BGP AS 番号、IP アドレス設計、VLAN 割当）を自然言語で指示するだけで、AI が Python スクリプトを介して完全な `.pkt` ファイルを段階的にビルドする仕組みを確立しました。

```
【学習サイクルの変化】
従来: 手動GUI操作（70%） ──> コマンド打ち込み（20%） ──> 動作確認（10%）
AI活用: アーキテクチャ設計・壁打ち（30%） ──> 自動生成・展開（10%） ──> showコマンド＆パケット追跡・トラブルシュート（60%）
```

面倒なマウス操作や単純なタイピング作業はすべて AI に任せ、エンジニアは「パケットがどのプロトコル境界をどう越えていくか」「ルーティングテーブルにどう反映されるか」という**本質的な NW 設計と検証**に全エネルギーを注ぎ込めるようになったのです。

> [!NOTE]
> **利用環境とプロンプトに関する補足**
> - **シミュレータ環境**: 今回の検証は **Cisco Packet Tracer 9.0.1** を利用して実施しています。
> - **エージェント・モデル**: 今回は **Antigravity** で **Gemini 3.8 Flash** を使って検証を行いましたが、Claude や GPT などのその他エージェント／モデルでも全く問題なく動作します。
> - **プロンプトの粒度**: 本記事では再現性を高めるためパラメータを細かく指定したプロンプトを掲載していますが、もっと簡素なプロンプト（「ルータ2台でeBGPを組んで疎通させて」など）から対話型で進めていっても全く問題ありません。

![従来のネットワーク学習とAI活用の比較](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/datacenter_mesh.png)

---

## 全体スペック＆アーキテクチャ概要

この自動生成パイプラインを活用し、本記事で最終的に完成させるネットワークのスペックと採用技術は下表の通りです。Cisco Packet Tracer 9.0.1 上で、複数拠点データセンター（DC）の相互接続を模した本格構成を構築します。

| 項目                   | 採用技術・設計仕様                                                        |
| :--------------------- | :------------------------------------------------------------------------ |
| **シミュレータ環境**   | Cisco Packet Tracer 9.0.1                                                 |
| **WAN バックボーン**   | Catalyst 2960（L2 SW）、セグメント `10.0.0.0/24`                          |
| **拠点エッジルータ**   | Cisco ISR4331 × 3台（DC2: AS 20 / DC3: AS 30 / DC4: AS 40）               |
| **拠点コアスイッチ**   | Catalyst 3650 × 3台（CS2 / CS3 / CS4、L3ルーテッドポート接続）            |
| **拠点内ルーティング** | OSPF 1 Area 0（内部動的ルーティング）                                     |
| **WAN ルーティング**   | eBGP フルメッシュ（AS 20 ⇔ AS 30 ⇔ AS 40）                                |
| **再配送方式**         | BGP ⇔ OSPF 双方向再配送（Mutual Redistribution）                          |
| **アクセス層**         | Catalyst 2960 × 3台（802.1Q Trunk、VLAN 10, 20, 110, 120, 210, 220, 999） |
| **広域専用線（COLT）** | CS2 ⇔ CS3 間直接接続、VLAN 10/20 L2延伸 ＋ VLAN 999 OSPF Area 0 直接直通  |

### 各ステップの完成版 .pkt ファイル一覧（ダウンロード）

各ステップの検証完了時における Packet Tracer ファイル（.pkt）を以下よりダウンロードいただけます。手元で Packet Tracer 9.0.1 を起動し、各フェーズの設定内容やルーティング動作を直接ご確認いただけます。

| ステップ | 検証フェーズ・トポロジ内容 | .pkt ファイルダウンロード |
| :--- | :--- | :--- |
| **Step 1** | WAN バックボーン ＋ 2拠点 eBGP 構築 | [📥 Step1_WAN_Routers.pkt](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/Step1_WAN_Routers.pkt) |
| **Step 2** | 拠点コアスイッチ（L3SW）接続 ＋ OSPF・双方向再配送 | [📥 Step2_Routers_DCSwitches.pkt](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/Step2_Routers_DCSwitches.pkt) |
| **Step 3** | L2 スイッチ ＋ クライアント PC 追加（VLAN/SVI 通信） | [📥 Step3_AccessSwitches_PCs.pkt](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/Step3_AccessSwitches_PCs.pkt) |
| **Step 4** | 第3拠点（Site 4）追加 ＋ eBGP フルメッシュ | [📥 Step4_Site4_Added.pkt](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/Step4_Site4_Added.pkt) |
| **Step 5** | 専用線（COLT回線）開通 ＋ 広域 L2 延伸（完成版） | [📥 Step5_COLT_VLAN_Extension.pkt](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/Step5_COLT_VLAN_Extension.pkt) |

それでは、ステップ1から順に構築していきましょう。

---

## ステップ1：WAN Backbone と 2拠点（Site 2 / Site 3）エッジルータの構築

**目的**: 中央のWANスイッチと、2拠点（Site 2: AS 20、Site 3: AS 30）のルータ間を接続し、eBGPピアを確立して疎通を確認する。

### 投入したAIプロンプト

```text
Cisco Packet Tracer でマルチサイトネットワークの構築を開始します。
まずは【ステップ1：WANバックボーンと2拠点のルータネットワーク】を作成・設定してください。
【配置機器と接続】
1. WAN Backbone スイッチ:
   - 機種: Catalyst 2960 (名称: WAN)
   - サブネット: 10.0.0.0/24
2. 拠点ルータ（2台）:
   - Site 2: Cisco ISR4331 (名称: DC2, AS 20)
     - Gi0/0/0 を WANスイッチに接続（IP: 10.0.0.20/24）
     - Loopback0: 20.20.20.1/24
   - Site 3: Cisco ISR4331 (名称: DC3, AS 30)
     - Gi0/0/0 を WANスイッチに接続（IP: 10.0.0.30/24）
     - Loopback0: 30.30.30.1/24
【ルーティング設定】
- DC2 と DC3 の間で eBGP ピアを確立（DC2: neighbor 10.0.0.30 remote-as 30 / DC3: neighbor 10.0.0.20 remote-as 20）
- 各ルータの Loopback0 ネットワークを BGP で広報
【完了確認】
- DC2 ⇔ DC3 間で Ping が通ること
- `show ip bgp summary` で BGP ネイバーが Established になること
- `show ip route bgp` で相手拠点の Loopback0 が学習できていること
```

### 生成されたPacket Tracerトポロジ画面

![Step 1 トポロジ](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/step1_topology.png)

> [!TIP]
> **ダウンロード**: [📥 Step1_WAN_Routers.pkt](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/Step1_WAN_Routers.pkt)
> ※ Cisco Packet Tracer 9.0.1 以上で開いてそのまま検証可能です。

### コンフィグの要点（DC2 / DC3）

両ルータの `Gi0/0/0` を WAN スイッチ経由で同一セグメント（`10.0.0.0/24`）に収容し、互いを eBGP ネイバーとして指定します。広報対象として各拠点の `Loopback0` プレフィックスを登録します。

```cisco
! Site 2: DC2 (AS 20)
router bgp 20
 bgp router-id 20.20.20.1
 bgp log-neighbor-changes
 neighbor 10.0.0.30 remote-as 30
 neighbor 10.0.0.30 description TO_DC3_AS30
 network 20.20.20.0 mask 255.255.255.0
```

```cisco
! Site 3: DC3 (AS 30)
router bgp 30
 bgp router-id 30.30.30.1
 bgp log-neighbor-changes
 neighbor 10.0.0.20 remote-as 20
 neighbor 10.0.0.20 description TO_DC2_AS20
 network 30.30.30.0 mask 255.255.255.0
```

### 検証：show ip bgp summary

DC2 上で BGP ネイバーの状態を確認します。

```text
DC2# show ip bgp summary
Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
10.0.0.30       4    30      12      12        3    0    0 00:08:15        1
```

末尾の `State/PfxRcd` 列に `1`（受信プレフィックス数）が表示され、`Established` 状態であることが分かります。ここが `Active` や `Idle` の場合はネイバーのアドレス指定やインターフェースの疎通（Ping）を疑う必要があります。

Loopback0 を送信元にした対向宛ての Ping も無事疎通。
```cisco
DC2# ping 30.30.30.1 source loopback 0
!!!!!
Success rate is 100 percent (5/5)
```

---

## ステップ2：各拠点DCスイッチ（L3スイッチ）の接続と拠点内ルーティング

**目的**: 各ルータの配下にコアL3スイッチを接続し、拠点内の OSPF Area 0 とルータでの BGP ⇔ OSPF 相互再配送を設定する。

### 投入したAIプロンプト

```text
前回のステップ1に続き、【ステップ2：ルータへのDCスイッチ（L3スイッチ）接続とルーティング設定】を実施してください。
【追加機器と接続】
1. Site 2 DCスイッチ:
   - 機種: Catalyst 3650 または 3560 (名称: CS2)
   - CS2 Gi1/0/1 ⇔ DC2 Gi0/0/1 を接続（サブネット: 20.20.20.0/24）
     - DC2 Gi0/0/1: 20.20.20.254/24
     - CS2 Gi1/0/1 (no switchport): 20.20.20.1/24
   - Loopback0: 20.20.21.1/24
2. Site 3 DCスイッチ:
   - 機種: Catalyst 3650 または 3560 (名称: CS3)
   - CS3 Gi1/0/1 ⇔ DC3 Gi0/0/1 を接続（サブネット: 30.30.30.0/24）
     - DC3 Gi0/0/1: 30.30.30.254/24
     - CS3 Gi1/0/1 (no switchport): 30.30.30.1/24
   - Loopback0: 30.30.31.1/24
【ルーティング設定】
1. L3スイッチのIPルーティング有効化 (`ip routing`)
2. 拠点内 OSPF Area 0 設定:
   - DC2 ⇔ CS2 間、および CS2 の Loopback0 を OSPF 1 Area 0 に収容
   - DC3 ⇔ CS3 間、および CS3 の Loopback0 を OSPF 1 Area 0 に収容
3. 相互再配送（DC2 および DC3）:
   - BGP 側で `redistribute ospf 1 subnets`
   - OSPF 側で `redistribute bgp <AS番号> subnets`
【完了確認】
- CS2 ⇔ DC2、CS3 ⇔ DC3 間で OSPF ネイバーが FULL になること
- CS2 から CS3 の Loopback0（30.30.31.1）へ Ping が到達すること
```

### 生成されたPacket Tracerトポロジ画面

![Step 2 トポロジ](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/step2_topology.png)

> [!TIP]
> **ダウンロード**: [📥 Step2_Routers_DCSwitches.pkt](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/Step2_Routers_DCSwitches.pkt)
> ※ Cisco Packet Tracer 9.0.1 以上で開いてそのまま検証可能です。

### コンフィグの要点：双方向再配送

Catalyst 3650 側では `no switchport` でルーテッドポート化し、`ip routing` を有効化します。
肝となるのはエッジルータでの相互再配送です。

```cisco
! DC2 (ISR4331) での設定
router ospf 1
 router-id 2.2.2.2
 network 20.20.20.0 0.0.0.255 area 0
 redistribute bgp 20 subnets

router bgp 20
 network 20.20.20.0 mask 255.255.255.0
 network 20.20.21.0 mask 255.255.255.0
 redistribute ospf 1
```

> **注意ポイント**: OSPFにBGPを再配送する際は `subnets` オプションを忘れると、クラスレスなサブネットが注入されません。CCNAでも頻出の罠ですが、実務でもうっかり抜け落ちやすい箇所です。

### 検証：CS2 から対向 CS3 の Loopback への到達

CS2 のルーティングテーブルを確認すると、対向拠点（Site 3）のネットワークが OSPF 外部ルート（`O E2`）として正しく学習されていることが確認できます。

```text
CS2# show ip route ospf
O E2 30.30.30.0/24 [110/20] via 20.20.20.254, 00:02:15, GigabitEthernet1/0/1
O E2 30.30.31.0/24 [110/20] via 20.20.20.254, 00:02:15, GigabitEthernet1/0/1
```

CS2 から CS3（`30.30.31.1`）宛ての Ping も 100% 成功。L3スイッチ同士の拠点間ルーティングが開通しました。

---

## ステップ3：DCスイッチに接続するL2スイッチおよび端末（PC）の追加

**目的**: 各拠点内にアクセススイッチ（L2SW）とクライアント端末（PC）を追加し、VLAN・SVIを設定してサイト間（Site 2 ⇔ Site 3）でのPC間疎通を確認する。

### 投入したAIプロンプト

```text
前回のステップ2に続き、【ステップ3：各拠点のL2スイッチと端末（PC）の追加・接続】を実施してください。
【追加機器とVLAN/端末設計】
■ Site 2:
- L2スイッチ: Catalyst 2960 (名称: SW0)
  - CS2 Gi1/0/2 ⇔ SW0 Gi0/1 (Trunk接続)
- 端末:
  - PC0: VLAN 10 (IP: 10.0.10.1/24, GW: 10.0.10.254) → SW0 Fa0/1 (Access VLAN 10)
  - PC1: VLAN 20 (IP: 10.0.20.1/24, GW: 10.0.20.254) → SW0 Fa0/2 (Access VLAN 20)
  - PC6: VLAN 999 (IP: 10.0.1.1/24, GW: 10.0.1.254) → SW0 Fa0/3 (Access VLAN 999)
- CS2 上のSVI:
  - interface Vlan10 (10.0.10.254/24), Vlan20 (10.0.20.254/24), Vlan999 (10.0.1.254/24)
■ Site 3:
- L2スイッチ: Catalyst 2960 (名称: SW1)
  - CS3 Gi1/0/2 ⇔ SW1 Gi0/1 (Trunk接続)
- 端末:
  - PC2: VLAN 110 (IP: 10.1.10.1/24, GW: 10.1.10.254) → SW1 Fa0/1 (Access VLAN 110)
  - PC3: VLAN 120 (IP: 10.1.20.1/24, GW: 10.1.20.254) → SW1 Fa0/2 (Access VLAN 120)
- CS3 上のSVI:
  - interface Vlan110 (10.1.10.254/24), Vlan120 (10.1.20.254/24)
【ルーティング・広報設定】
- CS2, CS3 の OSPF または各DCルータの BGP network 文にて、各端末サブネット（10.0.10.0/24, 10.0.20.0/24, 10.0.1.0/24, 10.1.10.0/24, 10.1.20.0/24）を明示的に広報
【完了確認】
- 各PCから自身のデフォルトゲートウェイ（SVI）へ Ping が通ること
- Site 2 の PC0/PC1 から Site 3 の PC2/PC3 へ WAN 経由で Ping が通ること
```

### 生成されたPacket Tracerトポロジ画面

![Step 3 トポロジ](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/step3_topology.png)

> [!TIP]
> **ダウンロード**: [📥 Step3_AccessSwitches_PCs.pkt](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/Step3_AccessSwitches_PCs.pkt)
> ※ Cisco Packet Tracer 9.0.1 以上で開いてそのまま検証可能です。

### 設計のポイント：SVIと802.1Q Trunk

1. **アクセススイッチ（SW0/SW1）**:
   - コアスイッチ向けアップリンクを `switchport mode trunk` に設定し、必要 VLAN を許可。
   - 端末向けポートは `switchport mode access` で対応 VLAN に収容。
2. **コアスイッチ（CS2/CS3）**:
   - 各 VLAN に対応する SVI（`interface Vlan10`, `Vlan20` 等）を作成し、デフォルトゲートウェイ（`.254`）として機能させる。
   - SVI のサブネットを `router ospf 1` の `network` 文に追加。
3. **エッジルータ（DC2/DC3）**:
   - クライアントサブネットを BGP の `network` 文で明示的に広報。

### 検証：Traceroute によるパケット経路の可視化

Site 2 の PC0（`10.0.10.1`）から Site 3 の PC2（`10.1.10.1`）へ traceroute を実行した結果です。

```cmd
C:\> tracert 10.1.10.1
Tracing route to 10.1.10.1 over a maximum of 30 hops:
  1   <1 ms   <1 ms   <1 ms   10.0.10.254   (CS2: デフォルトGW)
  2    1 ms    1 ms    1 ms   20.20.20.254  (DC2: Site 2 エッジルータ)
  3    2 ms    2 ms    2 ms   10.0.0.30     (DC3: WAN 対向エッジルータ)
  4    3 ms    3 ms    3 ms   30.30.30.1    (CS3: Site 3 コアL3SW)
  5    4 ms    3 ms    4 ms   10.1.10.1     (PC2: 宛先端末)
Trace complete.
```

端末からデフォルトゲートウェイへ上がり、OSPFでエッジルータへ抜け、WAN（BGP）を越えて対向のOSPF・VLANへと届く。教科書通りの美しいルーティングホップが実測値として目の前に現れます。

---

## ステップ4：3つ目の拠点（Site 4）の追加

**目的**: 3つ目の拠点（Site 4: AS 40）をWANバックボーンに追加し、eBGPフルメッシュおよび拠点内ネットワーク（ルータ、L3SW、L2SW、PC）を構築して全拠点間の通信を確認する。

### 投入したAIプロンプト

```text
前回のステップ3に続き、【ステップ4：3つ目の拠点（Site 4）の追加】を実施してください。
【追加機器と接続】
1. Site 4 ルータ:
   - Cisco ISR4331 (名称: DC4, AS 40)
   - Gi0/0/0 を WANスイッチに接続（IP: 10.0.0.40/24）
   - Loopback0: 40.40.40.1/24
2. Site 4 DCスイッチ:
   - Catalyst 3650 または 3560 (名称: CS4)
   - CS4 Gi1/0/1 ⇔ DC4 Gi0/0/1（サブネット: 40.40.40.0/24, DC4: .254, CS4: .1）
   - Loopback0: 40.40.41.1/24
3. Site 4 L2スイッチ & 端末:
   - Catalyst 2960 (名称: SW3) ⇔ CS4 Gi1/0/2 (Trunk)
   - PC7: VLAN 210 (IP: 10.2.10.1/24, GW: 10.2.10.254) → SW3 Fa0/1 (Access VLAN 210)
   - PC8: VLAN 220 (IP: 10.2.20.1/24, GW: 10.2.20.254) → SW3 Fa0/2 (Access VLAN 220)
   - CS4 上のSVI: interface Vlan210 (10.2.10.254/24), Vlan220 (10.2.20.254/24)
【ルーティング設定】
1. eBGP フルメッシュ設定:
   - DC4 ⇔ DC2 (neighbor 10.0.0.20 remote-as 20)
   - DC4 ⇔ DC3 (neighbor 10.0.0.30 remote-as 30)
   - 既存の DC2 と DC3 にも DC4 (10.0.0.40 remote-as 40) のネイバー設定を追加
2. Site 4 拠点内ルーティング:
   - DC4 ⇔ CS4 間で OSPF 1 Area 0 を動作
   - DC4 で BGP ⇔ OSPF の相互再配送を設定
   - クライアント用サブネット（10.2.10.0/24, 10.2.20.0/24）を広報
【完了確認】
- DC2, DC3, DC4 の3台すべてで `show ip bgp summary` を確認し、フルメッシュで Established であること
- PC7/PC8 から Site 2 (PC0/PC1) および Site 3 (PC2/PC3) へ双方向 Ping が通ること
```

### 生成されたPacket Tracerトポロジ画面

![Step 4 トポロジ](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/step4_topology.png)

> [!TIP]
> **ダウンロード**: [📥 Step4_Site4_Added.pkt](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/Step4_Site4_Added.pkt)
> ※ Cisco Packet Tracer 9.0.1 以上で開いてそのまま検証可能です。

### フルメッシュeBGPの構成

WAN上で DC2 (AS 20) ⇔ DC3 (AS 30) ⇔ DC4 (AS 40) が相互にネイバーを組むフルメッシュ構成をとります。

```cisco
! DC4 (AS 40) での設定
router bgp 40
 bgp router-id 4.4.4.4
 neighbor 10.0.0.20 remote-as 20
 neighbor 10.0.0.20 description TO_DC2_AS20
 neighbor 10.0.0.30 remote-as 30
 neighbor 10.0.0.30 description TO_DC3_AS30
 network 10.2.10.0 mask 255.255.255.0
 network 10.2.20.0 mask 255.255.255.0
 network 40.40.40.0 mask 255.255.255.0
 network 40.40.41.0 mask 255.255.255.0
 redistribute ospf 1
```

既存の DC2 と DC3 にもそれぞれ `neighbor 10.0.0.40 remote-as 40` を追加。
これで全3拠点のエッジルータで相互に BGP 経路を交換し、3拠点間の端末同士（PC0/1/6 ⇔ PC2/3 ⇔ PC7/8）が自由に通信できるようになりました。

---

## ステップ5：Site 2 ⇔ Site 3 間の専用線「COLT回線」とVLAN延伸の追加

**目的**: Site 2（CS2）と Site 3（CS3）の間を直接つなぐ広域専用線「COLT回線」を開通させ、ダイナミックルーティングの切り替えおよび VLAN 10/20 の延伸収容スイッチ（SW2）と端末を追加する。

### 投入したAIプロンプト

```text
前回のステップ4に続き、最後のステップである【ステップ5：Site 2 ⇔ Site 3 間のCOLT回線とVLAN延伸の追加】を実施してください。
【追加機器と接続】
1. COLT回線（専用線直結）:
   - CS2 Gi1/0/10 ⇔ CS3 Gi1/0/10 を直接ケーブル接続
   - 両ポートを Trunkポートに設定（許可VLAN: 10, 20, 999）
2. VLAN延伸用スイッチ & 端末（Site 3側に設置）:
   - L2スイッチ: Catalyst 2960 (名称: SW2)
   - CS3 Gi1/0/3 ⇔ SW2 Gi0/1 (Trunk接続)
   - SW2 上で VLAN 10, 20 を作成
   - PC4: VLAN 10 (IP: 10.0.10.2/24, GW: 10.0.10.254) → SW2 Fa0/1 (Access VLAN 10)
   - PC5: VLAN 20 (IP: 10.0.20.2/24, GW: 10.0.20.254) → SW2 Fa0/2 (Access VLAN 20)
【COLT回線経由の動的ルーティング設定】
- CS2 と CS3 の VLAN 999（サブネット: 10.0.1.0/24）を OSPF 1 Area 0 に参加させる
  - CS2: interface Vlan999 (10.0.1.254/24)
  - CS3: interface Vlan999 (10.0.1.253/24)
- CS2 ⇔ CS3 間で VLAN 999 経由の直接 OSPF ネイバーが確立することを確認
【完了確認と経路検証】
1. L2延伸確認:
   - Site 3側の PC4 (10.0.10.2) から Site 2側の GW (10.0.10.254) および PC0 (10.0.10.1) へ同一VLANとして通信できること
   - Site 3側の PC5 (10.0.20.2) から Site 2側の GW (10.0.20.254) および PC1 (10.0.20.1) へ同一VLANとして通信できること
2. 最適経路確認（traceroute）:
   - Site 2 の端末から Site 3 の端末宛ての通信が、WAN（BGP経由）ではなく COLT回線（OSPF経由）を優先して通ることを確認
```

### 生成されたPacket Tracerトポロジ画面

![Step 5 トポロジ](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/step5_topology.png)

> [!TIP]
> **ダウンロード**: [📥 Step5_COLT_VLAN_Extension.pkt](https://raw.githubusercontent.com/lumichy/Qiita/main/public/antigravity-packet-tracer-nw-2026/Step5_COLT_VLAN_Extension.pkt)
> ※ Cisco Packet Tracer 9.0.1 以上で開いてそのまま検証可能です。

ここで実現した機能は以下の3つです：

1. **広域 L2 延伸（VLAN Extension）**:
   - Site 3 側に新設した **SW2** 配下の **PC4（`10.0.10.2`）** は、物理的には Site 3 に存在しますが、論理的には Site 2 の VLAN 10 と同一ブロードキャストドメインに属します。
   - デフォルトゲートウェイも Site 2 の CS2（`10.0.10.254`）をそのまま利用。
2. **COLT回線経由の直接 OSPF Area 0 ピアリング**:
   - COLT回線上に **VLAN 999（`10.0.1.0/24`）** を設定し、CS2（`10.0.1.254`）と CS3（`10.0.1.253`）間で直接 OSPF ネイバーを確立。
3. **トラフィックエンジニアリング（最適経路の自動選択）**:
   - WAN（BGP経由）よりも、低遅延なCOLT回線（OSPF Area 0 内部ルート）がルーティングテーブル上で自動的に優先されます。

### 検証①：同一VLAN内 L2 直通通信（TTLの検証）

Site 3 の延伸端末 PC4（`10.0.10.2`）から、Site 2 本社の PC0（`10.0.10.1`）へ Ping を実行します。

```cmd
PC4> ping 10.0.10.1
Reply from 10.0.10.1: bytes=32 time<1ms TTL=128
```

注目すべきは **`TTL=128`**。ルータを1ホップも経由していないため、TTLが一切減算されていません。遠く離れた拠点の端末が、まるで同じフロアの島ハブに繋がっているかのようにL2レベルで直通しています。

### 検証②：Traceroute による専用線優先ルーティングの証明

Site 2 の PC0（`10.0.10.1`）から Site 3 のネイティブ端末 PC2（`10.1.10.1`）宛てに経路追跡を実行します。

```cmd
PC0> tracert 10.1.10.1
Tracing route to 10.1.10.1 over a maximum of 30 hops:
  1   <1 ms   <1 ms   <1 ms   10.0.10.254  (CS2: デフォルトGW)
  2    1 ms    1 ms    1 ms   10.0.1.253   (CS3: ★COLT専用線 VLAN 999 経由！)
  3    2 ms    2 ms    2 ms   10.1.10.1    (PC2: Site 3 宛先端末)
Trace complete.
```

ステップ3では「CS2 ──> DC2 ──> DC3 ──> CS3」とWANルータを2台経由していましたが、COLT回線が開通したことで、**WANを経由せずコアスイッチ間がダイレクトに2ホップで直通** しています。ルーティングプロトコルのメトリック計算が狙い通りに機能した瞬間です。

---

## 実戦トラブルシューティング：Site 2 ⇔ Site 4 間の疎通不可をAIと解決する

ネットワーク構築にトラブルは付き物です。というか、トラブルを解決するときこそが最も知識が身につく瞬間でもあります。

実はステップ5の完了後、全拠点間の通信テストを行っていたところ、**Site 2 の端末（PC0: `10.0.10.1`）から Site 4 の端末（PC7: `10.2.10.1`）へ Ping が飛ばない** というクリティカルな事象に直面しました。

このトラブルシューティングも手動で悩み続けるのではなく、端末のコンソール出力をそのまま AI エージェントに投げて原因究明と修正を任せました。

### 投入したAIプロンプト

```text
最後に、トラブルシューティングしてください。
10.0.10.1から 10.2.10.1へPingは通れないです。
原因確認し修正してください。
C:\>ping 10.2.10.1

Pinging 10.2.10.1 with 32 bytes of data:

Reply from 10.0.10.254: Destination host unreachable.
Reply from 10.0.10.254: Destination host unreachable.
Reply from 10.0.10.254: Destination host unreachable.
Reply from 10.0.10.254: Destination host unreachable.
```

### AI による原因究明：Packet Tracer の仕様とルーティング連鎖

プロンプトを受け取った AI は、コンソールの挙動から即座に論理的な切り分けを行いました。

`Request timed out`（対向まで届いて戻りがないか、途中で破棄）ではなく、デフォルトゲートウェイである CS2（`10.0.10.254`）から直接 **`Destination host unreachable`** が返ってきています。つまり、端末の足元にあるゲートウェイ自身が「宛先ネットワークへの行き先がルーティングテーブルに存在しない」と判断してパケットを破棄していたのです。

AI が各機器のコンフィグとルーティングテーブルを精査した結果、以下の3点がボトルネックとして浮き彫りになりました。

1. **直接原因**:
   CS2 のルーティングテーブルに Site 4 のセグメント（`10.2.10.0/24`）の経路が存在せず、かつ外部へ抜けるためのデフォルトルート（`0.0.0.0/0`）も未登録だった。
2. **ルーティング再配送の制限**:
   ここが最大のハマりポイントでした。エッジルータ（DC2）上では確かに `redistribute bgp 20 subnets` を投入しており、BGP で受信した Site 4 の経路が OSPF に再配送される想定でした。しかし、Cisco Packet Tracer のシミュレータ仕様では、eBGP 経路の OSPF Type 5 LSA 注入が一部の条件下で不安定になる制約が存在したのです。
3. **戻りパケットの非対称性**:
   仮に行きパケットが Site 4 まで届いたとしても、対向の CS4 も同様に Site 2 宛てのデフォルトルートを保持しておらず、双方向でドロップする状態でした。

### 適用した恒久対策

AI はシミュレータ固有の再配送挙動に依存せず、実務のエンタープライズ設計標準に則った堅牢な構成パッチを提案・適用してくれました。

#### ① コアL3スイッチへのデフォルトルート設定
各拠点コアスイッチに、自拠点のエッジルータへ向かう明示的なデフォルトルートを追加しました。

```cisco
! CS2
ip route 0.0.0.0 0.0.0.0 20.20.20.254
ip route 10.2.10.0 255.255.255.0 20.20.20.254
ip route 10.2.20.0 255.255.255.0 20.20.20.254

! CS4
ip route 0.0.0.0 0.0.0.0 40.40.40.254
ip route 10.0.10.0 255.255.255.0 40.40.40.254
ip route 10.0.20.0 255.255.255.0 40.40.40.254
```

#### ② エッジルータでの OSPF デフォルトルート常時広報
DCルータ側の OSPF プロセスに `default-information originate always` を投入し、内部L3スイッチに対して常に自身が外部出口であることを宣言させました。

```cisco
! DC2 / DC3 / DC4 共通
router ospf 1
 default-information originate always
```

この対策を適用した直後、PC0 から PC7 への Ping は見事に `100% 成功`。

```cmd
PC0> ping 10.2.10.1
Pinging 10.2.10.1 with 32 bytes of data:
Reply from 10.2.10.1: bytes=32 time=12ms TTL=126
Reply from 10.2.10.1: bytes=32 time=11ms TTL=126
Ping statistics for 10.2.10.1:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)
```

単に「動いた」で終わらせず、パケットがどこで捨てられ、ルーティングテーブルの何が欠落していたのかを突き止めるプロセスこそ、現場で最も役に立つスキルだと痛感した瞬間でした。

---

## まとめ：AI時代のインフラ学習は「実践と検証」へ

AIの急速な進化によって、スクリプトの自動生成や設定テンプレートの作成は一瞬で終わるようになりました。だからこそ、人間であるエンジニアが身につけるべき価値は「全体のアーキテクチャをどう設計するか」、そして「動かなかったときにプロトコルの原則から原因を論理的に切り分けられるか」にシフトしています。

Packet Tracer と AI を組み合わせれば、個人でもエンタープライズ規模の複雑なトポロジを短時間で立ち上げ、失敗しながら深く学ぶことができます。

本記事の構成に挑戦してみたい方、あるいは BGP や OSPF の再配送設計で似たようなトラブルに遭遇した経験がある方は、ぜひコメント欄でご意見やご感想をお聞かせください！

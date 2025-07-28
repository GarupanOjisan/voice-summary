# 音声文字起こしアプリ PoC ローカルアーキテクチャ設計

## 0. 目的

ユーザー PC 上で動作する単一ユーザー用アプリとして、Zoom／Google Meet などの会議音声を自動取得し、外部 API・ローカルライブラリで文字起こし後、選択可能な LLM で議論要約・整理を行う。

---

## 1. 前提

* **同時ユーザー数**: 1（画面共有で他参加者は閲覧）
* **ネット接続**: 必須（外部 STT/LLM API 利用想定）
* **データ保存**: ローカルファイル出力のみ（JSON / Markdown）
* **プラットフォーム**: Windows 10+ / macOS 12+ / Ubuntu 22.04（Electron/Tauri クロスプラットフォーム）

---

## 2. 機能要件

| 区分     | 内容                                                                                 |
| ------ | ---------------------------------------------------------------------------------- |
| 音声取得   | Loopback (Windows WASAPI, macOS CoreAudio, Linux PulseAudio) でシステム音声キャプチャ／マイク混合    |
| 文字起こし  | Whisper.cpp (local CPU/GPU) **または** AssemblyAI / Deepgram / Google STT API ストリーミング |
| 話者分離   | シンプルな「話者1(自分)/話者2(他)」タグ付け or 任意：pyannote.audio (ローカル)                              |
| 要約・整理  | プラガブル LLM: OpenAI GPT‑4o / Google Gemini 1.5 Pro / Local Llama 3 70B (gguf) から選択   |
| UI     | Electron + React でライブ文字起こし表示・テーマ別クラスタ・要約パネル                                        |
| エクスポート | .md / .txt / .json 形式で保存；ワンクリックコピー                                                 |

---

## 3. システム構成

```
┌──────────────────────────────┐
│         Desktop App (Electron) │
│  ┌───────────┐  ┌────────────┐ │
│  │ Audio Capt │→│  STT Engine │─┐
│  └───────────┘  │ (API / Lcl) │ │
│                   └────────────┘ │
│                                   │
│  ┌───────────┐  ┌────────────┐  │
│  │  LLM Core │←│ Transcript  │←┘
│  │  (API/Lcl)│  │ Aggregator │
│  └───────────┘  └────────────┘
│         │               │
│         ▼               ▼
│  ┌────────────┐   ┌────────────┐
│  │   UI Live  │   │ File Export│
│  └────────────┘   └────────────┘
└──────────────────────────────┘
```

### コンポーネント詳細

1. **Audio Capture**: OS ループバック API で会議音声を取得。オプションで仮想オーディオケーブルを自動生成。
2. **STT Engine**: ユーザー設定で `local_whisper` / `assemblyai` / `gcp_stt` などを切替。ストリーミング API 呼び出しは WebSocket／HTTP2。
3. **Transcript Aggregator**: 部分文字列を時系列マージ。500 ms バッチで更新。
4. **LLM Core**: 抽象ラッパー(`LLMProvider`)で OpenAI / Gemini / LocalLlama を切替。プロンプトテンプレートは共通。
5. **UI Live**: React + Zustand で状態管理。タブ：`Transcript`・`Topics`・`Highlights`。
6. **File Export**: Electron ファイルダイアログで保存先選択し、JSON/Markdown 生成。

---

## 4. 技術選定理由

| レイヤ    | 技術                                           | 理由                          |
| ------ | -------------------------------------------- | --------------------------- |
| デスクトップ | Electron (Node + Chromium)                   | 最短でマルチ OS 配布可、豊富なネイティブモジュール |
| オーディオ  | `node-core-audio` / `electron-audio-capture` | OS ループバック取得実績あり             |
| STT    | Whisper.cpp / AssemblyAI / Deepgram          | ローカル・クラウド両対応で精度とコストを柔軟に最適化  |
| LLM    | OpenAI / Gemini / Llama3 gguf + llamacpp     | オンライン/オフライン切替、コスト制御         |
| UI     | React + TailwindCSS                          | 開発効率・カスタマイズ性                |

---

## 5. データフロー詳細

1. **Audio Capture** が PCM ストリームを **STT Engine** へ送信
2. **STT Engine** が 250 ms チャンク毎に部分文字起こしを返却
3. **Transcript Aggregator** がバッファし、2 秒ごとに UI へ配信
4. **LLM Core** が最新 15 s の発話をプロンプト化し要約＆トピック抽出
5. UI がカード形式でリアルタイム表示
6. セッション終了時に **File Export** が全文＋要約を保存

---

## 6. 開発ロードマップ (PoC)

| 週 | マイルストーン                               |
| - | ------------------------------------- |
| 0 | プロジェクト雛形 (Electron + React) 作成        |
| 1 | Audio Capture 実装 (Win/Mac) & WAV ログ確認 |
| 2 | Whisper.cpp ストリーミング統合、文字起こし表示         |
| 3 | LLM 要約 (OpenAI) 統合、簡易 UI 完成           |
| 4 | Export 機能追加、ユーザーテスト & フィードバック         |

---

## 7. リスク

| リスク             | 対策                                   |
| --------------- | ------------------------------------ |
| OS ごとのループバック実装差 | Electron Builder で OS 分け、検証パイプライン整備  |
| ネット帯域不足で API 遅延 | ローカル Whisper fallback、自動切替ルール        |
| LLM 推論コスト       | Local Llama モードで無料運用、モデルダウンロード UI 案内 |

---

## 8. 次ステップ

1. Audio Capture プロトタイプの技術検証（WASAPI loopback, CoreAudio）
2. Whisper.cpp vs Cloud STT の精度/レイテンシ比較
3. プロンプトテンプレートのドラフト作成（要約/トピック/アクションアイテム）
4. UI ワイヤーフレーム作成 & ユーザーヒアリング

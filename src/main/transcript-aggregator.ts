import { EventEmitter } from 'events';

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  speaker?: string;
  isFinal: boolean;
  language?: string;
  timestamp: number;
}

export interface AggregatedTranscript {
  id: string;
  segments: TranscriptSegment[];
  totalDuration: number;
  startTime: number;
  endTime: number;
  speakerCount: number;
  wordCount: number;
  averageConfidence: number;
  languages: string[];
}

export interface TranscriptAggregatorConfig {
  batchInterval: number; // ミリ秒
  maxSegmentGap: number; // ミリ秒
  minSegmentDuration: number; // ミリ秒
  confidenceThreshold: number; // 0-1
  enableSpeakerSeparation: boolean;
  enableAutoCleanup: boolean;
  cleanupInterval: number; // ミリ秒
  maxSegmentsInMemory: number;
}

export interface SpeakerInfo {
  id: string;
  name?: string;
  color?: string;
  totalSegments: number;
  totalDuration: number;
  averageConfidence: number;
}

export class TranscriptAggregator extends EventEmitter {
  private config: TranscriptAggregatorConfig;
  private segments: TranscriptSegment[] = [];
  private aggregatedTranscripts: AggregatedTranscript[] = [];
  private speakers: Map<string, SpeakerInfo> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isActive = false;
  private sessionStartTime = 0;
  private currentSessionId = '';

  constructor(config: Partial<TranscriptAggregatorConfig> = {}) {
    super();
    this.config = {
      batchInterval: 500,
      maxSegmentGap: 2000,
      minSegmentDuration: 100,
      confidenceThreshold: 0.3,
      enableSpeakerSeparation: true,
      enableAutoCleanup: true,
      cleanupInterval: 30000,
      maxSegmentsInMemory: 10000,
      ...config,
    };
  }

  /**
   * セッションを開始
   */
  startSession(sessionId?: string): void {
    if (this.isActive) {
      this.stopSession();
    }

    this.currentSessionId = sessionId || `session_${Date.now()}`;
    this.sessionStartTime = Date.now();
    this.isActive = true;
    this.segments = [];
    this.speakers.clear();

    // バッチ処理タイマーを開始
    this.startBatchTimer();
    
    // 自動クリーンアップタイマーを開始
    if (this.config.enableAutoCleanup) {
      this.startCleanupTimer();
    }

    this.emit('sessionStarted', { sessionId: this.currentSessionId, startTime: this.sessionStartTime });
  }

  /**
   * セッションを停止
   */
  stopSession(): AggregatedTranscript | null {
    if (!this.isActive) {
      return null;
    }

    this.isActive = false;
    this.stopBatchTimer();
    this.stopCleanupTimer();

    // 最後のバッチを処理
    const finalTranscript = this.processBatch();

    this.emit('sessionStopped', { 
      sessionId: this.currentSessionId, 
      transcript: finalTranscript 
    });

    return finalTranscript;
  }

  /**
   * 部分文字起こしデータを追加
   */
  addSegment(segment: Omit<TranscriptSegment, 'id' | 'timestamp'>): void {
    if (!this.isActive) {
      return;
    }

    // 信頼度フィルタリング
    if (segment.confidence < this.config.confidenceThreshold) {
      return;
    }

    // 最小継続時間フィルタリング
    if (segment.endTime - segment.startTime < this.config.minSegmentDuration) {
      return;
    }

    // データ正規化・クリーニング
    const cleanedSegment = this.cleanAndNormalizeSegment(segment);

    // 話者分離処理
    if (this.config.enableSpeakerSeparation && !cleanedSegment.speaker) {
      cleanedSegment.speaker = this.detectSpeaker(cleanedSegment);
    }

    // セグメントを追加
    const processedSegment: TranscriptSegment = {
      ...cleanedSegment,
      id: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.segments.push(processedSegment);

    // 話者情報を更新
    this.updateSpeakerInfo(processedSegment);

    this.emit('segmentAdded', processedSegment);
  }

  /**
   * データ正規化・クリーニング
   */
  private cleanAndNormalizeSegment(segment: Omit<TranscriptSegment, 'id' | 'timestamp'>): Omit<TranscriptSegment, 'id' | 'timestamp'> {
    let cleanedText = segment.text.trim();

    // 不要な文字の除去
    cleanedText = cleanedText.replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\uF900-\uFAFF\u3300-\u33FF\uFE30-\uFE4F\uFF00-\uFFEF\u3000-\u303F\u2000-\u206F\u2100-\u214F\u2190-\u21FF\u2200-\u22FF\u2300-\u23FF\u2400-\u243F\u2440-\u245F\u2460-\u24FF\u2500-\u257F\u2580-\u259F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u27C0-\u27EF\u27F0-\u27FF\u2800-\u28FF\u2900-\u297F\u2980-\u29FF\u2A00-\u2AFF\u2B00-\u2BFF\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2DE0-\u2DFF\u2E00-\u2E7F\u2E80-\u2EFF\u2F00-\u2FDF\u2FF0-\u2FFF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31A0-\u31BF\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FAF\uF900-\uFAFF\uFB00-\uFB4F\uFB50-\uFDFF\uFE00-\uFE0F\uFE10-\uFE1F\uFE20-\uFE2F\uFE30-\uFE4F\uFE50-\uFE6F\uFE70-\uFEFF\uFF00-\uFFEF\uFFF0-\uFFFF.,!?;:()\[\]{}"'\-]/g, '');

    // 連続する空白の正規化
    cleanedText = cleanedText.replace(/\s+/g, ' ');

    // 句読点の正規化
    cleanedText = cleanedText.replace(/[。．]/g, '。');
    cleanedText = cleanedText.replace(/[、，]/g, '、');
    cleanedText = cleanedText.replace(/[！!]/g, '！');
    cleanedText = cleanedText.replace(/[？?]/g, '？');

    // 空文字列の場合は除外
    if (!cleanedText) {
      throw new Error('クリーニング後のテキストが空です');
    }

    return {
      ...segment,
      text: cleanedText,
      confidence: Math.max(0, Math.min(1, segment.confidence)), // 0-1の範囲に正規化
    };
  }

  /**
   * 話者検出（簡易版）
   */
  private detectSpeaker(segment: Omit<TranscriptSegment, 'id' | 'timestamp'>): string {
    // 簡易的な話者検出ロジック
    // 実際の実装では、音声の特徴量分析や機械学習モデルを使用
    
    const recentSegments = this.segments.slice(-10);
    if (recentSegments.length === 0) {
      return 'speaker_1';
    }

    // 時間間隔が短い場合は同じ話者と仮定
    const lastSegment = recentSegments[recentSegments.length - 1];
    const timeGap = segment.startTime - lastSegment.endTime;
    
    if (timeGap < 1000) { // 1秒以内
      return lastSegment.speaker || 'speaker_1';
    }

    // 異なる話者として扱う
    const existingSpeakers = new Set(recentSegments.map(s => s.speaker).filter(Boolean));
    const speakerCount = existingSpeakers.size;
    
    return `speaker_${speakerCount + 1}`;
  }

  /**
   * 話者情報を更新
   */
  private updateSpeakerInfo(segment: TranscriptSegment): void {
    if (!segment.speaker) {
      return;
    }

    const speakerId = segment.speaker;
    const existingSpeaker = this.speakers.get(speakerId);

    if (existingSpeaker) {
      existingSpeaker.totalSegments++;
      existingSpeaker.totalDuration += segment.endTime - segment.startTime;
      existingSpeaker.averageConfidence = 
        (existingSpeaker.averageConfidence * (existingSpeaker.totalSegments - 1) + segment.confidence) / 
        existingSpeaker.totalSegments;
    } else {
      this.speakers.set(speakerId, {
        id: speakerId,
        name: `話者${speakerId.split('_')[1]}`,
        color: this.generateSpeakerColor(speakerId),
        totalSegments: 1,
        totalDuration: segment.endTime - segment.startTime,
        averageConfidence: segment.confidence,
      });
    }
  }

  /**
   * 話者用の色を生成
   */
  private generateSpeakerColor(speakerId: string): string {
    const colors = [
      '#3B82F6', // blue
      '#EF4444', // red
      '#10B981', // green
      '#F59E0B', // yellow
      '#8B5CF6', // purple
      '#F97316', // orange
      '#06B6D4', // cyan
      '#EC4899', // pink
    ];
    
    const speakerNumber = parseInt(speakerId.split('_')[1]) || 1;
    return colors[(speakerNumber - 1) % colors.length];
  }

  /**
   * バッチ処理タイマーを開始
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.processBatch();
    }, this.config.batchInterval);
  }

  /**
   * バッチ処理タイマーを停止
   */
  private stopBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * クリーンアップタイマーを開始
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldSegments();
    }, this.config.cleanupInterval);
  }

  /**
   * クリーンアップタイマーを停止
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * バッチ処理を実行
   */
  private processBatch(): AggregatedTranscript | null {
    if (this.segments.length === 0) {
      return null;
    }

    // 時系列でソート
    const sortedSegments = [...this.segments].sort((a, b) => a.startTime - b.startTime);

    // セグメントをマージ
    const mergedSegments = this.mergeSegments(sortedSegments);

    // 集約トランスクリプトを作成
    const aggregatedTranscript: AggregatedTranscript = {
      id: this.currentSessionId,
      segments: mergedSegments,
      totalDuration: mergedSegments.length > 0 ? 
        mergedSegments[mergedSegments.length - 1].endTime - mergedSegments[0].startTime : 0,
      startTime: mergedSegments.length > 0 ? mergedSegments[0].startTime : this.sessionStartTime,
      endTime: mergedSegments.length > 0 ? mergedSegments[mergedSegments.length - 1].endTime : Date.now(),
      speakerCount: this.speakers.size,
      wordCount: this.calculateWordCount(mergedSegments),
      averageConfidence: this.calculateAverageConfidence(mergedSegments),
      languages: this.extractLanguages(mergedSegments),
    };

    this.aggregatedTranscripts.push(aggregatedTranscript);

    this.emit('batchProcessed', aggregatedTranscript);
    return aggregatedTranscript;
  }

  /**
   * セグメントをマージ
   */
  private mergeSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
    if (segments.length === 0) {
      return [];
    }

    const merged: TranscriptSegment[] = [];
    let currentSegment = { ...segments[0] };

    for (let i = 1; i < segments.length; i++) {
      const nextSegment = segments[i];
      const gap = nextSegment.startTime - currentSegment.endTime;

      // 同じ話者で時間間隔が短い場合はマージ
      if (currentSegment.speaker === nextSegment.speaker && 
          gap <= this.config.maxSegmentGap) {
        currentSegment.text += ' ' + nextSegment.text;
        currentSegment.endTime = nextSegment.endTime;
        currentSegment.confidence = (currentSegment.confidence + nextSegment.confidence) / 2;
        currentSegment.isFinal = currentSegment.isFinal && nextSegment.isFinal;
      } else {
        merged.push(currentSegment);
        currentSegment = { ...nextSegment };
      }
    }

    merged.push(currentSegment);
    return merged;
  }

  /**
   * 単語数を計算
   */
  private calculateWordCount(segments: TranscriptSegment[]): number {
    return segments.reduce((total, segment) => {
      const words = segment.text.trim().split(/\s+/).length;
      return total + words;
    }, 0);
  }

  /**
   * 平均信頼度を計算
   */
  private calculateAverageConfidence(segments: TranscriptSegment[]): number {
    if (segments.length === 0) {
      return 0;
    }
    
    const totalConfidence = segments.reduce((sum, segment) => sum + segment.confidence, 0);
    return totalConfidence / segments.length;
  }

  /**
   * 言語を抽出
   */
  private extractLanguages(segments: TranscriptSegment[]): string[] {
    const languages = new Set<string>();
    segments.forEach(segment => {
      if (segment.language) {
        languages.add(segment.language);
      }
    });
    return Array.from(languages);
  }

  /**
   * 古いセグメントをクリーンアップ
   */
  private cleanupOldSegments(): void {
    if (this.segments.length <= this.config.maxSegmentsInMemory) {
      return;
    }

    // 古いセグメントを削除（メモリ使用量を制限）
    const segmentsToKeep = this.config.maxSegmentsInMemory;
    this.segments = this.segments.slice(-segmentsToKeep);

    this.emit('segmentsCleaned', { remainingSegments: this.segments.length });
  }

  /**
   * 現在のセッション情報を取得
   */
  getCurrentSession(): {
    sessionId: string;
    startTime: number;
    isActive: boolean;
    segmentCount: number;
    speakerCount: number;
  } {
    return {
      sessionId: this.currentSessionId,
      startTime: this.sessionStartTime,
      isActive: this.isActive,
      segmentCount: this.segments.length,
      speakerCount: this.speakers.size,
    };
  }

  /**
   * 話者情報を取得
   */
  getSpeakers(): SpeakerInfo[] {
    return Array.from(this.speakers.values());
  }

  /**
   * 集約されたトランスクリプトを取得
   */
  getAggregatedTranscripts(): AggregatedTranscript[] {
    return [...this.aggregatedTranscripts];
  }

  /**
   * 最新の集約トランスクリプトを取得
   */
  getLatestTranscript(): AggregatedTranscript | null {
    if (this.aggregatedTranscripts.length === 0) {
      return null;
    }
    return this.aggregatedTranscripts[this.aggregatedTranscripts.length - 1];
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<TranscriptAggregatorConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): TranscriptAggregatorConfig {
    return { ...this.config };
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.stopSession();
    this.segments = [];
    this.aggregatedTranscripts = [];
    this.speakers.clear();
    this.emit('cleanup');
  }
} 

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MainTabs from './components/MainTabs';
import { useTranscriptionStore } from './stores/transcriptionStore';

const App: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { addSegment, setSTTActive } = useTranscriptionStore();

  useEffect(() => {
    console.log('🎯 App.tsx: IPCイベントリスナーを設定します');

    // 文字起こし結果イベントリスナー
    const handleTranscriptionUpdate = (data: any) => {
      console.log('🎯 文字起こし結果を受信:', data);
      console.log('🎯 受信データの詳細:', {
        text: data.text,
        textType: typeof data.text,
        textLength: data.text?.length,
        trimmed: data.text?.trim(),
        trimmedLength: data.text?.trim()?.length
      });
      
      // 一時的に空文字フィルタリングを緩める（デバッグ用）
      const text = data.text || '';
      const trimmedText = text.trim();
      
      if (text === null || text === undefined) {
        console.log('🎯 null/undefinedのため文字起こし結果をスキップしました');
        return;
      }
      
      // storeに新しいセグメントとして追加（空文字でも追加してみる）
      const segment = {
        id: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: text, // 元のテキストをそのまま使用
        startTime: Date.now() - 2000, // 2秒前を仮の開始時間とする
        endTime: Date.now(),
        confidence: data.confidence || 0.95,
        speaker: data.speaker || 'Unknown',
        timestamp: data.timestamp || Date.now(),
        isFinal: data.isFinal !== false, // デフォルトはtrue
      };

      console.log('🎯 作成したセグメント:', {
        id: segment.id.slice(-8),
        text: segment.text,
        timestamp: segment.timestamp
      });
      console.log('🎯 storeにセグメントを追加:', segment);
      addSegment(segment);
    };

    // STTストリーミング状態イベントリスナー
    const handleSTTStreamingStatus = (data: any) => {
      console.log('🎯 STTストリーミング状態を受信:', data);
      if (data && typeof data.isActive === 'boolean') {
        console.log('🎯 STTストリーミング状態をstoreに反映:', data.isActive);
        setSTTActive(data.isActive);
      }
    };

    // STTエラーイベントリスナー
    const handleSTTError = (error: any) => {
      console.error('🎯 STTエラー:', error);
    };

    // IPCイベントリスナーを登録
    window.electronAPI.onTranscriptionUpdate(handleTranscriptionUpdate);
    window.electronAPI.onSttStreamingStatus(handleSTTStreamingStatus);
    window.electronAPI.onSttError(handleSTTError);

    console.log('🎯 IPCイベントリスナーの設定が完了しました');

    // クリーンアップ関数（実際にはelectronAPIには削除機能がないため、参考として）
    return () => {
      console.log('🎯 App.tsx: クリーンアップ');
    };
  }, [addSegment, setSTTActive]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* ヘッダー（固定高さ） */}
      <div className="flex-shrink-0 h-16">
        <Header />
      </div>

      {/* メインコンテンツ（残りのスペース） */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
        {/* サイドバー（固定幅） */}
        <div className="flex-shrink-0">
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>

        {/* メインエリア（残りのスペース） */}
        <div className="flex-1 overflow-hidden">
          <MainTabs />
        </div>
      </div>
    </div>
  );
};

export default App;

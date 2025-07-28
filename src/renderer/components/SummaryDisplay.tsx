import React, { useState, useEffect, useRef } from 'react';

interface SummaryResult {
  id: string;
  type: 'summary' | 'topics' | 'action_items' | 'discussion_analysis' | 'meeting_minutes';
  content: string;
  topics?: string[];
  actionItems?: string[];
  confidence?: number;
  timestamp: number;
  duration: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface TopicCluster {
  id: string;
  name: string;
  keywords: string[];
  segments: string[];
  confidence: number;
  timestamp: number;
  duration: number;
}

interface SummaryDisplayProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  showConfidence?: boolean;
  showUsage?: boolean;
  maxHeight?: string;
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({
  autoRefresh = true,
  refreshInterval = 5000,
  showConfidence = true,
  showUsage = true,
  maxHeight = '600px',
}) => {
  const [summaries, setSummaries] = useState<SummaryResult[]>([]);
  const [topicClusters, setTopicClusters] = useState<TopicCluster[]>([]);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'topics' | 'action_items' | 'clusters'>('summary');
  const [displaySettings, setDisplaySettings] = useState({
    autoRefresh,
    showConfidence,
    showUsage,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSummaryData();
    
    if (displaySettings.autoRefresh) {
      const interval = setInterval(loadSummaryData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, displaySettings.autoRefresh]);

  const loadSummaryData = async () => {
    try {
      // 実際の実装ではIPCを通じてメインプロセスからデータを取得
      // ここではモックデータを使用
      const mockSummaries: SummaryResult[] = [
        {
          id: 'summary-1',
          type: 'summary',
          content: 'プロジェクトの進捗について話し合いました。技術的な課題の報告とスケジュール調整の提案が行われました。',
          confidence: 0.85,
          timestamp: Date.now() - 30000,
          duration: 2500,
          usage: {
            promptTokens: 150,
            completionTokens: 80,
            totalTokens: 230,
          },
        },
        {
          id: 'topics-1',
          type: 'topics',
          content: '主要なトピックを抽出しました',
          topics: ['プロジェクト計画', '技術的課題', 'スケジュール調整', 'リソース配分'],
          confidence: 0.78,
          timestamp: Date.now() - 15000,
          duration: 1800,
          usage: {
            promptTokens: 120,
            completionTokens: 60,
            totalTokens: 180,
          },
        },
        {
          id: 'action-1',
          type: 'action_items',
          content: 'アクションアイテムを抽出しました',
          actionItems: ['Aさん: 技術仕様書の作成', 'Bさん: チーム会議のスケジュール調整', 'Cさん: 予算の見直し'],
          confidence: 0.82,
          timestamp: Date.now() - 5000,
          duration: 2200,
          usage: {
            promptTokens: 140,
            completionTokens: 70,
            totalTokens: 210,
          },
        },
      ];

      const mockTopicClusters: TopicCluster[] = [
        {
          id: 'cluster-1',
          name: 'プロジェクト管理',
          keywords: ['計画', 'スケジュール', '進捗'],
          segments: ['プロジェクト計画', 'スケジュール調整'],
          confidence: 0.75,
          timestamp: Date.now() - 10000,
          duration: 0,
        },
        {
          id: 'cluster-2',
          name: '技術的課題',
          keywords: ['技術', '課題', '実装'],
          segments: ['技術的課題', '実装方法'],
          confidence: 0.68,
          timestamp: Date.now() - 8000,
          duration: 0,
        },
      ];

      setSummaries(mockSummaries);
      setTopicClusters(mockTopicClusters);
      setIsActive(true);
      setCurrentSession({
        id: 'session-1',
        startTime: Date.now() - 60000,
        totalSummaries: mockSummaries.length,
        averageConfidence: 0.82,
        totalTokens: 620,
        totalCost: 0.0062,
      });
    } catch (err) {
      setError('要約データの読み込みに失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (duration: number): string => {
    const seconds = Math.floor(duration / 1000);
    return `${seconds}s`;
  };

  const getSummaryTypeLabel = (type: string): string => {
    switch (type) {
      case 'summary':
        return '要約';
      case 'topics':
        return 'トピック';
      case 'action_items':
        return 'アクション';
      case 'discussion_analysis':
        return '分析';
      case 'meeting_minutes':
        return '議事録';
      default:
        return type;
    }
  };

  const getSummaryTypeColor = (type: string): string => {
    switch (type) {
      case 'summary':
        return 'bg-blue-100 text-blue-800';
      case 'topics':
        return 'bg-green-100 text-green-800';
      case 'action_items':
        return 'bg-orange-100 text-orange-800';
      case 'discussion_analysis':
        return 'bg-purple-100 text-purple-800';
      case 'meeting_minutes':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleManualRefresh = () => {
    loadSummaryData();
  };

  const handleClearSummaries = () => {
    if (confirm('要約データをクリアしますか？')) {
      setSummaries([]);
      setTopicClusters([]);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-600">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium">エラー</div>
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-gray-900">リアルタイム要約</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isActive ? '実行中' : '停止中'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleManualRefresh}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            title="手動更新"
          >
            更新
          </button>
          <button
            onClick={handleClearSummaries}
            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            title="要約をクリア"
          >
            クリア
          </button>
        </div>
      </div>

      {/* 設定パネル */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-4 text-sm">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={displaySettings.autoRefresh}
              onChange={(e) => setDisplaySettings(prev => ({ ...prev, autoRefresh: e.target.checked }))}
              className="mr-2"
            />
            自動更新
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={displaySettings.showConfidence}
              onChange={(e) => setDisplaySettings(prev => ({ ...prev, showConfidence: e.target.checked }))}
              className="mr-2"
            />
            信頼度表示
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={displaySettings.showUsage}
              onChange={(e) => setDisplaySettings(prev => ({ ...prev, showUsage: e.target.checked }))}
              className="mr-2"
            />
            使用量表示
          </label>
        </div>
      </div>

      {/* セッション情報 */}
      {currentSession && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-2">セッション情報</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-blue-700">{currentSession.totalSummaries}</div>
              <div className="text-blue-600">要約数</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-700">{(currentSession.averageConfidence * 100).toFixed(1)}%</div>
              <div className="text-blue-600">平均信頼度</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-700">{currentSession.totalTokens}</div>
              <div className="text-blue-600">総トークン数</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-700">${currentSession.totalCost.toFixed(4)}</div>
              <div className="text-blue-600">総コスト</div>
            </div>
          </div>
        </div>
      )}

      {/* タブ */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'summary', label: '要約' },
            { id: 'topics', label: 'トピック' },
            { id: 'action_items', label: 'アクション' },
            { id: 'clusters', label: 'クラスター' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* コンテンツ */}
      <div
        ref={scrollContainerRef}
        className="border rounded-lg p-4 bg-gray-50"
        style={{ maxHeight, overflowY: 'auto' }}
      >
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {summaries.filter(s => s.type === 'summary').map((summary) => (
              <div key={summary.id} className="p-4 bg-white rounded-lg border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded ${getSummaryTypeColor(summary.type)}`}>
                      {getSummaryTypeLabel(summary.type)}
                    </span>
                    {displaySettings.showConfidence && (
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {(summary.confidence! * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimestamp(summary.timestamp)} ({formatDuration(summary.duration)})
                  </div>
                </div>
                <div className="text-gray-800 leading-relaxed mb-2">
                  {summary.content}
                </div>
                {displaySettings.showUsage && summary.usage && (
                  <div className="text-xs text-gray-500">
                    トークン: {summary.usage.totalTokens} (入力: {summary.usage.promptTokens}, 出力: {summary.usage.completionTokens})
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'topics' && (
          <div className="space-y-4">
            {summaries.filter(s => s.type === 'topics').map((summary) => (
              <div key={summary.id} className="p-4 bg-white rounded-lg border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded ${getSummaryTypeColor(summary.type)}`}>
                      {getSummaryTypeLabel(summary.type)}
                    </span>
                    {displaySettings.showConfidence && (
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {(summary.confidence! * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimestamp(summary.timestamp)} ({formatDuration(summary.duration)})
                  </div>
                </div>
                {summary.topics && (
                  <div className="space-y-2">
                    {summary.topics.map((topic, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-800">{topic}</span>
                      </div>
                    ))}
                  </div>
                )}
                {displaySettings.showUsage && summary.usage && (
                  <div className="text-xs text-gray-500 mt-2">
                    トークン: {summary.usage.totalTokens}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'action_items' && (
          <div className="space-y-4">
            {summaries.filter(s => s.type === 'action_items').map((summary) => (
              <div key={summary.id} className="p-4 bg-white rounded-lg border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded ${getSummaryTypeColor(summary.type)}`}>
                      {getSummaryTypeLabel(summary.type)}
                    </span>
                    {displaySettings.showConfidence && (
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {(summary.confidence! * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimestamp(summary.timestamp)} ({formatDuration(summary.duration)})
                  </div>
                </div>
                {summary.actionItems && (
                  <div className="space-y-2">
                    {summary.actionItems.map((item, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-gray-800">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
                {displaySettings.showUsage && summary.usage && (
                  <div className="text-xs text-gray-500 mt-2">
                    トークン: {summary.usage.totalTokens}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'clusters' && (
          <div className="space-y-4">
            {topicClusters.map((cluster) => (
              <div key={cluster.id} className="p-4 bg-white rounded-lg border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-800">
                      クラスター
                    </span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {(cluster.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimestamp(cluster.timestamp)}
                  </div>
                </div>
                <div className="mb-2">
                  <h4 className="font-medium text-gray-900">{cluster.name}</h4>
                </div>
                <div className="mb-2">
                  <div className="text-xs text-gray-600 mb-1">キーワード:</div>
                  <div className="flex flex-wrap gap-1">
                    {cluster.keywords.map((keyword, index) => (
                      <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">セグメント:</div>
                  <div className="space-y-1">
                    {cluster.segments.map((segment, index) => (
                      <div key={index} className="text-sm text-gray-700">• {segment}</div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {summaries.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <div className="text-lg mb-2">要約データがありません</div>
            <div className="text-sm">音声認識を開始すると、ここに要約が表示されます</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryDisplay; 

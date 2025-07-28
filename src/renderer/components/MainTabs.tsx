import React, { useState } from 'react';
import LiveTranscriptDisplay from './LiveTranscriptDisplay';
import SummaryDisplay from './SummaryDisplay';
import TopicsDisplay from './TopicsDisplay';
import HighlightsDisplay from './HighlightsDisplay';

interface Tab {
  id: string;
  label: string;
  icon: string;
  component: React.ReactNode;
}

const MainTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('transcript');

  const tabs: Tab[] = [
    {
      id: 'transcript',
      label: '文字起こし',
      icon: '📝',
      component: (
        <LiveTranscriptDisplay
          autoScroll={true}
          showTimestamps={true}
          showConfidence={true}
          maxHeight="calc(100vh - 200px)"
          refreshInterval={1000}
        />
      ),
    },
    {
      id: 'topics',
      label: 'トピック',
      icon: '🏷️',
      component: <TopicsDisplay />,
    },
    {
      id: 'highlights',
      label: 'ハイライト',
      icon: '⭐',
      component: <HighlightsDisplay />,
    },
    {
      id: 'summary',
      label: '要約',
      icon: '📊',
      component: (
        <SummaryDisplay
          autoRefresh={true}
          refreshInterval={5000}
          showConfidence={true}
          showUsage={true}
          maxHeight="calc(100vh - 200px)"
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* タブヘッダー */}
      <div className="flex border-b border-gray-200 bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-6 py-3 text-sm font-medium transition-colors duration-200 ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2 text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-hidden">
        {tabs.find((tab) => tab.id === activeTab)?.component}
      </div>
    </div>
  );
};

export default MainTabs; 

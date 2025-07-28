import React, { useState } from 'react';
import LiveTranscriptDisplay from './LiveTranscriptDisplay';
import SummaryPanelDisplay from './SummaryPanelDisplay';
import TopicsDisplay from './TopicsDisplay';

interface Tab {
  id: string;
  label: string;
  icon: string;
  component: React.ReactNode;
}

const MainTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('summary');

  const tabs: Tab[] = [
    {
      id: 'summary',
      label: '要約',
      icon: '📊',
      component: (
        <SummaryPanelDisplay
          maxHeight="calc(100vh - 200px)"
          refreshInterval={5000}
          enableAutoScroll={true}
          showConfidence={true}
          showUsage={true}
          showProgress={true}
        />
      ),
    },
    {
      id: 'topics',
      label: 'トピック',
      icon: '🏷️',
      component: <TopicsDisplay />,
    },
  ];

  return (
    <div className="flex h-full overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
      {/* 左側：文字起こし（固定幅50%） */}
      <div className="w-1/2 border-r border-gray-200 overflow-hidden">
        <LiveTranscriptDisplay
          autoScroll={true}
          showTimestamps={true}
          showConfidence={true}
          maxHeight="100%"
          refreshInterval={1000}
          showSpeakerInfo={true}
          enableHighlighting={true}
          wordHighlighting={false}
        />
      </div>

      {/* 右側：タブコンテンツ（固定幅50%） */}
      <div className="w-1/2 flex flex-col flex-shrink-0" style={{ height: 'calc(100vh - 64px)' }}>
        {/* タブヘッダー（固定高さ） */}
        <div className="flex border-b border-gray-200 bg-white flex-shrink-0 h-10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="mr-1 text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* タブコンテンツ（残りのスペース） */}
        <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 64px - 40px)' }}>
          {tabs.find((tab) => tab.id === activeTab)?.component}
        </div>
      </div>
    </div>
  );
};

export default MainTabs; 

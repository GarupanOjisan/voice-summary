import React, { useState } from 'react';
import { AudioCapture } from './AudioCapture';
import { AudioQualityMonitor } from './AudioQualityMonitor';
import VirtualAudioDeviceSetup from './VirtualAudioDeviceSetup';
import WhisperSetup from './WhisperSetup';
import STTProviderSetup from './STTProviderSetup';
import LLMSettingsUI from './LLMSettingsUI';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const [activeSection, setActiveSection] = useState('audio');

  const sections = [
    { id: 'audio', label: '音声設定', icon: '🎤' },
    { id: 'stt', label: '音声認識', icon: '🎧' },
    { id: 'llm', label: 'LLM設定', icon: '🤖' },
  ];

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'audio':
        return (
          <div className="space-y-4">
            <AudioCapture />
            <AudioQualityMonitor />
            <VirtualAudioDeviceSetup />
          </div>
        );
      case 'stt':
        return (
          <div className="space-y-4">
            <WhisperSetup />
            <STTProviderSetup />
          </div>
        );
      case 'llm':
        return <LLMSettingsUI />;
      default:
        return null;
    }
  };

  return (
    <div className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${
      isCollapsed ? 'w-16' : 'w-80'
    }`} style={{ height: 'calc(100vh - 64px)' }}>
      {/* ヘッダー（固定高さ） */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
        {!isCollapsed && <h2 className="text-lg font-semibold text-gray-900">設定</h2>}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      {/* セクションタブ（固定高さ） */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex-1 flex items-center justify-center py-3 text-sm font-medium transition-colors ${
              activeSection === section.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">{section.icon}</span>
            {!isCollapsed && section.label}
          </button>
        ))}
      </div>

      {/* コンテンツ（残りのスペース） */}
      <div className="p-4 overflow-y-auto flex-1 min-h-0">
        {!isCollapsed && renderSectionContent()}
      </div>
    </div>
  );
};

export default Sidebar; 

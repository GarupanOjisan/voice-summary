import React, { useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MainTabs from './components/MainTabs';

const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleToggleRecording = () => {
    setIsRecording(!isRecording);
  };

  const handleExport = () => {
    // TODO: エクスポート機能を実装
    console.log('Export clicked');
  };

  const handleSettings = () => {
    // TODO: 設定画面を開く
    console.log('Settings clicked');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <Header
        isRecording={isRecording}
        onToggleRecording={handleToggleRecording}
        onExport={handleExport}
        onSettings={handleSettings}
      />

      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden">
        {/* サイドバー */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* メインエリア */}
        <div className="flex-1 flex flex-col">
          <MainTabs />
        </div>
      </div>
    </div>
  );
};

export default App;

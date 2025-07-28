import React from 'react';
import { AudioCapture } from './components/AudioCapture';
import { AudioQualityMonitor } from './components/AudioQualityMonitor';
import VirtualAudioDeviceSetup from './components/VirtualAudioDeviceSetup';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Voice Summary</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AudioCapture />
          <AudioQualityMonitor />
        </div>

        <div className="mt-6">
          <VirtualAudioDeviceSetup />
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">文字起こし</h2>
          <p className="text-gray-600">
            音声キャプチャを開始すると、ここに文字起こしが表示されます...
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;

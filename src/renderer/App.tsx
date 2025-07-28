import React from 'react';
import { AudioCapture } from './components/AudioCapture';
import { AudioQualityMonitor } from './components/AudioQualityMonitor';
import VirtualAudioDeviceSetup from './components/VirtualAudioDeviceSetup';
import WhisperSetup from './components/WhisperSetup';
import STTProviderSetup from './components/STTProviderSetup';
import TranscriptAggregator from './components/TranscriptAggregator';
import LiveTranscriptDisplay from './components/LiveTranscriptDisplay';

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

        <div className="mt-6">
          <WhisperSetup />
        </div>

        <div className="mt-6">
          <STTProviderSetup />
        </div>

        <div className="mt-6">
          <TranscriptAggregator />
        </div>

        <div className="mt-6">
          <LiveTranscriptDisplay 
            autoScroll={true}
            showTimestamps={true}
            showConfidence={true}
            maxHeight="600px"
            refreshInterval={1000}
          />
        </div>
      </div>
    </div>
  );
};

export default App;

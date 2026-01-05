import { useState } from 'react';
import { SttSettings } from './SttSettings';
import { AIAgentSettings } from './AIAgentSettings';
import { AutomationSettings } from './AutomationSettings';
import './SettingsContainer.css';

type SettingsTab = 'stt' | 'ai' | 'automation';

export function SettingsContainer(): JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('stt');

  return (
    <div className="settings-container">
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'stt' ? 'active' : ''}`}
          onClick={() => setActiveTab('stt')}
        >
          Transcrição (STT)
        </button>
        <button
          className={`settings-tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          Agente de IA
        </button>
        <button
          className={`settings-tab ${activeTab === 'automation' ? 'active' : ''}`}
          onClick={() => setActiveTab('automation')}
        >
          Automação
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'stt' && <SttSettings />}
        {activeTab === 'ai' && <AIAgentSettings />}
        {activeTab === 'automation' && <AutomationSettings />}
      </div>
    </div>
  );
}


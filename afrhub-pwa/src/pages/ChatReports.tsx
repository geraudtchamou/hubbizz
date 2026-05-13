import React, { useState } from 'react';
import { Send } from 'lucide-react';

const ChatReports: React.FC = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', content: 'Hello! Ask me for reports like "Show today's profit" or "Yesterday's sales"' }
  ]);

  const handleSend = () => {
    if (!message.trim()) return;
    
    setMessages([...messages, { id: Date.now(), type: 'user', content: message }]);
    // Here you would integrate with ChatReportService
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        type: 'bot', 
        content: `Processing: "${message}". This would connect to the backend chat reporting service.` 
      }]);
    }, 500);
    setMessage('');
  };

  return (
    <div className="space-y-4 h-[calc(100vh-12rem)] flex flex-col">
      <h1 className="text-2xl font-bold text-gray-900">Chat Reports</h1>
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-lg ${
                msg.type === 'user' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-gray-100 text-gray-900'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder='Try: "Show today's profit" or "Top 5 products"'
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
            <button type="submit" className="px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatReports;

/**
 * Voice-First Commerce Hook
 * Supports: Pidgin, Swahili, Hausa, Yoruba, Wolof, English, French
 * Usage: const { startListening, stopListening, isListening, transcript } = useVoiceCommand();
 */

import { useState, useEffect, useCallback } from 'react';

type SupportedLanguage = 'en-US' | 'fr-FR' | 'sw-KE' | 'ha-NG' | 'yo-NG' | 'wo-SN' | 'pcm-NG';

interface VoiceCommandResult {
  command: string;
  action: 'SELL' | 'ADD_CLIENT' | 'CHECK_STOCK' | 'REPORT' | 'CREDIT';
  entities: {
    product?: string;
    quantity?: number;
    client?: string;
    amount?: number;
    paymentMethod?: 'cash' | 'momo' | 'credit';
  };
}

export const useVoiceCommand = (language: SupportedLanguage = 'en-US') => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parsedCommand, setParsedCommand] = useState<VoiceCommandResult | null>(null);

  // Check for browser support
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;

  useEffect(() => {
    if (!recognition) {
      setError('Speech recognition not supported in this browser. Use Chrome or Edge.');
      return;
    }

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const result = event.results[current][0].transcript;
      setTranscript(result);
      
      if (event.results[current].isFinal) {
        parseVoiceCommand(result);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setError(event.error === 'no-speech' ? 'No speech detected. Please try again.' : 'Microphone access denied.');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return () => {
      if (recognition) recognition.abort();
    };
  }, [language]);

  const parseVoiceCommand = (text: string) => {
    const lowerText = text.toLowerCase();
    let command: VoiceCommandResult = {
      command: text,
      action: 'REPORT',
      entities: {}
    };

    // Sell commands: "Sell 2 bags of rice to Mama Ngozi on credit"
    if (lowerText.includes('sell') || lowerText.includes('buy')) {
      command.action = 'SELL';
      
      // Extract quantity (number before product)
      const quantityMatch = lowerText.match(/(\d+)\s*(bag|pack|bottle|piece|kg|liter)s?\s+of\s+(\w+)/i);
      if (quantityMatch) {
        command.entities.quantity = parseInt(quantityMatch[1]);
        command.entities.product = quantityMatch[3];
      }

      // Extract client name
      const clientMatch = lowerText.match(/to\s+([a-z\s]+)/i);
      if (clientMatch) {
        command.entities.client = clientMatch[1].trim();
      }

      // Extract payment method
      if (lowerText.includes('credit')) command.entities.paymentMethod = 'credit';
      else if (lowerText.includes('momo') || lowerText.includes('mobile money')) command.entities.paymentMethod = 'momo';
      else command.entities.paymentMethod = 'cash';
    }

    // Add client: "Add client John Doe phone 08012345678"
    else if (lowerText.includes('add client') || lowerText.includes('new customer')) {
      command.action = 'ADD_CLIENT';
      const phoneMatch = lowerText.match(/phone\s*(\+?\d{10,15})/i);
      if (phoneMatch) {
        command.entities.amount = parseInt(phoneMatch[1]); // Store as temp
      }
    }

    // Check stock: "How much sugar left?" or "Stock of rice"
    else if (lowerText.includes('stock') || lowerText.includes('how much') || lowerText.includes('left')) {
      command.action = 'CHECK_STOCK';
      const productMatch = lowerText.match(/of\s+(\w+)|(\w+)\s+left/i);
      if (productMatch) {
        command.entities.product = productMatch[1] || productMatch[2];
      }
    }

    // Report: "Show today sales" or "Profit for yesterday"
    else if (lowerText.includes('show') || lowerText.includes('report') || lowerText.includes('sales') || lowerText.includes('profit')) {
      command.action = 'REPORT';
    }

    setParsedCommand(command);
    
    // Dispatch custom event for components to listen
    window.dispatchEvent(new CustomEvent('voice-command', { detail: command }));
  };

  const startListening = useCallback(() => {
    if (!recognition) {
      setError('Speech recognition not available');
      return;
    }
    
    setError(null);
    setTranscript('');
    setParsedCommand(null);
    
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setError('Could not start microphone. Check permissions.');
    }
  }, [recognition]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  }, [recognition]);

  return {
    isListening,
    transcript,
    error,
    parsedCommand,
    startListening,
    stopListening,
    isSupported: !!recognition
  };
};

// Example usage in a component:
/*
function VoicePOSButton() {
  const { isListening, transcript, parsedCommand, startListening, stopListening, isSupported } = useVoiceCommand('pcm-NG'); // Pidgin
  
  useEffect(() => {
    if (parsedCommand?.action === 'SELL') {
      // Auto-fill POS form
      console.log('Auto-filling sale:', parsedCommand.entities);
    }
  }, [parsedCommand]);

  if (!isSupported) return null;

  return (
    <button 
      onClick={isListening ? stopListening : startListening}
      className={`p-4 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-600'}`}
    >
      🎤 {isListening ? 'Listening...' : 'Speak'}
      {transcript && <div className="text-sm mt-2">{transcript}</div>}
    </button>
  );
}
*/

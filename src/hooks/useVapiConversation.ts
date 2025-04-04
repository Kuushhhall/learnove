
import { useState, useEffect, useRef, useCallback } from 'react';
import Vapi from '@vapi-ai/web';
import type { VapiClientToServerMessage } from '@vapi-ai/web';

type VapiMessage = {
  text: string;
  isUser: boolean;
};

interface UseVapiConversationProps {
  onMessage?: (message: VapiMessage) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export const useVapiConversation = ({
  onMessage,
  onError,
  onConnect,
  onDisconnect
}: UseVapiConversationProps = {}) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(1);
  const clientRef = useRef<Vapi | null>(null);

  const startSession = useCallback(async ({ 
    apiKey, 
    assistantId, 
    initialMessage 
  }: { 
    apiKey: string; 
    assistantId: string;
    initialMessage?: string;
  }) => {
    try {
      setStatus('connecting');

      const config = {
        apiKey,
        assistantId,
        logger: { logLevel: 'debug' },
        audio: {
          autoPlay: true,
          volume: volume,
        },
        onAgentStart: () => {
          setIsSpeaking(true);
        },
        onAgentStop: () => {
          setIsSpeaking(false);
        },
        onError: (error: Error) => {
          console.error('Vapi error:', error);
          if (onError) onError(error);
        },
        onConnect: () => {
          setStatus('connected');
          if (onConnect) onConnect();
        },
        onDisconnect: () => {
          setStatus('disconnected');
          if (onDisconnect) onDisconnect();
        },
        onTranscription: (transcript: { text: string }) => {
          if (onMessage) {
            onMessage({
              text: transcript.text,
              isUser: true
            });
          }
        },
        onMessage: (message: { text: string }) => {
          if (onMessage) {
            onMessage({
              text: message.text,
              isUser: false
            });
          }
        }
      };

      // Initialize the Vapi client
      const client = new Vapi(config);
      clientRef.current = client;

      // Start the call
      await client.start();

      // Send initial message if provided
      if (initialMessage && client) {
        client.send({ text: initialMessage });
      }

      return client;
    } catch (error) {
      setStatus('disconnected');
      console.error('Failed to start Vapi session:', error);
      if (onError && error instanceof Error) onError(error);
      throw error;
    }
  }, [onConnect, onDisconnect, onError, onMessage, volume]);

  const endSession = useCallback(async () => {
    try {
      if (clientRef.current) {
        await clientRef.current.stop();
        clientRef.current = null;
      }
      setStatus('disconnected');
    } catch (error) {
      console.error('Failed to end Vapi session:', error);
      if (onError && error instanceof Error) onError(error);
    }
  }, [onError]);

  const adjustVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (clientRef.current) {
      // Update volume through the audio configuration
      if (clientRef.current.audio) {
        clientRef.current.audio.volume = newVolume;
      }
    }
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (clientRef.current && status === 'connected') {
      clientRef.current.send({ text: message });
      return true;
    }
    return false;
  }, [status]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.stop();
      }
    };
  }, []);

  return {
    status,
    isSpeaking,
    startSession,
    endSession,
    adjustVolume,
    sendMessage
  };
};

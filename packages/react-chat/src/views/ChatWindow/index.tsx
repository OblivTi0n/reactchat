import '../../styles.css';

import React, {useCallback, useContext, useEffect, useState} from 'react';
import * as R from 'remeda';
import { match } from 'ts-pattern';
import { serializeToText } from '@voiceflow/slate-serializer/text';

import { SessionStatus } from '@/common';
import { Chat, SystemResponse, UserResponse } from '@/components';
import { RuntimeStateAPIContext, RuntimeStateContext } from '@/contexts/RuntimeContext';
import type { FeedbackName } from '@/contexts/RuntimeContext/useRuntimeAPI';
import { TurnType, UserTurnProps } from '@/types';

import { ChatWindowContainer } from './styled';
import {LiveAgentStatus} from "@/components/LiveAgentStatus.component";
import {supabase} from "@/supabase.client";
import cuid from "cuid";

const fetchOpenAIResponse = async (message) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-proj-Si1YWb264i47aTynoJ9oT3BlbkFJuBDWsShkr1eYUgdrAihD',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: message }],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    return content;
  } catch (error) {
    console.error('Error fetching OpenAI response:', error);
    return 'Sorry, I am unable to process your request at the moment.';
  }
};


export interface ChatWindowProps {
  className?: string;
}
export const sharedState = {
  isPublicBoolean: false,
};




const ChatWindow: React.FC<ChatWindowProps> = ({ className }) => {
  const runtime = useContext(RuntimeStateAPIContext);
  const state = useContext(RuntimeStateContext);
  const { assistant, config } = runtime;
  const [shouldLogHistory, setShouldLogHistory] = useState(false);
  const [insertedRowId, setInsertedRowId] = useState<string | null>(null);

  const updateChatHistoryWithNewMessage = async (userId: string, newMessage: string) => {
    // Fetch the current chat history for the user
    const { data, error: fetchError } = await supabase
      .from('liveagent')
      .select('id, chat_history')
      .eq('senderid', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching chat history:', fetchError);
      return;
    }

    // Append the new message to the chat history
    const updatedChatHistory = [
      ...(data.chat_history || []), // Ensure there's a fallback in case chat_history is null
      {
        from: 'customer',
        message: newMessage,
        timestamp: new Date().toISOString(),
      },
    ];

    // Update the chat history in the database
    const { error: updateError } = await supabase
      .from('liveagent')
      .update({ chat_history: updatedChatHistory })
      .eq('id', data.id); // Assuming `id` is the primary key for the liveagent table

    if (updateError) {
      console.error('Error updating chat history:', updateError);
    } else {
      console.log('Chat history updated successfully');
    }
  };

  const handleSend = async (message: string) => {
    if (shouldLogHistory) {
      // Add turn to runtime session
      runtime.addTurn({
        type: TurnType.USER,
        id: cuid(),
        timestamp: Date.now(),
        message,
      });
      await updateChatHistoryWithNewMessage(state.session.userID, message);

    } else {
      runtime.reply(message);
    }
  };

  const extractHistory = () => {
    return state.session.turns
      .map((turn) => {
        if (turn.type === TurnType.USER) {
          return {
            from: 'customer',
            message: turn.message,
            timestamp: new Date(turn.timestamp).toISOString(), // Convert timestamp to ISO 8601 format
          };
        }
        if (turn.type === TurnType.SYSTEM) {
          return turn.messages.map((message) => ({
            from: 'agent',
            message: typeof message.text === 'string' ? message.text : serializeToText(message.text),
            timestamp: new Date(turn.timestamp).toISOString(), // Convert timestamp to ISO 8601 format
          }));
        }
        return [];
      })
      .flat();
  };
  useEffect(() => {
    const sendHandoffRequest = async () => {
      if (sharedState.isPublicBoolean) {
        try {
          const chatHistoryJson = extractHistory(); // Extract and format the chat history
          console.log('Initial send');
          const userName = await fetchOpenAIResponse(JSON.stringify(chatHistoryJson) + " INSTRUCTION: FROM THE CHAT HISTORY RETRIEVE THE NAME OF THE USER ONLY REPLY BACK WITH THE NAME OF THE USER");
          const userEmail = await fetchOpenAIResponse(JSON.stringify(chatHistoryJson) + " INSTRUCTION: FROM THE CHAT HISTORY RETRIEVE THE email OF THE USER ONLY REPLY BACK WITH THE email OF THE USER");

          const { data, error } = await supabase.from('liveagent').insert([
            {
              created_at: new Date().toISOString(),
              senderid: state.session.userID,
              name: userName,
              email: userEmail,
              read: false,
              chat_history: chatHistoryJson,
              business_id: 'd7399cae-be6f-48d7-a41f-5b50265d9f6f'
            },
          ]).select('id');

          if (error) throw error;
          console.log('Handoff request sent:', data);
          setInsertedRowId(data[0].id); // Store the ID of the inserted row
          sharedState.isPublicBoolean = false;
          setShouldLogHistory(true);
        } catch (error) {
          console.error('Error sending handoff request to Supabase:', error);
        }
      }
    };
    sendHandoffRequest();
  }, [sharedState.isPublicBoolean]); // Add runtime.session.turns as a dependency if turns influence history

  useEffect(() => {
    let channel;

    const fetchAndSubscribeMessages = async () => {
      if (shouldLogHistory) {
        // Setup real-time subscription
        channel = supabase
          .channel('public:liveagent')
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'liveagent', filter: `senderid=eq.${state.session.userID}` },
            (payload) => {
              console.log('New update:', payload.new);
              // Check if the last message in chat_history is from the agent
              const { chat_history } = payload.new;
              if (chat_history && chat_history.length > 0) {
                console.log('Chat History:', chat_history);
                const lastMessage = chat_history[chat_history.length - 1];
                if (lastMessage.from === 'agent') {
                  console.log(`Message from agent: ${lastMessage.message}`);
                  runtime.addTurn({
                    type: TurnType.SYSTEM,
                    id: cuid(),
                    timestamp: Date.now(),
                    messages: [{ type: 'text', text: lastMessage.message }],
                  });

                }
              }
            }
          )
          .subscribe();
      }
    };

    fetchAndSubscribeMessages();

    // Cleanup function
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [insertedRowId, shouldLogHistory]);

  const talkToRobot = () => {
    setShouldLogHistory(false);
    runtime.interact({ type: 'continue', payload: null });
  };
  // emitters
  const closeAndEnd = useCallback((): void => {
    runtime.setStatus(SessionStatus.ENDED);
    runtime.close();
  }, []);

  const getPreviousUserTurn = useCallback(
    (turnIndex: number): UserTurnProps | null => {
      const turn = state.session.turns[turnIndex - 1];
      return turn?.type === TurnType.USER ? turn : null;
    },
    [state.session.turns]
  );






  return (
    <ChatWindowContainer className={className}>
      <Chat
        title={assistant.title}
        description={assistant.description}
        image={assistant.image}
        avatar={assistant.avatar}
        withWatermark={assistant.watermark}
        startTime={state.session.startTime}
        hasEnded={runtime.isStatus(SessionStatus.ENDED)}
        isLoading={runtime.isStatus(SessionStatus.IDLE) && state.session.turns.length === 0 && config.autostart}
        onStart={runtime.launch}
        onEnd={closeAndEnd}
        onSend={handleSend}
        onMinimize={runtime.close}
      >
        {shouldLogHistory && <LiveAgentStatus talkToRobot={talkToRobot} />}
        {state.session.turns.map((turn, turnIndex) =>
          match(turn)
            .with({ type: TurnType.USER }, ({ id, ...props }) => <UserResponse {...R.omit(props, ['type'])} key={id} />)
            .with({ type: TurnType.SYSTEM }, ({ id, ...props }) => (
              <SystemResponse
                key={id}
                {...R.omit(props, ['type'])}
                feedback={
                  assistant.feedback
                    ? {
                        onClick: (feedback: FeedbackName) => {
                          runtime.feedback(feedback, props.messages, getPreviousUserTurn(turnIndex));
                        },
                      }
                    : undefined
                }
                avatar={assistant.avatar}
                isLast={turnIndex === state.session.turns.length - 1}
              />
            ))
            .exhaustive()
        )}
        {state.indicator && <SystemResponse.Indicator avatar={assistant.avatar} />}
      </Chat>
    </ChatWindowContainer>
  );
};

export default Object.assign(ChatWindow, { Container: ChatWindowContainer });

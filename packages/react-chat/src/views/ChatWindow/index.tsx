import  '../../styles.css';

import React, { useCallback, useContext, useEffect, useState } from 'react';
import * as R from 'remeda';
import { match } from 'ts-pattern';
import { serializeToText } from '@voiceflow/slate-serializer/text';

import { SessionStatus } from '@/common';
import { Chat, SystemResponse, UserResponse } from '@/components';
import { RuntimeStateAPIContext, RuntimeStateContext } from '@/contexts/RuntimeContext';
import type { FeedbackName } from '@/contexts/RuntimeContext/useRuntimeAPI';
import { TurnType, UserTurnProps } from '@/types';

import { ChatWindowContainer } from './styled';
import { LiveAgentStatus } from "@/components/LiveAgentStatus.component";
import { supabase } from "@/supabase.client";
import cuid from "cuid";

import { TraceDeclaration } from "@voiceflow/sdk-runtime";
import { RuntimeMessage } from "@/contexts/RuntimeContext/messages";

let Name = '';
let Email = '';
let loghistory = false;

export const LiveAgent = (): TraceDeclaration<RuntimeMessage, any> => ({
  canHandle: ({ type }) => (type as string) === 'talk_to_agent',
  handle: ({ context }, trace) => {
    const { name, email } = trace.payload;
    Name = name;
    Email = email;
    console.log("Trace payload:", trace.payload);
    context.messages.push({ type: 'text', text: `please wait in the queue until one of our agents are available` });
    console.log("changing public boolean to true");
    sharedState.isPublicBoolean = true;

    return context;
  },
});
export const GetHistory = (): TraceDeclaration<RuntimeMessage, any> => ({
  canHandle: ({ type }) => (type as string) === 'get_history',
  handle: ({ context }, trace) => {

    sharedState.gethistoryboolean = true;
    return context;
  },
});

export interface ChatWindowProps {
  className?: string;
}
export const sharedState = {
  isPublicBoolean: false,
  gethistoryboolean: false,
};

const ChatWindow: React.FC<ChatWindowProps> = ({ className }) => {
  const runtime = useContext(RuntimeStateAPIContext);
  const state = useContext(RuntimeStateContext);
  const { assistant, config } = runtime;
  const [lastChatHistoryLength, setLastChatHistoryLength] = useState<number | null>(null); // State to track the length of chat history
  const [shouldLogHistory, setShouldLogHistory] = useState(false);
  const [insertedRowId, setInsertedRowId] = useState<string | null>(null);
  const [isPublicBoolean, setIsPublicBoolean] = useState(sharedState.isPublicBoolean);
  const [isgethistoryboolean, setIsgethistoryboolean] = useState(sharedState.gethistoryboolean);

  const [queue, setQueue] = useState<number | null>(null);
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [liveagent, setLiveagent] = useState<boolean>(false);

  useEffect(() => {
    if (sharedState.isPublicBoolean !== isPublicBoolean) {
      setIsPublicBoolean(sharedState.isPublicBoolean);
    }
    if (sharedState.gethistoryboolean !== isgethistoryboolean) {
      setIsgethistoryboolean(sharedState.gethistoryboolean);
    }

  }, [sharedState.isPublicBoolean, isPublicBoolean,sharedState.gethistoryboolean,isgethistoryboolean]);





  const updateChatHistoryWithNewMessage = async (userId: string, newMessage: string) => {
    if (!insertedRowId) {
      console.error("insertedRowId is not set. Cannot update chat history.");
      return;
    }
    console.log("Updating chat history for user:", userId, "with message:", newMessage);
    const { data, error: fetchError } = await supabase
      .from('liveagent')
      .select('id, chat_history')
      .eq('id', insertedRowId) // Use insertedRowId instead of userId
      .single();

    if (fetchError) {
      console.error('Error fetching chat history:', fetchError);
      return;
    }

    const updatedChatHistory = [
      ...(data.chat_history || []),
      {
        from: 'customer',
        message: newMessage,
        timestamp: new Date().toISOString(),
      },
    ];

    const { error: updateError } = await supabase
      .from('liveagent')
      .update({ chat_history: updatedChatHistory })
      .eq('id', data.id);

    if (updateError) {
      console.error('Error updating chat history:', updateError);
    } else {
      console.log('Chat history updated successfully');
    }
  };

  const handleSend = async (message: string) => {
    console.log("Handle send message:", message);
    if (shouldLogHistory) {
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
            timestamp: new Date(turn.timestamp).toISOString(),
          };
        }
        if (turn.type === TurnType.SYSTEM) {
          return turn.messages.map((message) => ({
            from: 'agent',
            message: typeof message.text === 'string' ? message.text : serializeToText(message.text),
            timestamp: new Date(turn.timestamp).toISOString(),
          }));
        }
        return [];
      })
      .flat();
  };

  const updateQueuePosition = async () => {
    try {
      const { data: liveagentData, error: fetchError } = await supabase
        .from('liveagent')
        .select('*')
        .eq('business_id', 'd7399cae-be6f-48d7-a41f-5b50265d9f6f')
        .eq('read', false)
        .order('queueDate', { ascending: true });

      if (fetchError) throw fetchError;
      const position = liveagentData.findIndex((entry) => entry.id === insertedRowId);
      if (position === -1) {
        setTimeout(() => {
          updateQueuePosition();
        }, 2000);
        // if (!liveagent) {
        //   setQueue(position);
        //   runtime.addTurn({
        //     type: TurnType.SYSTEM,
        //     id: cuid(),
        //     timestamp: Date.now(),
        //     messages: [{type: 'text', text: `Your current queue position is: ${position + 1}`}],
        //   });
        //   console.log("Queue position updatedddd:", position + 1)
        // }
        // setSubscribed(false);
        // runtime.interact({ type: 'continue', payload: null });
        console.log("")
      } else if (position !== queue) {
        if (!liveagent) {
          setQueue(position);
          runtime.addTurn({
            type: TurnType.SYSTEM,
            id: cuid(),
            timestamp: Date.now(),
            messages: [{type: 'text', text: `Your current queue position is: ${position + 1}`}],
          });
          console.log("Queue position updatedddd:", position + 1)
        }
      }
    } catch (error) {
      console.error('Error fetching queue position:', error);
    }
  };


  useEffect(() => {
    console.log("useEffect for handoff request triggered");
    const sendHandoffRequest = async () => {
      console.log("sendHandoffRequest called with isPublicBoolean:", isPublicBoolean);
      if (isgethistoryboolean) {
        console.log("chat history:" + JSON.stringify(extractHistory()));
        runtime.interact({ type: 'continue', payload: { history: JSON.stringify(extractHistory()) } });
        sharedState.gethistoryboolean = false;
      }
      if (isPublicBoolean) {
        console.log('Sending handoff request');
        setShouldLogHistory(true);

        try {
          const chatHistoryJson = extractHistory();
          console.log('Extracted chat history:', chatHistoryJson);

          // Check if a row with the same email and business_id exists
          const { data: existingData, error: existingError } = await supabase
            .from('liveagent')
            .select('id, chat_history')
            .eq('email', Email)
            .eq('business_id', 'd7399cae-be6f-48d7-a41f-5b50265d9f6f')
            .single();

          if (existingError && existingError.code !== 'PGRST116') {
            // PGRST116 is the code for no single row found
            throw existingError;
          }

          let data, error;

          if (existingData) {
            // If row exists, update it
            const updatedChatHistory = [
              ...(existingData.chat_history || []),
              ...chatHistoryJson,
            ];

            ({ data, error } = await supabase
              .from('liveagent')
              .update({
                chat_history: updatedChatHistory,
                name: Name,
                read: false,
                queueDate: new Date().toISOString(),
              })
              .eq('id', existingData.id)
              .select('id'));
          } else {
            // If row does not exist, insert a new row
            ({ data, error } = await supabase.from('liveagent').insert([
              {
                created_at: new Date().toISOString(),
                senderid: null,
                name: Name,
                email: Email,
                read: false,
                chat_history: chatHistoryJson,
                business_id: 'd7399cae-be6f-48d7-a41f-5b50265d9f6f',
                queueDate: new Date().toISOString(),
              },
            ]).select('id'));
          }
          if (error) throw error;
          console.log('Handoff request sent:', data[0].id);
          setInsertedRowId(data[0].id); // Store the ID of the inserted row
          sharedState.isPublicBoolean = false;
          setSubscribed(true);
          updateQueuePosition(); // Fetch and update queue position
        } catch (error) {
          console.error('Error sending handoff request to Supabase:', error);
        }
        setIsPublicBoolean(false);
      }
    };
    sendHandoffRequest();
  }, [isPublicBoolean, isgethistoryboolean]);

  useEffect(() => {
    if (subscribed == false) {
      if (liveagent ==false) {
        return;
      }
    }



    const subscription = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'liveagent' },
        (payload) => {
          console.log('New liveagent inserted:', payload.new);
          handleQueueAndUpdate(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'liveagent' },
        (payload) => {
          console.log('Liveagent updated:', payload.new);
          handleQueueAndUpdate(payload.new);
        }
      )
      .subscribe();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [queue, state.session.userID, runtime, subscribed, liveagent]);
  const handleQueueAndUpdate = async (updatedRow) => {
    if (updatedRow.id === insertedRowId) {
      if (updatedRow.read === true) {
        console.log("Read is true for insertedRowId, taking appropriate action");
        runtime.interact({ type: 'continue', payload: null });

      }
      if (updatedRow.queueNumber !== queue) {
        setQueue(updatedRow.queueNumber);
        runtime.addTurn({
          type: TurnType.SYSTEM,
          id: cuid(),
          timestamp: Date.now(),
          messages: [{ type: 'text', text: `Your current queue position is: ${updatedRow.queueNumber + 1}` }],
        });
        console.log("Queue position updated:", updatedRow.queueNumber + 1);
      }
    }

    // try {
    //   const { data: liveagentData, error: fetchError } = await supabase
    //     .from('liveagent')
    //     .select('*')
    //     .eq('business_id', 'd7399cae-be6f-48d7-a41f-5b50265d9f6f')
    //     .eq('read', false);
    //
    //   if (fetchError) throw fetchError;
    //
    //   const position = liveagentData.findIndex((entry) => entry.id === insertedRowId);
    //   if (position !== -1 && position !== queue && !liveagent) {
    //     setQueue(position);
    //     runtime.addTurn({
    //       type: TurnType.SYSTEM,
    //       id: cuid(),
    //       timestamp: Date.now(),
    //       messages: [{ type: 'text', text: `Your current queue position is: ${position + 1}` }],
    //     });
    //     console.log("Queue position updated:", position + 1);
    //   }
    // } catch (error) {
    //   console.error('Error fetching queue position:', error);
    // }
  };

  useEffect(() => {
    console.log("useEffect for real-time subscription triggered with shouldLogHistory:", shouldLogHistory);
    let channel;

    const fetchAndSubscribeMessages = async () => {
      if (shouldLogHistory) {
        console.log("Setting up real-time subscription");
        channel = supabase
          .channel('public:liveagent')
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'liveagent', filter: `id=eq.${insertedRowId}` },
            (payload) => {
              console.log('New update:', payload.new);
              const { chat_history } = payload.new;
              if (chat_history && chat_history.length > 0) {
                console.log('Chat History:', chat_history);
                const currentHistoryLength = chat_history.length;

                // Check if the chat history length has increased
                if (currentHistoryLength > (lastChatHistoryLength || 0)) {
                  const lastMessage = chat_history[chat_history.length - 1];

                  if (lastMessage.from === 'agent') {
                    if (lastMessage.message === 'please wait in the queue until one of our agents are available') {
                      return;
                    } else {
                      setSubscribed(false);
                      setLiveagent(true);
                    }
                    console.log(`Message from agent: ${lastMessage.message}`);
                    runtime.addTurn({
                      type: TurnType.SYSTEM,
                      id: cuid(),
                      timestamp: Date.now(),
                      messages: [{ type: 'text', text: lastMessage.message }],
                    });

                    // Update the chat history length
                    setLastChatHistoryLength(currentHistoryLength);
                  }
                }
              }
            }
          )
          .subscribe();
      }
    };

    fetchAndSubscribeMessages();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [shouldLogHistory, liveagent, state.session.userID, runtime, insertedRowId]);

  const talkToRobot = () => {
    console.log("Switching to robot interaction");
    setShouldLogHistory(false);
    setSubscribed(false);
    runtime.interact({ type: 'continue', payload: null });
  };

  const closeAndEnd = useCallback((): void => {
    console.log("Session ended");

    // Clear local state
    setSubscribed(false);
    setLiveagent(false);
    setShouldLogHistory(false);
    setIsPublicBoolean(false);
    setIsgethistoryboolean(false);
    setQueue(null);
    setInsertedRowId(null);

    // End the runtime session
    runtime.setStatus(SessionStatus.ENDED);
    runtime.close();

    // Reload the page to reset the entire state
    window.location.reload();
  }, [runtime]);

  const getPreviousUserTurn = useCallback(
    (turnIndex: number): UserTurnProps | null => {
      const turn = state.session.turns[turnIndex - 1];
      return turn?.type === TurnType.USER ? turn : null;
    },
    [state.session.turns]
  );
  const handleEnd = async () => {

  };
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
        {subscribed && <LiveAgentStatus talkToRobot={talkToRobot} />}
      </Chat>
    </ChatWindowContainer>
  );
};

export default Object.assign(ChatWindow, { Container: ChatWindowContainer });

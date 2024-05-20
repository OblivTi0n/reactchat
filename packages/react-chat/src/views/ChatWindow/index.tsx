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


  const handleSend = (message: string) => {
    console.log(message);
    runtime.reply(message);
    console.log(JSON.stringify(extractHistory()))

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


  const talkToRobot = () => {
    sharedState.isPublicBoolean = false;
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



  // useEffect(() => {
  //       runtime.register({
  //           canHandle: ({ type }) => (type as string) === 'talk_to_agent',
  //           handle: ({ context }, trace) => {
  //           context.messages.push({ type: 'text', text: 'hello text liveagent' });
  //           alert('hello text liveagent')
  //           return context;
  //         },
  //       });
  //   }, []);



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
        {sharedState.isPublicBoolean && <LiveAgentStatus talkToRobot={talkToRobot} />}
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

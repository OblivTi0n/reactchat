
import {TraceDeclaration} from "@voiceflow/sdk-runtime";
import {RuntimeMessage} from "@/contexts/RuntimeContext/messages";
import { sharedState } from "@/views/ChatWindow/";

export const LiveAgent = ():  TraceDeclaration<RuntimeMessage, any> => ({
    canHandle: ({ type }) => (type as string) === 'talk_to_agent',
    handle: ({ context }, trace) => {
        context.messages.push({ type: 'text', text: 'hello text custom' });
        sharedState.isPublicBoolean = true;

      return context;
    },
});

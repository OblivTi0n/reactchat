import React from 'react';

export const LiveAgentStatus: React.FC<{ talkToRobot: () => void }> = ({ talkToRobot }) => (
  <div
    style={{
      position: 'absolute',
      width: '100%',
      height: 40,
      bottom: '2%',
      left: 0,
      padding: '6px 15px',
      color: 'black',
      background: 'white',
      zIndex: 1,
      display: 'flex',
      justifyContent: 'flex-start', // Align items to the start
      alignItems: 'center',
      borderTop: '1px solid #ccc',
      fontFamily: 'sans-serif',
      fontSize: '14px',
    }}
  >
    <span style={{ marginRight: '8px' }}>You are currently queuing for a live agent</span> {/* Add margin to the span */}
    <button
      onClick={talkToRobot}
      style={{
        cursor: 'pointer',
        padding: '8px 10px',
        backgroundColor: 'blue',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontFamily: 'sans-serif',
        fontSize: '14px',
      }}
    >
      Exit Queue
    </button>
  </div>
);

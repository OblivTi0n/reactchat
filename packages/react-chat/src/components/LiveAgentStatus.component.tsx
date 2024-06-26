
export const LiveAgentStatus: React.FC<{ talkToRobot: () => void }> = ({ talkToRobot }) => (
  <div
    style={{
      position: 'absolute',
      width: '100%',
      top: 56,
      left: 0,
      padding: 8,
      color: 'white',
      background: 'orangered',
      zIndex: 1,
    }}
  >
    You are talking to a live agent. Click{' '}
    <a onClick={talkToRobot} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
      here
    </a>{' '}
    to talk to a robot.
  </div>
);

import { useEffect, useState, useRef } from 'react';

const ChatRoom = () => {
  const [messages, setMessages] = useState<{ msg: string; timestamp: number }[]>([]);
  const [input, setInput] = useState('');
  const [connecting, setConnecting] = useState(true);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket('wss://phi-chat-server.onrender.com');
    wsRef.current = ws;

    const timeout = setTimeout(() => {
      if (connecting) {
        setConnectionFailed(true);
        ws.close();
      }
    }, 10000); // 10s timeout

    ws.onopen = () => {
      clearTimeout(timeout);
      setConnecting(false);
    };

    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === 'history') {
        setMessages(parsed.data);
      } else if (parsed.type === 'message') {
        setMessages((prev) => [...prev, parsed.data]);
      } else {
        setMessages((prev) => [...prev, { msg: event.data, timestamp: Date.now() }]);
      }
    };

    ws.onerror = () => {
      setConnectionFailed(true);
      setConnecting(false);
    };

    ws.onclose = () => {
      setConnecting(false);
    };

    return () => ws.close();
  }, []);

  const sendMessage = () => {
    if (wsRef.current && input.trim()) {
      wsRef.current.send(input);
      setInput('');
    }
  };

  if (connectionFailed) {
    return (
      <main id="main-site" className="page">
        <h1 className="CenterTitle">Chatroom</h1>
        <p className="BodyTextLeft">⚠️ Failed to connect to the chat server.</p>
        <p className="BodyTextLeft">Try again in a moment — it might just be waking up.</p>
      </main>
    );
  }

  if (connecting) {
    return (
      <main id="main-site" className="page">
        <h1 className="CenterTitle">Connecting to Chatroom...</h1>
        <p className="BodyTextLeft">Please wait — the server may be waking up from nap.</p>
      </main>
    );
  }

  return (
    <main id="main-site" className="page">
      <h1 className="CenterTitle">phi Chatroom</h1>

      <div style={{
        maxHeight: '60vh',
        overflowY: 'auto',
        border: '1px solid gold',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
        fontFamily: 'monospace',
        fontSize: '0.95rem'
      }}>
        {messages.map((m, i) => (
          <p key={i}>
            <code>{new Date(m.timestamp).toLocaleTimeString()}</code>: {m.msg}
          </p>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message"
          style={{
            flex: '1',
            padding: '0.5rem',
            fontFamily: 'inherit',
            borderRadius: '8px',
            border: '1px solid #333',
            backgroundColor: '#1a1a1a',
            color: 'white'
          }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </main>
  );
};

export default ChatRoom;

import { useEffect, useState, useRef } from 'react';

const ChatRoom = () => {
  const [messages, setMessages] = useState<{ msg: string; timestamp: number }[]>([]);
  const [input, setInput] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket('wss://phi-chat-server.onrender.com');
    wsRef.current = ws;

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

    return () => ws.close();
  }, []);

  const sendMessage = () => {
    if (wsRef.current && input.trim()) {
      wsRef.current.send(input);
      setInput('');
    }
  };

  return (
    <main id="main-site" className="GamePage">
      <h1 className="CenterTitle">phi Chatroom</h1>
      <div style={{ maxHeight: '60vh', overflowY: 'auto', border: '1px solid gold', padding: '1rem' }}>
        {messages.map((m, i) => (
          <p key={i}><code>{new Date(m.timestamp).toLocaleTimeString()}</code>: {m.msg}</p>
        ))}
      </div>
      <input
        style={{ marginTop: '1rem', width: '80%' }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        placeholder='Type a message or mod command...'
      />
      <button onClick={sendMessage}>Send</button>
    </main>
  );
};

export default ChatRoom;

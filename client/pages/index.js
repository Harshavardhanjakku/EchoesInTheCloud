// client/pages/index.js
import dynamic from 'next/dynamic';

// Chat uses socket.io-client and must run only on the client.
const Chat = dynamic(() => import('../components/Chat'), { ssr: false });

export default function Home() {
  return (
    <main>
      <Chat />
    </main>
  );
}
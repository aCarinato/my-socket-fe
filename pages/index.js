import axios from 'axios';
import io from 'socket.io-client';
import { useEffect, useState, useRef } from 'react';
// Udemy
import getUserInfo from '../utils/getUserInfo';

function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // SOCKET
  const socket = useRef();
  // persisting the state of query string of url through re-renders
  const openChatId = useRef();

  // USER AUTHENTICATION
  const [authState, setAuthState] = useState({
    username: '',
    userId: '',
    // email: '',
    token: '',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('user-auth') !== null) {
        setAuthState(JSON.parse(localStorage.getItem('user-auth')));
      }
      if (authState && authState.username.length > 0) setIsLoggedIn(true);
    }
  }, [authState && authState.username]);

  // useEffect(() => {
  //   if (authState && authState.username.length > 0) setIsLoggedIn(true);
  // }, [authState]);

  const [connectedUsers, setConnectedUsers] = useState([]);
  const [messages, setMessages] = useState([]);

  // Udemy
  // const [newMessageReceived, setNewMessageReceived] = useState([]);

  useEffect(() => {
    if (!socket.current) {
      socket.current = io(`${process.env.NEXT_PUBLIC_SOCKET_URL}`);
    }

    if (socket.current) {
      if (isLoggedIn) {
        socket.current.emit('join', { userId: authState.userId });

        // for Udemy app
        // socket.current.on('newMsgReceived', async ({ newMsg }) => {
        //   const { username } = await getUserInfo(newMsg.sender);

        //   if (user.)
        // });
      }
    }
  }, [isLoggedIn]);

  const handleLogout = () => {
    if (socket.current) {
      // if (authState && authState.username !== '') {
      if (isLoggedIn) {
        socket.current.emit('leave', { userId: authState.userId });
      }
    }

    localStorage.removeItem('user-auth');
    setAuthState({
      username: '',
      userId: '',
      // email: '',
      token: '',
    });
    setIsLoggedIn(false);
  };

  // SENDING MSG VIA SOCKET - SIMPLE EXAMPLE
  const [msg, setMsg] = useState('');

  const sendMsg = () => {
    if (socket.current) {
      if (msg.length > 0) {
        socket.current.emit('sendMsg', msg);
      }
    }
    setMsg('');
  };

  useEffect(() => {
    // TEST socket on vercel
    if (socket.current) {
      socket.current.on('sendMsg', (msg) => {
        let tempMsg = messages;

        tempMsg.push(msg);
        setMessages(tempMsg);
      });

      socket.current.on('connectedUsers', ({ users }) => {
        // users.length > 0 && setConnectedUsers(users);
        setConnectedUsers(users);
      });
      // }
    }
  }, []);

  return (
    <div>
      <h1>Simple Chat Socket.io</h1>
      <div>
        <a href="/messages">Go to Messages page</a>
      </div>

      {isLoggedIn ? (
        <div>
          <p>Current user: {authState.username}</p> <br></br>
          <button onClick={handleLogout}>Log Out</button>
          <br></br>
          {connectedUsers.map((user) => (
            <div key={user.userId}>{user.userId}</div>
          ))}
          <br></br>
          <div>
            <label>Type something</label>
            <input
              type="text"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <button onClick={sendMsg}>Send message</button>
            <br></br>
            {messages.map((message, idx) => (
              <div key={idx}>{message}</div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <a href="/login">Go to login</a>
        </div>
      )}
    </div>
  );
}

export default HomePage;

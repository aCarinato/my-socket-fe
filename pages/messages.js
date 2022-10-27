import axios from 'axios';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import getUserInfo from '../utils/getUserInfo';

function MessagesPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [connectedUsers, setConnectedUsers] = useState([]);

  const [messages, setMessages] = useState([]);

  // This ref is for persisting the state of query string in url throughout re-renders. This ref is the value of query string inside url
  const openChatId = useRef();
  //   openChatId === router.query.message

  const router = useRouter();

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

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const userId = authState.userId;

        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API}/chats/${userId}`
        );
        setChats(res.data);
        // return { props: { chatsData: res.data } };
      } catch (err) {
        console.log(err);
        // return { props: { errorLoading: true } };
      }
    };

    const fetchUsers = async () => {
      try {
        const username = authState.username;
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API}/chats/users/${username}`
        );
        // console.log(res);
        setUsers(res.data.users);
      } catch (err) {
        console.log(err);
        // return { props: { errorLoading: true } };
      }
    };

    if (isLoggedIn) {
      fetchChats();
      fetchUsers();
    }
  }, [isLoggedIn]);

  //   SOCKET
  const socket = useRef();

  useEffect(() => {
    if (!socket.current) {
      socket.current = io(`${process.env.NEXT_PUBLIC_SOCKET_URL}`);
    }

    if (socket.current) {
      if (isLoggedIn) {
        socket.current.emit('join', { userId: authState.userId });

        socket.current.on('connectedUsers', ({ users }) => {
          // users.length > 0 && setConnectedUsers(users);
          setConnectedUsers(users);
        });
      }
    }
  }, [isLoggedIn]);

  //   ADD NEW CHAT ON USER CARD CLICK
  const addChat = (user) => {
    // console.log(user);
    const alreadyInChat =
      chats.length > 0 &&
      chats.filter((chat) => chat.messagesWith === user._id).length > 0;

    if (alreadyInChat) {
      return router.push(`/messages?message=${user._id}`);
    }
    //
    else {
      const newChat = {
        messagesWith: user._id,
        username: user.username,
        lastMessage: '',
        date: Date.now(),
      };

      setChats((prev) => [newChat, ...prev]);

      return router.push(`/messages?message=${user._id}`, undefined, {
        shallow: true,
      });

      //   return router.push(`/messages?message=${user._id}`);
    }
  };

  // LOAD MESSAGES useEffect
  useEffect(() => {
    const loadMessages = () => {
      socket.current.emit('loadMessages', {
        userId: authState.userId,
        messagesWith: router.query.message,
      });

      socket.current.on('messagesLoaded', async ({ chat }) => {
        setMessages(chat.messages);
        // setBannerData({
        //   name: chat.messagesWith.name,
        //   profilePicUrl: chat.messagesWith.profilePicUrl,
        // });

        openChatId.current = chat.messagesWith._id;
        // divRef.current && scrollDivToBottom(divRef);
      });

      socket.current.on('noChatFound', async () => {
        //   const { name, profilePicUrl } = await getUserInfo(router.query.message);

        //   setBannerData({ name, profilePicUrl });
        setMessages([]);

        openChatId.current = router.query.message;
      });
    };

    if (socket.current && router.query.message) loadMessages();
  }, [router.query.message]);

  //   console.log(connectedUsers);

  //   SENDING A MESSAGE
  const [msgToSend, setMsgToSend] = useState('');
  const sendMsg = () => {
    if (socket.current) {
      if (isLoggedIn) {
        socket.current.emit('sendNewMsg', {
          userId: authState.userId,
          msgSendToUserId: openChatId.current,
          msg: msgToSend,
        });
      }
      setMsgToSend('');
    }
  };

  // Confirming msg is sent and receving the messages useEffect
  useEffect(() => {
    if (socket.current) {
      socket.current.on('msgSent', ({ newMsg }) => {
        if (newMsg.receiver === openChatId.current) {
          setMessages((prev) => [...prev, newMsg]);

          setChats((prev) => {
            const previousChat = prev.find(
              (chat) => chat.messagesWith === newMsg.receiver
            );
            previousChat.lastMessage = newMsg.msg;
            previousChat.date = newMsg.date;

            return [...prev];
          });
        }
      });

      socket.current.on('newMsgReceived', async ({ newMsg }) => {
        //     let senderName;

        // WHEN CHAT WITH SENDER IS CURRENTLY OPENED INSIDE YOUR BROWSER
        if (newMsg.sender === openChatId.current) {
          setMessages((prev) => [...prev, newMsg]);
          setChats((prev) => {
            const previousChat = prev.find(
              (chat) => chat.messagesWith === newMsg.sender
            );
            previousChat.lastMessage = newMsg.msg;
            previousChat.date = newMsg.date;
            // senderName = previousChat.name;
            return [...prev];
          });
        }
        //  THE USER IS NOT CURRENTLY ON THE CHAT ONLINE
        else {
          const { username } = await getUserInfo(newMsg.sender);
          const newChat = {
            messagesWith: newMsg.sender,
            username,
            lastMessage: newMsg.msg,
            date: newMsg.date,
          };

          setChats((prev) => {
            const previousChat = Boolean(
              prev.find((chat) => chat.messagesWith === newMsg.sender)
            );

            if (previousChat) {
              return [
                newChat,
                ...prev.filter((chat) => chat.messagesWith !== newMsg.sender),
              ];
            } else {
              return [newChat, ...prev];
            }
          });
        }

        //     newMsgSound(senderName);
      });
    }
  }, []);

  return (
    <div>
      <h1>Chats</h1>
      <br></br>
      <h2>Users</h2>
      <>
        {users.length > 0 ? (
          <div>
            {users.map((user) => (
              <div
                key={user._id}
                className="user-card"
                onClick={() => addChat(user)}
              >
                <p>{user.username}</p>
                {connectedUsers
                  .map((item) => item.userId)
                  .includes(user._id) ? (
                  <p className="user-online">online</p>
                ) : (
                  <p className="user-offline">offline</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>no users</p>
        )}
      </>

      {chats.length > 0 ? (
        <>
          <div>CIAO MONA</div>
          <div className="grid">
            <div>
              {chats.map((chat) => (
                <div
                  className="chat-card"
                  key={chat.messagesWith}
                  onClick={() =>
                    router.push(
                      `/messages?message=${chat.messagesWith}`,
                      undefined,
                      {
                        shallow: true,
                      }
                    )
                  }
                >
                  Chat with: {chat.username}
                </div>
              ))}
            </div>
            <div>
              {router.query.message && (
                <div>
                  {messages.map((msg) => (
                    <div
                      className={
                        msg.sender === authState.userId ? 'own-msg' : 'msg'
                      }
                      key={msg._id}
                    >
                      {/* {JSON.stringify(msg)} */}
                      <p className="p-msg">
                        {msg.msg} <span onClick={() => {}}>X</span>
                      </p>
                    </div>
                  ))}
                  <div>
                    <input
                      type="text"
                      value={msgToSend}
                      onChange={(e) => setMsgToSend(e.target.value)}
                    />
                    <button onClick={sendMsg}>send</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <p>No chats</p>
      )}
    </div>
  );
}

// export const getServerSideProps = async (ctx) => {
//   try {
//     const res = await axios.get(`${baseUrl}/api/chats`, {
//       headers: { Authorization: token },
//     });

//     return { props: { chatsData: res.data } };
//   } catch (error) {
//     return { props: { errorLoading: true } };
//   }
// };

export default MessagesPage;

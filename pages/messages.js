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

  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

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

    const fetchNotifications = async () => {
      try {
        const userId = authState.userId;
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API}/chats/notifications/${userId}`
        );
        // console.log(res);
        setNotifications(res.data);
      } catch (err) {
        console.log(err);
      }
    };

    if (isLoggedIn) {
      fetchChats();
      fetchUsers();
      fetchNotifications();
    }
  }, [isLoggedIn]);
  //   console.log(notifications);

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

          //   THIS IS NOT setting chats in the backend!! setChats is only on the frontend.
          //   The chats in the db are updated in app.js
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

          //   (maybe) here I need to set the notifications
          const newNotification = {
            type: 'newChatMsg',
            from: newMsg.sender,
            text: `You have a new message in the conversation with: ${username}`,
            isRead: false,
            date: Date.now(),
          };
          setNotifications((prev) => {
            // find out if there are already notifications from that user
            const previousNotifications = Boolean(
              prev.find((notification) => notification.from === newMsg.sender)
            );

            if (previousNotifications) {
              return [
                newNotification,
                ...prev.filter(
                  (notification) => notification.from !== newMsg.sender
                ),
              ];
            } else {
              return [newNotification, ...prev];
            }
          });

          //   and then emit an event to the backend to tell to add a new notification
          //   console.log(newMsg.receiver);
          socket.current.emit('sendNotification', {
            senderId: newMsg.sender,
            receiverId: newMsg.receiver,
          });
        }
      });
    }
  }, []);

  const readNotification = (msgFrom) => {
    console.log(msgFrom);
    router.push(`/messages?message=${msgFrom}`, undefined, {
      shallow: true,
    });

    // remove notifications from frontend
    // setNotifications find the index of the current notification
    const index = notifications.map((item) => item.from).indexOf(msgFrom);
    // console.log(index);

    if (index !== -1) {
      // REMOVE NOTIFICATION (intial approach, then opted to read it)
      // setNotifications((prev) => prev.splice(index, 1)); // DOES NOT WORK
      //   setNotifications((prev) =>
      //     prev.map((item) => item.from).filter((itm) => itm !== msgFrom)
      //   );

      // READ NOTIFICATION
      setNotifications((prev) => {
        const previousNotification = prev.find(
          (notification) => notification.from === msgFrom
        );
        previousNotification.isRead = true;

        return [...prev];
      });
    }

    // emit event to remove notification from backend
    const notificationTo = authState.userId;
    socket.current.emit('readNotification', {
      notificationTo,
      msgFrom,
    });
  };

  //   DISCONNECT
  //   useEffect(() => {
  //     if (socket.current) {
  //       socket.current.on('disconnect', () => {
  //         console.log('ciao');
  //       });
  //     }
  //   }, []);

  //   console.log(users);
  //   console.log(connectedUsers);

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

      <>
        {notifications && notifications.length > 0 && (
          <>
            <p>Notifications</p>
            {notifications.map((notification) => (
              <div
                className={
                  notification.isRead
                    ? 'notification-card'
                    : 'notification-card notification-unread'
                }
                key={notification._id}
                onClick={() => readNotification(notification.from)}
              >
                {notification.text}
              </div>
            ))}
            <br></br>
          </>
        )}
      </>

      {chats.length > 0 ? (
        <>
          <div>CIAO ALE IL GENIO</div>
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

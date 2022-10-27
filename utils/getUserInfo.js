import axios from 'axios';

const getUserInfo = async (userToFindId) => {
  try {
    const res = await axios.get(
      `${process.env.NEXT_PUBLIC_API}/chats/user/${userToFindId}`
    );

    return { username: res.data.username };
  } catch (error) {
    console.error(error);
  }
};

export default getUserInfo;

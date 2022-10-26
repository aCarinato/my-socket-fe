import axios from 'axios';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const router = useRouter();

  const [authState, setAuthState] = useState({
    username: '',
    userId: '',
    // email: '',
    token: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API}/auth/login`,
        {
          username,
          password,
        }
      );
      console.log(`${process.env.NEXT_PUBLIC_API}/auth/login`);
      localStorage.setItem(
        'user-auth',
        JSON.stringify({
          username: res.data.loginUser.username,
          userId: res.data.loginUser.userId,
          // email: res.data.loginUser.email,
          token: res.data.loginUser.token,
        })
      );
      router.push('/');
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAuthState(JSON.parse(localStorage.getItem('user-auth')));
    }
  }, []);

  if (authState && authState.username.length > 0) router.push('/');

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div>
          <label>username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label>password</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <button type="submit">Log in</button>
        </div>
      </form>
    </div>
  );
}

export default LoginPage;

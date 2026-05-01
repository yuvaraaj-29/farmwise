const fetch = require('node-fetch');

(async () => {
  try {
    const res = await fetch('http://127.0.0.1:3001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'testuser@example.com',
        username: 'testuser',
        password: 'secret123'
      }),
    });
    console.log('status', res.status);
    console.log(await res.text());
  } catch (err) {
    console.error('error', err.message);
  }
})();

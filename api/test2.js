const http = require('http');
const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/api/v1/leads',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.write(JSON.stringify({ name: 'Test' }));
req.end();

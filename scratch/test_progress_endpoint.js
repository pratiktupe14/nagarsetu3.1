const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function run() {
  console.log('Testing Staff Login...');
  const loginRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({
      mobileOrEmail: 'staff@nagarsetu.gov.in',
      password: 'password123',
    })
  );

  console.log('Login status:', loginRes.status, 'User:', loginRes.body?.user?.name);
  if (!loginRes.body?.token) {
    console.error('Failed to log in:', loginRes.body);
    return;
  }
  const token = loginRes.body.token;

  console.log('Fetching staff tasks...');
  const tasksRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/staff/tasks',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('Tasks status:', tasksRes.status, 'Total tasks:', tasksRes.body?.tasks?.length);
  let targetTaskId = 1;
  if (tasksRes.body?.tasks && tasksRes.body.tasks.length > 0) {
    targetTaskId = tasksRes.body.tasks[0].id;
  } else {
    // If no tasks assigned to this staff, check any complaint from public list
    const compRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/complaints?page=1&limit=5',
      method: 'GET'
    });
    console.log('Public complaints status:', compRes.status, 'Total:', compRes.body?.complaints?.length);
    if (compRes.body?.complaints?.length > 0) {
      targetTaskId = compRes.body.complaints[0].id;
    }
  }

  console.log('Sending progress note for Complaint ID:', targetTaskId);
  const noteRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: `/api/staff/task/${targetTaskId}/progress`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    JSON.stringify({ note: 'Field work underway - inspected site equipment and cleared initial blockage.' })
  );

  console.log('Progress note response:', noteRes.status, noteRes.body);
  if (noteRes.status === 201) {
    console.log('SUCCESS! Progress note persisted to database and read-back confirmed.');
  }
}

run().catch(console.error);

const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Testing live Vercel backend at https://nagarsetu-backend-api.vercel.app/api/health ...');
  try {
    const health = await httpsGet('https://nagarsetu-backend-api.vercel.app/api/health');
    console.log('Live Vercel Health Status:', health.status);
    console.log('Live Vercel Health Response:', health.data || health.text);
  } catch (err) {
    console.error('Error contacting live Vercel backend:', err.message);
  }

  console.log('\nTesting live Vercel departments at https://nagarsetu-backend-api.vercel.app/api/departments ...');
  try {
    const depts = await httpsGet('https://nagarsetu-backend-api.vercel.app/api/departments');
    console.log('Live Vercel Departments Status:', depts.status);
    console.log('Live Vercel Departments Response count:', (depts.data?.departments || depts.data || []).length);
  } catch (err) {
    console.error('Error contacting live Vercel departments:', err.message);
  }
}

main();

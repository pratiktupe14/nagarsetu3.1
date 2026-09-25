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
  const depts = await httpsGet('https://nagarsetu-backend-api.vercel.app/api/departments');
  console.log('Live Vercel Departments:', JSON.stringify(depts.data, null, 2));
}

main();

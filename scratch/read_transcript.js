const fs = require('fs');
const readline = require('readline');

async function main() {
  const fileStream = fs.createReadStream('C:/Users/prati/.gemini/antigravity-ide/brain/d67d0598-d3cb-4e70-87a9-95ee2145bb46/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if ((obj.step_index >= 650 && obj.step_index <= 660) || (obj.step_index >= 470 && obj.step_index <= 480)) {
        console.log(`[STEP ${obj.step_index}] ${obj.type} - ${obj.source}`);
        if (obj.content) console.log('  Content:', obj.content.slice(0, 300));
        if (obj.tool_calls) console.log('  Tool Calls:', JSON.stringify(obj.tool_calls).slice(0, 300));
      }
    } catch (e) {}
  }
}

main();

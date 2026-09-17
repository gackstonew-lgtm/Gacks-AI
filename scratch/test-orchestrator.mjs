import { aiOrchestrator } from '../server/agent/ai-orchestrator.js';

console.log('Testing AI Orchestrator with research prompt...');
try {
  const result = await aiOrchestrator.ask(
    "Research the latest gold market news and explain the major factors affecting the price.",
    {
      onText: (t) => process.stdout.write(t),
      onTool: (name) => console.log('\n[TOOL CALLED]:', name),
    },
    { userId: 'test-user' }
  );
  console.log('\n\nFinal Result:', result.text.slice(0, 300) + '...');
} catch (err) {
  console.error('Error running test:', err);
}

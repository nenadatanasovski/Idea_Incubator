// tests/e2e/test-com-bots.ts
// E2E Test: Verify 5 Telegram bots are working

import 'dotenv/config';

interface BotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

interface TestResult {
  botType: string;
  envVar: string;
  success: boolean;
  username?: string;
  botId?: number;
  error?: string;
}

const BOTS_TO_TEST = [
  { type: 'Monitor', envVar: 'TELEGRAM_BOT_MONITOR_TOKEN' },
  { type: 'Orchestrator', envVar: 'TELEGRAM_BOT_ORCHESTRATOR_TOKEN' },
  { type: 'Spec', envVar: 'TELEGRAM_BOT_SPEC_TOKEN' },
  { type: 'Build', envVar: 'TELEGRAM_BOT_BUILD_TOKEN' },
  { type: 'Validation', envVar: 'TELEGRAM_BOT_VALIDATION_TOKEN' },
  // These are rate-limited, expected to fail
  { type: 'SIA', envVar: 'TELEGRAM_BOT_SIA_TOKEN' },
  { type: 'System', envVar: 'TELEGRAM_BOT_SYSTEM_TOKEN' },
];

async function testBot(botType: string, envVar: string): Promise<TestResult> {
  const token = process.env[envVar];

  if (!token) {
    return {
      botType,
      envVar,
      success: false,
      error: 'Token not configured in .env',
    };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();

    if (data.ok) {
      const bot: BotInfo = data.result;
      return {
        botType,
        envVar,
        success: true,
        username: bot.username,
        botId: bot.id,
      };
    } else {
      return {
        botType,
        envVar,
        success: false,
        error: data.description || 'Unknown API error',
      };
    }
  } catch (error) {
    return {
      botType,
      envVar,
      success: false,
      error: (error as Error).message,
    };
  }
}

async function testSendMessage(token: string, chatId: string, text: string): Promise<{ success: boolean; messageId?: number; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });

    const data = await response.json();

    if (data.ok) {
      return { success: true, messageId: data.result.message_id };
    } else {
      return { success: false, error: data.description };
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        VIBE TELEGRAM BOT VERIFICATION TEST                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Test 1: Verify all bot tokens via getMe
  console.log('─────────────────────────────────────────────────────────────');
  console.log('TEST 1: Bot Token Verification (getMe API)');
  console.log('─────────────────────────────────────────────────────────────\n');

  const results: TestResult[] = [];

  for (const bot of BOTS_TO_TEST) {
    const result = await testBot(bot.type, bot.envVar);
    results.push(result);

    if (result.success) {
      console.log(`  ✅ ${bot.type.padEnd(12)} @${result.username} (ID: ${result.botId})`);
    } else {
      console.log(`  ❌ ${bot.type.padEnd(12)} ${result.error}`);
    }
  }

  // Summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('─────────────────────────────────────────────────────────────\n');

  // Test 2: Send test message (if chat ID is available)
  const testChatId = process.env.TELEGRAM_TEST_CHAT_ID;

  if (testChatId) {
    console.log('─────────────────────────────────────────────────────────────');
    console.log('TEST 2: Send Test Message');
    console.log('─────────────────────────────────────────────────────────────\n');

    const workingBots = results.filter(r => r.success);

    for (const bot of workingBots) {
      const token = process.env[bot.envVar]!;
      const text = `🧪 *Test Message*\n\nBot: @${bot.username}\nType: ${bot.botType}\nTime: ${new Date().toISOString()}`;

      const sendResult = await testSendMessage(token, testChatId, text);

      if (sendResult.success) {
        console.log(`  ✅ ${bot.botType.padEnd(12)} Message sent (ID: ${sendResult.messageId})`);
      } else {
        console.log(`  ❌ ${bot.botType.padEnd(12)} ${sendResult.error}`);
      }
    }
  } else {
    console.log('─────────────────────────────────────────────────────────────');
    console.log('TEST 2: Send Test Message (SKIPPED)');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('\n  ⚠️  TELEGRAM_TEST_CHAT_ID not set in .env');
    console.log('  To enable message testing:');
    console.log('  1. Start a chat with one of the bots');
    console.log('  2. Send /start to the bot');
    console.log('  3. Get your chat ID from the bot\'s getUpdates');
    console.log('  4. Add TELEGRAM_TEST_CHAT_ID=<your_chat_id> to .env\n');
  }

  // Test 3: Get updates (check for pending messages)
  console.log('─────────────────────────────────────────────────────────────');
  console.log('TEST 3: Check for Pending Updates');
  console.log('─────────────────────────────────────────────────────────────\n');

  for (const bot of results.filter(r => r.success)) {
    const token = process.env[bot.envVar]!;

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=5`);
      const data = await response.json();

      if (data.ok) {
        const updates = data.result || [];
        if (updates.length > 0) {
          console.log(`  📬 ${bot.botType.padEnd(12)} ${updates.length} pending update(s)`);

          // Show first update details
          const firstUpdate = updates[0];
          if (firstUpdate.message) {
            const msg = firstUpdate.message;
            console.log(`     └─ From: ${msg.from?.username || msg.from?.id} | Chat: ${msg.chat.id}`);
            console.log(`     └─ Text: "${(msg.text || '').substring(0, 50)}..."`);

            // If we don't have a test chat ID, suggest using this one
            if (!testChatId) {
              console.log(`     └─ 💡 Add TELEGRAM_TEST_CHAT_ID=${msg.chat.id} to .env`);
            }
          }
        } else {
          console.log(`  📭 ${bot.botType.padEnd(12)} No pending updates`);
        }
      }
    } catch (error) {
      console.log(`  ❌ ${bot.botType.padEnd(12)} Failed to get updates`);
    }
  }

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log('                    TEST COMPLETE');
  console.log('═════════════════════════════════════════════════════════════\n');

  // Return exit code
  return passed >= 5 ? 0 : 1;
}

runTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });

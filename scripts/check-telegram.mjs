const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}
if (!TELEGRAM_CHAT_ID) {
  console.error('Missing TELEGRAM_CHAT_ID');
  process.exit(1);
}

const chatIdLength = TELEGRAM_CHAT_ID.length;
const startsWithAt = TELEGRAM_CHAT_ID.startsWith('@');
const startsWithMinus = TELEGRAM_CHAT_ID.startsWith('-');
const isAllDigitsAfterMinus = /^-?\d+$/.test(TELEGRAM_CHAT_ID);

console.log('--- TELEGRAM_CHAT_ID format check ---');
console.log(`length: ${chatIdLength}`);
console.log(`starts_with_@: ${startsWithAt}`);
console.log(`starts_with_-: ${startsWithMinus}`);
console.log(`is_numeric: ${isAllDigitsAfterMinus}`);
if (startsWithAt) {
  console.log('format guess: PUBLIC channel username (good for public channels)');
} else if (startsWithMinus && isAllDigitsAfterMinus) {
  console.log('format guess: numeric channel/group ID (good for private channels)');
} else {
  console.log('format guess: ⚠️  UNUSUAL — likely wrong. Should be either "@username" or "-100..." numeric ID');
}

console.log('\n--- getMe (bot identity) ---');
try {
  const meRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
  const meJson = await meRes.json();
  if (meJson.ok) {
    console.log(`✓ Bot: @${meJson.result.username} (id ${meJson.result.id}, name "${meJson.result.first_name}")`);
  } else {
    console.log(`✗ getMe failed: ${meJson.error_code} ${meJson.description}`);
    console.log('  → TELEGRAM_BOT_TOKEN is invalid. Revoke + recreate in BotFather.');
    process.exit(1);
  }
} catch (err) {
  console.log(`✗ getMe network error: ${err.message}`);
  process.exit(1);
}

console.log('\n--- getChat (channel info) ---');
try {
  const chatRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat?chat_id=${encodeURIComponent(TELEGRAM_CHAT_ID)}`
  );
  const chatJson = await chatRes.json();
  if (chatJson.ok) {
    const c = chatJson.result;
    console.log(`✓ Chat found: type="${c.type}" title="${c.title || '(no title)'}" id=${c.id}`);
    if (c.username) console.log(`  username: @${c.username}`);
    console.log('\n--- getChatMember (is bot admin?) ---');
    const meRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const meJson = await meRes.json();
    const memberRes = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(TELEGRAM_CHAT_ID)}&user_id=${meJson.result.id}`
    );
    const memberJson = await memberRes.json();
    if (memberJson.ok) {
      const status = memberJson.result.status;
      const canPost = memberJson.result.can_post_messages;
      console.log(`  bot status in chat: "${status}"`);
      console.log(`  can_post_messages: ${canPost}`);
      if (status !== 'administrator' && status !== 'creator') {
        console.log('  ⚠️  Bot is NOT an admin. Add @DityamComUABot as admin with "Post Messages" permission.');
      } else if (canPost === false) {
        console.log('  ⚠️  Bot is admin but can\'t post. Enable "Post Messages" permission.');
      } else {
        console.log('  ✓ Bot has correct permissions. Everything should work.');
      }
    } else {
      console.log(`  ✗ getChatMember failed: ${memberJson.error_code} ${memberJson.description}`);
    }
  } else {
    console.log(`✗ getChat failed: ${chatJson.error_code} ${chatJson.description}`);
    if (chatJson.description?.toLowerCase().includes('chat not found')) {
      console.log('\n  Likely causes:');
      console.log('  1. TELEGRAM_CHAT_ID value is wrong (typo in @username)');
      console.log('  2. Bot is not a member of the channel — add it as administrator first');
      console.log('  3. For private channels: must use numeric -100... ID, not @username');
    }
  }
} catch (err) {
  console.log(`✗ getChat network error: ${err.message}`);
}

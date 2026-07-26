/**
 * n8n Code Node — 跨境电商 AI 文案自动生成
 *
 * 节点位置：Set（产品数据）→ Code（本节点）→ Output
 *
 * 功能：读取产品数据 → 拼接 Prompt → 调用 Coze API（SSE 流式）→ 解析英文文案 → 输出
 */

const product = $input.first().json;

// ── 1. 调用 Coze API ──
const response = await this.helpers.request({
  method: 'POST',
  url: 'https://api.coze.cn/v3/chat',
  headers: {
    'Authorization': 'Bearer {{COZE_TOKEN}}',  // 替换为你的 Coze Personal Access Token
    'Content-Type': 'application/json'
  },
  body: {
    bot_id: '{{BOT_ID}}',           // 替换为你的 Coze Bot ID
    user_id: 'rpa-demo',
    stream: true,
    auto_save_history: false,
    additional_messages: [{
      role: 'user',
      content: [
        '你是跨境电商文案专家。为以下产品写英文描述。',
        '产品：' + product.productName,
        'SKU：' + product.sku,
        '卖点：' + product.features,
        '售价：$' + product.priceUSD,
        '平台：' + product.market,
        '',
        '输出格式：TITLE + BULLETS(4条) + DESCRIPTION(150字内)。'
      ].join('\n'),
      content_type: 'text'
    }]
  }
});

// ── 2. 解析 SSE 流式响应 ──
let raw = '';
if (typeof response === 'string') {
  raw = response;
} else if (typeof response.body === 'string') {
  raw = response.body;
} else {
  raw = JSON.stringify(response);
}

let answer = '';
const lines = raw.split('\n');
for (const line of lines) {
  if (line.startsWith('data:')) {
    const d = line.slice(5).trim();
    if (d === '[DONE]') continue;
    try {
      const ev = JSON.parse(d);
      // 只收集 answer 类型事件，并去重
      if (ev.type === 'answer' && ev.content && !answer.includes(ev.content)) {
        answer += ev.content;
      }
    } catch (e) {
      // 跳过非 JSON 行
    }
  }
}

// ── 3. 清理并返回 ──
answer = answer
  .replace(/\{"msg_type".*?\}/g, '')
  .replace(/\{"type":"follow_up".*?\}/g, '')
  .trim();

return [{
  json: {
    sku: product.sku,
    productName: product.productName,
    copy: answer || '（AI 返回为空，请检查 Bot 配置）',
    generatedAt: new Date().toISOString()
  }
}];

const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    chatPath: null,
    buildChatUrl(model) {
      return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    },
    buildHeaders(apiKey) {
      return {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      };
    },
    buildBody(model, messages) {
      const systemMsg = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');
      const contents = userMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const body = { contents, generationConfig: { temperature: 0.2 } };
      if (systemMsg) {
        body.systemInstruction = { parts: [{ text: systemMsg.content }] };
      }
      return JSON.stringify(body);
    },
    extractContent(json) {
      return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },
  },
};

async function chat(providerName, apiKey, model, messages) {
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`Unknown provider: ${providerName}`);
  if (!apiKey) throw new Error('API key is required');
  if (!model) throw new Error('Model name is required');

  const url = provider.buildChatUrl
    ? provider.buildChatUrl(model, apiKey)
    : `${provider.baseUrl}${provider.chatPath}`;

  const headers = provider.buildHeaders(apiKey);
  const body = provider.buildBody(model, messages);

  // 25초 API 타임아웃 처리
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, { 
      method: 'POST', 
      headers, 
      body,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      let errMsg = `${provider.name} API error (${response.status})`;
      try {
        const errJson = JSON.parse(errText);
        errMsg += ': ' + (errJson.error?.message || errJson.error?.type || errText);
      } catch {
        errMsg += ': ' + errText.slice(0, 200);
      }
      throw new Error(errMsg);
    }

    const json = await response.json();
    const content = provider.extractContent(json);
    if (!content) throw new Error(`Empty response from ${provider.name}`);
    return content;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function listProviders() {
  return Object.entries(PROVIDERS).map(([key, p]) => ({ id: key, name: p.name }));
}

module.exports = { chat, listProviders, PROVIDERS };

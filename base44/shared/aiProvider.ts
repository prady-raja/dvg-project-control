/**
 * The one way the app talks to a language model.
 *
 *   complete({ system, messages | user, json, schema, files, maxTokens }) -> { content, usage }
 *
 * Two providers sit behind it:
 *   - 'fetch'  — an OpenAI- or Anthropic-compatible API over plain fetch. The
 *                portable default: it moves unchanged into a Supabase Edge Function.
 *   - 'base44' — the platform's Core.InvokeLLM, which needs no key. Interim only,
 *                for while the app is on Base44 and no funded key exists.
 *
 * No SDK or runtime import here: keys and the InvokeLLM function are passed in,
 * so the selection rules can be tested and the module ported as is.
 */

export const PROVIDER_SETTINGS = ['auto', 'fetch', 'base44'];
export const PROVIDER_APIS = ['openai', 'anthropic'];

export const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-5-5',
};

const ENDPOINTS = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
};

const isClaude = (model) => /^claude/i.test(String(model || ''));

/**
 * Which provider to use. `keys` holds the secrets that are set:
 * { AI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY }. Returns null when nothing
 * usable is configured.
 */
export function chooseProvider(settings = {}, keys = {}, { invokeAvailable = false } = {}) {
  const setting = PROVIDER_SETTINGS.includes(settings.provider) ? settings.provider : 'auto';

  let api = PROVIDER_APIS.includes(settings.provider_api) ? settings.provider_api : '';
  if (!api) {
    if (keys.ANTHROPIC_API_KEY && !keys.OPENAI_API_KEY) api = 'anthropic';
    else if (keys.OPENAI_API_KEY) api = 'openai';
    else api = isClaude(settings.model) ? 'anthropic' : 'openai';
  }
  const apiKey = keys.AI_API_KEY || (api === 'anthropic' ? keys.ANTHROPIC_API_KEY : keys.OPENAI_API_KEY) || '';

  const fetchChoice = apiKey
    ? {
      kind: 'fetch',
      api,
      apiKey,
      baseUrl: String(settings.base_url || '').trim().replace(/\/+$/, '') || ENDPOINTS[api],
      model: settings.model && isClaude(settings.model) === (api === 'anthropic') ? settings.model : DEFAULT_MODELS[api],
    }
    : null;
  const base44Choice = invokeAvailable ? { kind: 'base44', api: 'base44', apiKey: '', baseUrl: '', model: 'base44-default' } : null;

  if (setting === 'fetch') return fetchChoice;
  if (setting === 'base44') return base44Choice;
  return fetchChoice || base44Choice;
}

const refusal = (message, httpStatus) => {
  const error = new Error(message);
  error.status = httpStatus === 429 ? 429 : 502;
  return error;
};

const messagesOf = ({ messages, user }) =>
  Array.isArray(messages) && messages.length ? messages : [{ role: 'user', content: String(user || '') }];

/** First JSON object in a reply, for providers without a JSON mode. */
export function extractJson(text) {
  const raw = String(text || '').trim();
  if (raw.startsWith('{')) return raw;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
}

async function completeOpenAi(choice, request, fetchImpl) {
  const response = await fetchImpl(`${choice.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${choice.apiKey}` },
    body: JSON.stringify({
      model: choice.model,
      messages: [{ role: 'system', content: request.system || '' }, ...messagesOf(request)],
      temperature: request.json ? 0.1 : 0.3,
      max_tokens: request.maxTokens || 1500,
      ...(request.json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(60000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw refusal(payload?.error?.message || `The AI provider refused the request (${response.status}).`, response.status);
  }
  return { content: payload?.choices?.[0]?.message?.content || '', usage: payload?.usage || {} };
}

async function completeAnthropic(choice, request, fetchImpl) {
  const system = request.json
    ? `${request.system || ''}\n\nReply with one JSON object and nothing else.`
    : request.system || '';
  const response = await fetchImpl(`${choice.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': choice.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: choice.model,
      system,
      messages: messagesOf(request),
      max_tokens: request.maxTokens || 1500,
      temperature: request.json ? 0.1 : 0.3,
    }),
    signal: AbortSignal.timeout(60000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw refusal(payload?.error?.message || `The AI provider refused the request (${response.status}).`, response.status);
  }
  const text = (payload?.content || []).filter((part) => part?.type === 'text').map((part) => part.text).join('');
  const input = payload?.usage?.input_tokens || 0;
  const output = payload?.usage?.output_tokens || 0;
  return {
    content: request.json ? extractJson(text) : text,
    usage: { prompt_tokens: input, completion_tokens: output, total_tokens: input + output },
  };
}

async function completeBase44(request, invokeLLM) {
  const transcript = messagesOf(request).map((m) => `${m.role === 'user' ? '' : `${m.role}: `}${m.content}`).join('\n\n');
  const prompt = `${request.system || ''}\n\n${transcript}`.trim();
  try {
    const result = await invokeLLM({
      prompt,
      ...(request.json ? { response_json_schema: request.schema || { type: 'object', additionalProperties: true } } : {}),
      ...(Array.isArray(request.files) && request.files.length ? { file_urls: request.files } : {}),
    });
    const value = result?.data !== undefined && result?.status !== undefined ? result.data : result;
    return { content: typeof value === 'string' ? value : JSON.stringify(value ?? ''), usage: {} };
  } catch (error) {
    throw refusal(error?.message || 'The platform AI could not answer.', error?.status || 502);
  }
}

/**
 * Builds the provider for a choice. `invokeLLM` is Core.InvokeLLM; `fetchImpl`
 * defaults to the global fetch.
 */
export function makeProvider(choice, { invokeLLM, fetchImpl } = {}) {
  if (!choice) return null;
  const doFetch = fetchImpl || ((...args) => fetch(...args));
  return {
    kind: choice.kind,
    api: choice.api,
    model: choice.model,
    complete(request) {
      if (choice.kind === 'base44') return completeBase44(request, invokeLLM);
      return choice.api === 'anthropic'
        ? completeAnthropic(choice, request, doFetch)
        : completeOpenAi(choice, request, doFetch);
    },
  };
}

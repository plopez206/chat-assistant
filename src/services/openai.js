import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../config.js';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
export async function chatCompletion({ messages, functions = [] }) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages,
    functions,
    function_call: functions.length ? 'auto' : undefined
  });
  return response.choices[0].message;
}

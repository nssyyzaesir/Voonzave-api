import { OpenAI } from 'openai';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Interface básica para personalidade da IA
export interface AIPersonality {
  tone: 'professional' | 'casual' | 'technical' | 'friendly' | 'sarcastic';
  context?: string;
  knowledgeBase?: string;
}

// Verificar se a chave da API está definida
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn('AVISO: OPENAI_API_KEY não encontrada nas variáveis de ambiente. A API não funcionará corretamente.');
}

// Inicializar cliente OpenAI
const openai = new OpenAI({
  apiKey: apiKey || 'dummy-key-for-development'
});

/**
 * Gera uma resposta da IA baseada no prompt do usuário
 * @param prompt Mensagem do usuário
 * @param history Histórico de mensagens anteriores da conversa
 * @param personality Personalidade que a IA deve adotar
 * @param userRole Papel do usuário (comum ou admin)
 * @returns Resposta da IA
 */
export async function generateAIResponse(
  prompt: string,
  history: { role: 'user' | 'assistant', content: string }[],
  personality: AIPersonality = { tone: 'professional' },
  userRole: 'user' | 'admin' = 'user'
): Promise<string> {
  try {
    // Se não tiver API key, devolve uma resposta padrão para ambiente de desenvolvimento
    if (!apiKey) {
      console.log('Sem API key, usando resposta simulada para desenvolvimento');
      return generateMockResponse(prompt, personality, userRole);
    }

    // Construir mensagens para enviar para a API
    const messages = [
      {
        role: 'system',
        content: getSystemPrompt(personality, userRole)
      },
      ...history,
      {
        role: 'user',
        content: prompt
      }
    ];

    // Fazer chamada para a API da OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages as any,
      temperature: getTemperatureByPersonality(personality),
      max_tokens: 800,
    });

    return response.choices[0].message.content || 'Desculpe, não consegui processar sua solicitação.';
  } catch (error) {
    console.error('Erro ao chamar a API OpenAI:', error);
    return 'Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente mais tarde.';
  }
}

/**
 * Retorna a instrução do sistema baseada na personalidade escolhida
 */
function getSystemPrompt(personality: AIPersonality, userRole: 'user' | 'admin'): string {
  let basePrompt = `Você é um assistente virtual da Voonzave. `;
  
  // Adicionar contexto de acordo com o tipo de usuário
  if (userRole === 'admin') {
    basePrompt += `Você está conversando com um administrador do sistema que tem acesso a todos os recursos e funcionalidades. Você pode fornecer informações técnicas detalhadas e dados sensíveis quando solicitado. `;
  } else {
    basePrompt += `Você está conversando com um usuário comum do sistema. Forneça informações úteis, mas evite revelar detalhes técnicos internos ou dados sensíveis. `;
  }
  
  // Adicionar instruções sobre o tom baseado na personalidade
  switch (personality.tone) {
    case 'professional':
      basePrompt += `Mantenha um tom profissional, formal e direto. Use linguagem corporativa apropriada.`;
      break;
    case 'casual':
      basePrompt += `Mantenha um tom casual e descontraído. Seja amigável e use linguagem informal.`;
      break;
    case 'technical':
      basePrompt += `Use um tom técnico e preciso. Forneça detalhes técnicos quando relevante e use terminologia específica do domínio.`;
      break;
    case 'friendly':
      basePrompt += `Seja muito amigável e acolhedor. Use uma linguagem calorosa e empática, como se estivesse conversando com um amigo.`;
      break;
    case 'sarcastic':
      basePrompt += `Seja levemente sarcástico e bem-humorado, mas sempre respeitoso e útil. Use humor inteligente quando apropriado.`;
      break;
    default:
      basePrompt += `Mantenha um tom profissional e direto.`;
  }
  
  // Adicionar contexto personalizado se fornecido
  if (personality.context) {
    basePrompt += ` ${personality.context}`;
  }
  
  return basePrompt;
}

/**
 * Ajusta a temperatura baseada na personalidade para controlar a criatividade da resposta
 */
function getTemperatureByPersonality(personality: AIPersonality): number {
  switch (personality.tone) {
    case 'professional':
      return 0.3; // Mais focado e preciso
    case 'technical':
      return 0.2; // Muito preciso e técnico
    case 'casual':
      return 0.6; // Mais relaxado e variado
    case 'friendly':
      return 0.7; // Mais expressivo e caloroso
    case 'sarcastic':
      return 0.8; // Mais criativo para humor e sarcasmo
    default:
      return 0.5; // Valor padrão balanceado
  }
}

/**
 * Gera respostas simuladas para uso durante desenvolvimento sem API key
 * APENAS PARA DESENVOLVIMENTO
 */
function generateMockResponse(prompt: string, personality: AIPersonality, userRole: string): string {
  const promptLower = prompt.toLowerCase();
  const currentTime = new Date().toLocaleTimeString();
  
  // Algumas respostas simuladas baseadas em palavras-chave
  if (promptLower.includes('olá') || promptLower.includes('oi') || promptLower.includes('hey')) {
    return `Olá! Como posso ajudar você ${userRole === 'admin' ? 'administrador' : 'hoje'}? (resposta simulada - ${personality.tone})`;
  } 
  else if (promptLower.includes('horas') || promptLower.includes('hora atual')) {
    return `Agora são ${currentTime}. (resposta simulada - ${personality.tone})`;
  }
  else if (promptLower.includes('planos') || promptLower.includes('assinatura')) {
    return `Temos diversos planos de assinatura disponíveis. Você pode conferir todos eles na página de planos. ${userRole === 'admin' ? 'Como administrador, você pode modificar esses planos no painel administrativo.' : 'Posso te ajudar a escolher o melhor para você!'} (resposta simulada - ${personality.tone})`;
  }
  else if (promptLower.includes('ajuda') || promptLower.includes('suporte')) {
    return `Estou aqui para ajudar! Por favor, me diga qual é o seu problema ou dúvida específica para que eu possa lhe dar o melhor suporte possível. (resposta simulada - ${personality.tone})`;
  }
  else if (userRole === 'admin' && (promptLower.includes('usuário') || promptLower.includes('dados') || promptLower.includes('estatísticas'))) {
    return `Como administrador, você tem acesso a todos os dados e estatísticas do sistema no painel administrativo. Você pode verificar informações de usuários, planos ativos e métricas de uso. (resposta simulada - ${personality.tone})`;
  }
  else {
    return `Entendi sua mensagem sobre "${prompt.substring(0, 30)}...". Como posso ajudar mais com isso? (resposta simulada - ${personality.tone})`;
  }
}
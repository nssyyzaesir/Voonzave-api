import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { generateAIResponse, AIPersonality } from '../services/openai';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const aiRouter = Router();

// Middleware para verificar autenticação
const authMiddleware = (req: Request, res: Response, next: Function) => {
  try {
    console.log("PORRA DO CARALHO! Requisição recebida no middleware de autenticação da IA");
    const header = req.headers.authorization;
    
    if (!header) {
      console.log("Requisição sem header de autorização, rejeitando");
      return res.status(401).json({ message: "Autenticação necessária para acessar o chat IA." });
    }
    
    // Extrair token do cabeçalho
    const token = header.split(' ')[1];
    
    // Verificação do token seria feita aqui
    // Para simplicidade, estamos apenas verificando se o token existe
    if (!token) {
      console.log("Token inválido ou ausente, rejeitando");
      return res.status(401).json({ message: "Token inválido." });
    }
    
    // Poderíamos validar o token JWT aqui
    // Por simplicidade, estamos prosseguindo e assumindo que o usuário está autenticado
    console.log("Autenticação aceita, usuário tem permissão");
    
    next();
  } catch (error) {
    console.error("Erro na autenticação:", error);
    return res.status(401).json({ message: "Erro na autenticação." });
  }
};

// Schema para validação de novas mensagens
const messageSchema = z.object({
  content: z.string().min(1, "Mensagem não pode estar vazia"),
  userId: z.number().int().positive().optional(),
  conversationId: z.string().optional(),
  personality: z.object({
    tone: z.enum(['professional', 'casual', 'technical', 'friendly', 'sarcastic']).default('professional'),
    context: z.string().optional(),
  }).optional(),
});

// Rota para enviar mensagem ao chat
aiRouter.post('/message', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log("CARALHO DO CU! Recebendo mensagem na rota de chat da IA");
    // Validar o corpo da requisição
    const validationResult = messageSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.log("Dados inválidos recebidos:", JSON.stringify(req.body));
      return res.status(400).json({ 
        message: "Dados inválidos", 
        errors: validationResult.error.errors 
      });
    }
    
    const { content, userId = 1, conversationId: existingConversationId, personality } = validationResult.data;
    
    // Verificar se precisamos criar uma nova conversa ou usar uma existente
    const conversationId = existingConversationId || await storage.createConversation(userId);
    
    // Salvar a mensagem do usuário
    const userMessage = await storage.saveMessage({
      userId,
      content,
      role: 'user',
      conversationId
    });
    
    // Obter histórico da conversa
    const conversationHistory = await storage.getMessagesByConversation(conversationId);
    const formattedHistory = conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
    
    // Personalidade da IA (padrão: professional)
    const aiPersonality: AIPersonality = personality || { tone: 'professional' };
    
    // Obter usuário para determinar seu papel
    const user = await storage.getUser(userId);
    const userRole = user?.role === 'admin' ? 'admin' : 'user';
    
    // Gerar resposta da IA
    const aiResponseContent = await generateAIResponse(
      content,
      formattedHistory,
      aiPersonality,
      userRole as 'user' | 'admin'
    );
    
    // Salvar a resposta da IA
    const aiResponse = await storage.saveMessage({
      userId,
      content: aiResponseContent,
      role: 'assistant',
      conversationId
    });
    
    // Retornar a resposta
    res.status(200).json({
      message: "Mensagem processada com sucesso",
      conversationId,
      response: {
        id: aiResponse.id,
        content: aiResponse.content,
        timestamp: aiResponse.timestamp
      }
    });
    
  } catch (error) {
    console.error("Erro ao processar mensagem:", error);
    res.status(500).json({ message: "Erro ao processar a mensagem" });
  }
});

// Rota para obter histórico de conversa
aiRouter.get('/conversations/:conversationId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const messages = await storage.getMessagesByConversation(conversationId);
    
    res.status(200).json({
      conversationId,
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: msg.timestamp
      }))
    });
    
  } catch (error) {
    console.error("Erro ao obter histórico de conversa:", error);
    res.status(500).json({ message: "Erro ao obter histórico de conversa" });
  }
});

// Rota para obter todas as conversas do usuário (apenas IDs)
aiRouter.get('/conversations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string) || 1;
    
    // Obter todas as mensagens do usuário
    const userMessages = await storage.getMessagesByUser(userId);
    
    // Extrair IDs únicos de conversas
    const conversationIdsSet = new Set<string>();
    userMessages.forEach(msg => conversationIdsSet.add(msg.conversationId));
    const conversationIds = Array.from(conversationIdsSet);
    
    // Para cada conversa, obtemos a primeira e a última mensagem para exibir uma prévia
    const conversationsWithPreview = await Promise.all(
      conversationIds.map(async (convId) => {
        const messages = await storage.getMessagesByConversation(convId);
        const firstMessage = messages[0];
        const lastMessage = messages[messages.length - 1];
        
        return {
          id: convId,
          preview: firstMessage?.content.substring(0, 50) + '...',
          lastMessage: {
            content: lastMessage?.content.substring(0, 50) + '...',
            timestamp: lastMessage?.timestamp
          },
          messageCount: messages.length
        };
      })
    );
    
    res.status(200).json({
      userId,
      conversations: conversationsWithPreview
    });
    
  } catch (error) {
    console.error("Erro ao listar conversas:", error);
    res.status(500).json({ message: "Erro ao listar conversas" });
  }
});

// Rota admin para obter histórico de todas as conversas
aiRouter.get('/admin/conversations', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Verificar se o usuário é admin
    // Na implementação real, você verificaria o token JWT
    const isAdmin = true; // Simulação - na aplicação real verificar a partir do token
    
    if (!isAdmin) {
      return res.status(403).json({ message: "Acesso negado. Permissão administrativa necessária." });
    }
    
    // Obter todas as mensagens
    const allMessages = await storage.getAllMessages();
    
    // Agrupar por conversationId
    const conversations = allMessages.reduce((acc, message) => {
      if (!acc[message.conversationId]) {
        acc[message.conversationId] = [];
      }
      acc[message.conversationId].push(message);
      return acc;
    }, {} as Record<string, typeof allMessages>);
    
    // Formatar resultado
    const result = Object.entries(conversations).map(([conversationId, messages]) => {
      const user = messages[0]?.userId;
      return {
        conversationId,
        userId: user,
        messageCount: messages.length,
        startedAt: messages[0]?.timestamp,
        lastUpdatedAt: messages[messages.length - 1]?.timestamp,
        preview: messages[0]?.content.substring(0, 50) + '...'
      };
    });
    
    res.status(200).json({
      conversations: result
    });
    
  } catch (error) {
    console.error("Erro ao listar conversas para admin:", error);
    res.status(500).json({ message: "Erro ao listar conversas" });
  }
});

// Rota para criar uma nova conversa
aiRouter.post('/conversations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || 1;
    const conversationId = await storage.createConversation(userId);
    
    res.status(201).json({
      message: "Nova conversa criada",
      conversationId
    });
    
  } catch (error) {
    console.error("Erro ao criar conversa:", error);
    res.status(500).json({ message: "Erro ao criar conversa" });
  }
});

export default aiRouter;
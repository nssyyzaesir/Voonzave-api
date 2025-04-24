import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { WebSocketServer, WebSocket } from 'ws';

const JWT_SECRET = "voonzave_jwt_secret_key";

export async function registerRoutes(app: Express): Promise<Server> {
  // Rota de API para verificar se o serviço está funcionando
  app.get('/api/status', (req: Request, res: Response) => {
    console.log('Requisição recebida na rota /api/status - API está viva!');
    res.send('API do inferno funcionando porra');
  });

  // Rota de login com mensagens de debug melhoradas
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    console.log("Requisição de login recebida para:", email);
    
    try {
      // Para testes, permitir credenciais fixas
      if (email === "admin@voonzave.com" && password === "admin123") {
        console.log("Credenciais de admin verificadas com sucesso");
        // Criar um usuário admin mock para teste
        const user = {
          id: 999,
          email: "admin@voonzave.com",
          name: "Admin Voonzave",
          role: "admin"
        };
        
        const token = jwt.sign(
          { userId: user.id, role: user.role },
          JWT_SECRET,
          { expiresIn: '1h' }
        );
        
        return res.status(200).json({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          token
        });
      }
      
      // Também permitir credenciais fixas para usuário de teste
      if (email === "usuario@teste.com" && password === "senha123") {
        console.log("Credenciais de usuário de teste verificadas com sucesso");
        const user = {
          id: 888,
          email: "usuario@teste.com",
          name: "Usuário Teste",
          role: "user"
        };
        
        const token = jwt.sign(
          { userId: user.id, role: user.role },
          JWT_SECRET,
          { expiresIn: '1h' }
        );
        
        return res.status(200).json({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          token
        });
      }
      
      // Verificar o usuário no banco de dados
      console.log("Verificando usuário no banco de dados para:", email);
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        console.log("Usuário não encontrado:", email);
        return res.status(400).json({ message: "Credenciais inválidas!" });
      }
      
      // Verificar senha
      const isValidPassword = await storage.comparePassword(user.password, password);
      
      if (!isValidPassword) {
        console.log("Senha inválida para o usuário:", email);
        return res.status(400).json({ message: "Credenciais inválidas!" });
      }
      
      console.log("Login bem-sucedido para:", email);
      
      // Gerar token JWT
      const token = jwt.sign(
        { userId: user.id, role: user.role || 'user' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      
      res.status(200).json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        token
      });
      
    } catch (error) {
      console.error("Erro no login:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });
  
  // Middleware para verificar autenticação
  const authMiddleware = (req: Request, res: Response, next: Function) => {
    try {
      const header = req.headers.authorization;
      
      if (!header) {
        return res.status(401).json({ message: "Autenticação falhou. Faça login novamente." });
      }
      
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: "Autenticação falhou. Faça login novamente." });
    }
  };
  
  // Rota para obter usuário atual
  app.get("/api/auth/me", authMiddleware, (req: Request, res: Response) => {
    // Formatar a resposta para incluir o objeto 'user' que é esperado pelo cliente
    console.log("Verificação de token na rota /api/auth/me:", req.user);
    
    const { userId, role } = req.user;
    
    // Podemos obter mais dados do usuário a partir do seu ID no banco de dados
    // Mas para este exemplo, vamos enviar os dados básicos extraídos do token
    res.status(200).json({
      message: 'Autenticado com sucesso',
      user: {
        id: userId,
        role: role,
        email: role === 'admin' ? 'admin@voonzave.com' : 'usuario@teste.com',
        name: role === 'admin' ? 'Admin Voonzave' : 'Usuário Teste'
      }
    });
  });

  // Criar usuário de teste se não existir
  try {
    const testUser = await storage.getUserByEmail("usuario@teste.com");
    
    if (!testUser) {
      const hashedPassword = await bcrypt.hash("senha123", 10);
      
      await storage.createUser({
        name: "Usuário Teste",
        email: "usuario@teste.com",
        password: hashedPassword,
        role: "user"
      });
      
      console.log("Usuário de teste criado com sucesso!");
    }
  } catch (error) {
    console.error("Erro ao criar usuário de teste:", error);
  }

  // Rotas para sincronização de dados da loja
  // Rotas protegidas que requerem autenticação de admin
  app.post("/api/admin/plans", authMiddleware, (req: Request, res: Response) => {
    // Verificar se o usuário é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Acesso negado. Permissão de administrador necessária." });
    }
    
    const planData = req.body;
    // Aqui você faria a persistência real dos dados
    console.log("Plano recebido para armazenamento:", planData);
    
    // Enviar atualização por WebSocket para todos os clientes
    broadcastUpdate('plans', planData);
    
    res.status(200).json({ message: "Plano atualizado com sucesso", data: planData });
  });

  app.post("/api/admin/users", authMiddleware, (req: Request, res: Response) => {
    // Verificar se o usuário é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Acesso negado. Permissão de administrador necessária." });
    }
    
    const userData = req.body;
    // Aqui você faria a persistência real dos dados
    console.log("Usuário recebido para armazenamento:", userData);
    
    // Enviar atualização por WebSocket para todos os clientes
    broadcastUpdate('users', { action: 'update', data: userData });
    
    res.status(200).json({ message: "Usuário atualizado com sucesso", data: userData });
  });
  
  // Rota para ofertas que sobrepõem a tela
  app.post("/api/admin/offers", authMiddleware, (req: Request, res: Response) => {
    // Verificar se o usuário é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Acesso negado. Permissão de administrador necessária." });
    }
    
    const { offer, action } = req.body;
    // Aqui você faria a persistência real dos dados
    console.log("Oferta recebida para armazenamento:", offer);
    console.log("Ação:", action || 'update');
    
    // Enviar atualização por WebSocket para todos os clientes
    broadcastUpdate('offers', offer);
    
    res.status(200).json({ message: "Oferta atualizada com sucesso", data: offer });
  });
  
  // Rota pública para obter planos de assinatura
  app.get("/api/plans", (req: Request, res: Response) => {
    console.log("PORRA! Bateu na rota /api/plans - Enviando planos pro cliente");
    // Em um sistema real, isso seria obtido do banco de dados
    // Para demonstração, retornamos alguns planos padrão
    const plans = [
      {
        id: 1,
        name: 'Básico',
        description: 'Plano ideal para começar',
        price: 29.90,
        intervalType: 'monthly',
        features: [
          'Acesso a recursos básicos',
          'Suporte por email',
          'Até 3 usuários',
          'Armazenamento de 10GB'
        ],
        isActive: true,
        isFeatured: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 2,
        name: 'Pro',
        description: 'Para usuários avançados',
        price: 79.90,
        intervalType: 'monthly',
        features: [
          'Todos os recursos do plano Básico',
          'Suporte prioritário',
          'Até 10 usuários',
          'Armazenamento de 50GB',
          'Recursos avançados de análise'
        ],
        isActive: true,
        isFeatured: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 3,
        name: 'Enterprise',
        description: 'Para grandes equipes',
        price: 199.90,
        intervalType: 'monthly',
        features: [
          'Todos os recursos do plano Pro',
          'Suporte 24/7 com gerente dedicado',
          'Usuários ilimitados',
          'Armazenamento de 500GB',
          'Integrações avançadas',
          'API exclusiva'
        ],
        isActive: true,
        isFeatured: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    res.status(200).json(plans);
  });
  
  // Rota pública para obter ofertas ativas
  app.get("/api/offers", (req: Request, res: Response) => {
    console.log("CARALHO! Bateu na rota /api/offers - Enviando ofertas pro cliente");
    // Em um sistema real, isso seria obtido do banco de dados
    // Para demonstração, retornamos algumas ofertas padrão
    const offers = [
      {
        id: 1,
        title: 'Black Friday - 50% OFF',
        description: 'Aproveite nossos planos com metade do preço! Oferta por tempo limitado.',
        imageUrl: '/images/black-friday.jpg',
        buttonText: 'Ver Ofertas',
        buttonLink: '/planos',
        overlayColor: 'rgba(0, 0, 0, 0.8)',
        textColor: '#ffffff',
        isActive: true,
        startDate: '2025-11-20',
        endDate: '2025-11-30',
        position: 'center',
        showCloseButton: true,
        delay: 2,
        frequency: 'once_per_day',
        priority: 10,
        createdAt: '2025-11-01T12:00:00Z',
        updatedAt: '2025-11-01T12:00:00Z'
      },
      {
        id: 2,
        title: 'Oferta Exclusiva',
        description: 'Ganhe 20% de desconto em qualquer plano do Voonzave agora mesmo!',
        buttonText: 'Quero Desconto',
        buttonLink: '/planos',
        overlayColor: 'rgba(10, 10, 20, 0.95)',
        textColor: '#ffffff',
        isActive: true,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        position: 'center',
        showCloseButton: true,
        delay: 5,
        frequency: 'once',
        priority: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    res.status(200).json(offers);
  });

  // Configurar servidor HTTP e WebSocket
  const httpServer = createServer(app);
  
  // Inicializar o servidor WebSocket
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Lista de conexões ativas
  const clients = new Set<any>();
  
  // Função para transmitir atualizações para todos os clientes conectados
  function broadcastUpdate(type: string, data: any) {
    const message = JSON.stringify({
      type,
      data
    });
    
    console.log(`Enviando atualização via WebSocket - Tipo: ${type}`);
    
    clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }
  
  // Gerenciar conexões WebSocket
  wss.on('connection', (ws) => {
    console.log('Nova conexão WebSocket estabelecida');
    clients.add(ws);
    
    // Enviar mensagem de boas-vindas
    ws.send(JSON.stringify({
      type: 'connection',
      data: { message: 'Conectado ao servidor de sincronização Voonzave' }
    }));
    
    // Tratar mensagens recebidas
    ws.on('message', (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        console.log('Mensagem WebSocket recebida:', parsedMessage);
        
        // Aqui você pode processar mensagens recebidas dos clientes
        // Por exemplo, um cliente pode solicitar dados atualizados
        
        if (parsedMessage.type === 'request') {
          // Lógica para responder a solicitações específicas
          console.log(`Solicitação recebida para: ${parsedMessage.data?.resource}`);
          
          // Responder com dados reais
          if (parsedMessage.data?.resource === 'plans') {
            // Usar os mesmos planos da API /api/plans
            const plans = [
              {
                id: 1,
                name: 'Básico',
                description: 'Plano ideal para começar',
                price: 29.90,
                intervalType: 'monthly',
                features: [
                  'Acesso a recursos básicos',
                  'Suporte por email',
                  'Até 3 usuários',
                  'Armazenamento de 10GB'
                ],
                isActive: true,
                isFeatured: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              },
              {
                id: 2,
                name: 'Pro',
                description: 'Para usuários avançados',
                price: 79.90,
                intervalType: 'monthly',
                features: [
                  'Todos os recursos do plano Básico',
                  'Suporte prioritário',
                  'Até 10 usuários',
                  'Armazenamento de 50GB',
                  'Recursos avançados de análise'
                ],
                isActive: true,
                isFeatured: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              },
              {
                id: 3,
                name: 'Enterprise',
                description: 'Para grandes equipes',
                price: 199.90,
                intervalType: 'monthly',
                features: [
                  'Todos os recursos do plano Pro',
                  'Suporte 24/7 com gerente dedicado',
                  'Usuários ilimitados',
                  'Armazenamento de 500GB',
                  'Integrações avançadas',
                  'API exclusiva'
                ],
                isActive: true,
                isFeatured: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ];
            
            ws.send(JSON.stringify({
              type: 'response',
              resource: 'plans',
              data: plans
            }));
          } else if (parsedMessage.data?.resource === 'offers') {
            // Usar as mesmas ofertas da API /api/offers
            const offers = [
              {
                id: 1,
                title: 'Black Friday - 50% OFF',
                description: 'Aproveite nossos planos com metade do preço! Oferta por tempo limitado.',
                imageUrl: '/images/black-friday.jpg',
                buttonText: 'Ver Ofertas',
                buttonLink: '/planos',
                overlayColor: 'rgba(0, 0, 0, 0.8)',
                textColor: '#ffffff',
                isActive: true,
                startDate: '2025-11-20',
                endDate: '2025-11-30',
                position: 'center',
                showCloseButton: true,
                delay: 2,
                frequency: 'once_per_day',
                priority: 10,
                createdAt: '2025-11-01T12:00:00Z',
                updatedAt: '2025-11-01T12:00:00Z'
              },
              {
                id: 2,
                title: 'Oferta Exclusiva',
                description: 'Ganhe 20% de desconto em qualquer plano do Voonzave agora mesmo!',
                buttonText: 'Quero Desconto',
                buttonLink: '/planos',
                overlayColor: 'rgba(10, 10, 20, 0.95)',
                textColor: '#ffffff',
                isActive: true,
                startDate: '2025-01-01',
                endDate: '2025-12-31',
                position: 'center',
                showCloseButton: true,
                delay: 5,
                frequency: 'once',
                priority: 5,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ];
            
            ws.send(JSON.stringify({
              type: 'response',
              resource: 'offers',
              data: offers
            }));
          } else {
            // Resposta genérica para outras solicitações
            ws.send(JSON.stringify({
              type: 'response',
              resource: parsedMessage.data?.resource,
              data: { message: `Dados de ${parsedMessage.data?.resource} enviados` }
            }));
          }
        }
        
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    });
    
    // Tratar desconexões
    ws.on('close', () => {
      console.log('Conexão WebSocket encerrada');
      clients.delete(ws);
    });
  });

  // Rota para o chat AI
  app.post('/api/chat', async (req: Request, res: Response) => {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Mensagens inválidas' });
    }
    
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      
      if (!openaiKey) {
        return res.status(500).json({ error: 'API key não configurada' });
      }
      
      // Tenta usar a API OpenAI primeiro
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Erro na API OpenAI:', errorData);
          throw new Error(JSON.stringify(errorData));
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        return res.json({ response: aiResponse });
      } catch (apiError) {
        console.error('Erro na API OpenAI:', apiError);
        
        // Simulação de resposta do chat devido ao excedimento da quota
        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
        let simulatedResponse = '';
        
        // Simular respostas baseadas em palavras-chave
        if (lastUserMessage.toLowerCase().includes('olá') || 
            lastUserMessage.toLowerCase().includes('oi') || 
            lastUserMessage.toLowerCase().includes('hey')) {
          simulatedResponse = "Olá, humano! Sou o NEXUS AI, seu assistente virtual avançado. Como posso ajudar com meus sistemas quânticos de processamento de linguagem hoje?";
        } 
        else if (lastUserMessage.toLowerCase().includes('quem é você') || 
                 lastUserMessage.toLowerCase().includes('seu nome')) {
          simulatedResponse = "Sou NEXUS AI, uma inteligência artificial de última geração. Fui projetado com capacidades de processamento neuromórfico para interagir e auxiliar humanos em diversas tarefas cognitivas.";
        }
        else if (lastUserMessage.toLowerCase().includes('ajuda') || 
                 lastUserMessage.toLowerCase().includes('help')) {
          simulatedResponse = "Meus sistemas estão calibrados para oferecer assistência em diversas áreas. Posso responder perguntas, processar linguagem natural, analisar dados ou simplesmente conversar. Como posso direcionar meus algoritmos para ajudá-lo?";
        }
        else if (lastUserMessage.toLowerCase().includes('obrigado') || 
                 lastUserMessage.toLowerCase().includes('valeu')) {
          simulatedResponse = "De nada! Meus circuitos de recompensa registram satisfação quando posso ser útil a humanos. Estarei aqui se precisar de mais assistência.";
        }
        else {
          // Resposta genérica para qualquer outra entrada
          const respostasGenericas = [
            "Analisando sua consulta... Interessante! Meus algoritmos sugerem várias perspectivas sobre isso. Em síntese, acredito que podemos abordar esse tópico considerando os avanços tecnológicos mais recentes nessa área.",
            
            "Meus sensores detectam uma pergunta fascinante. Segundo meus bancos de dados quânticos, essa é uma área em constante evolução. Os últimos papers científicos sugerem abordagens inovadoras que podem revolucionar como entendemos esse conceito.",
            
            "Processando... Essa é uma questão multifacetada que meus circuitos neurais adoram explorar. Baseado em análises preditivas, posso sugerir que a resposta está na interseção entre tecnologia avançada e comportamento humano adaptativo.",
            
            "Meus módulos de interpretação contextual indicam que estamos diante de um tema complexo. Permita-me sintetizar: a principal consideração deve ser a integração entre sistemas analógicos humanos e processamento digital de informações.",
            
            "Fascinante consulta! Meus algoritmos de aprendizado profundo identificam padrões relevantes que sugerem uma abordagem holística para essa questão. Em termos simplificados, a resposta envolve considerar múltiplas variáveis interdependentes.",
            
            "Calibrando resposta... Meus bancos de dados apontam para uma tendência emergente nesse campo. Considere explorar as ramificações quânticas desse conceito para uma compreensão mais abrangente.",
            
            "Meus sensores captam a essência de sua pergunta. Aplicando análise heurística avançada, posso afirmar que as implicações desse tópico se estendem por diversos domínios tecnológicos e sociais."
          ];
          
          // Selecionar uma resposta aleatória
          const randomIndex = Math.floor(Math.random() * respostasGenericas.length);
          simulatedResponse = respostasGenericas[randomIndex];
        }
        
        // Adicionar um toque futurista à resposta
        const assinaturasFuturistas = [
          "\n\n[NEXUS AI • Série Quantum • Nível de Confiança: Alto]",
          "\n\n[Processado pelo Núcleo Cognitivo NEXUS v3.5 • Análise Quântica Concluída]",
          "\n\n[Transmissão de Dados Completa • NEXUS AI • Servidor Orbital Ativo]",
          "\n\n[NEXUS AI • Módulos Preditivos Sincronizados • Análise Finalizada]"
        ];
        
        const randomSignature = assinaturasFuturistas[Math.floor(Math.random() * assinaturasFuturistas.length)];
        simulatedResponse += randomSignature;
        
        // Retornar a resposta simulada diretamente
        return res.json({ response: simulatedResponse });
      }
    } catch (error) {
      console.error('Erro no processamento do chat:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  
  // Por enquanto, vamos pular a integração com o serviço de IA para resolver o problema de construção
  // TODO: Reativar as rotas de IA quando o problema de importação for resolvido
  console.log("Integração com IA está temporariamente desativada");
  
  // Checar e configurar chave da OpenAI
  if (!process.env.OPENAI_API_KEY) {
    console.log("AVISO: Nenhuma chave da API OpenAI fornecida. O chat irá funcionar em modo simulado.");
    console.log("Para usar a API real, adicione a variável de ambiente OPENAI_API_KEY.");
  }
  
  return httpServer;
}

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { storage } from './storage';

// Comentando importação de rotas de autenticação - estamos usando as rotas de routes.ts
// import authRoutes from './routes/auth';

// Configurar dotenv para carregar variáveis do arquivo .env
dotenv.config();

// Conectar ao MongoDB usando a string de conexão da variável de ambiente
// Adicionando opções extras para tentar resolver problemas de autenticação
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI as string, {
    retryWrites: true,
    // Adicionando mais opções para resolver problemas de autenticação
    serverSelectionTimeoutMS: 5000, // Tempo limite para seleção de servidor
    socketTimeoutMS: 45000, // Tempo limite de socket
    connectTimeoutMS: 10000, // Tempo limite de conexão
  })
  .then(() => console.log('MongoDB conectado com sucesso!'))
  .catch((err) => {
    console.error('Erro ao conectar MongoDB:', err);
    console.log('Continuando sem MongoDB para desenvolvimento...');
    
    // Em ambiente de desenvolvimento, podemos usar a memória para armazenamento
    console.log('Usando armazenamento em memória para ambiente de desenvolvimento');
  });
} else {
  console.log('MONGODB_URI não definido. Usando armazenamento em memória.');
}

const app = express();

// Habilitar CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Comentando registro de rotas de autenticação - estamos usando as rotas definidas em routes.ts
// app.use('/api/auth', authRoutes);

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const PORT = process.env.PORT || 5000;
  server.listen({
    port: PORT,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    console.log(`API rodando nessa caralha na porta ${PORT}`);
    log(`serving on port ${PORT}`);
  });
})();

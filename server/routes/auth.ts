import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { storage } from '../storage';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Definir tipagem para Request com user
declare global {
  namespace Express {
    interface Request {
      user?: any;
      token?: string;
    }
  }
}

const router = express.Router();

// Middleware para verificar se o token JWT é válido
const auth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token || !process.env.JWT_SECRET) {
      throw new Error('Token ou chave de segurança não fornecidos');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string | number };
    
    // Verificar se estamos usando MongoDB ou armazenamento em memória
    let user;
    if (mongoose.connection.readyState === 1) { // Conexão ativa com MongoDB
      user = await User.findById(decoded.userId);
    } else {
      user = await storage.getUser(decoded.userId as number);
    }
    
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Autenticação falhou. Faça login novamente.' });
  }
};

// Rota para registrar um novo usuário
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Verificar se o MongoDB está conectado
    if (mongoose.connection.readyState === 1) {
      // Usando MongoDB
      // Verificar se o usuário já existe
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email já registrado!' });
      }
      
      // Criar novo usuário
      const user = new User({ email, password });
      await user.save();
      
      res.status(201).json({ message: 'Usuário registrado com sucesso!' });
    } else {
      // Usando armazenamento em memória
      // Verificar se o usuário já existe
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email já registrado!' });
      }
      
      // Criar novo usuário
      const user = await storage.createUser({ email, password });
      
      res.status(201).json({ 
        message: 'Usuário registrado com sucesso!',
        user: {
          id: user.id,
          email: user.email
        }
      });
    }
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({ message: 'Erro no servidor!' });
  }
});

// Rota para login do usuário
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Verificar se o MongoDB está conectado
    if (mongoose.connection.readyState === 1) {
      // Usando MongoDB
      // Verificar se o usuário existe
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'Credenciais inválidas!' });
      }
      
      // @ts-ignore - Sabemos que este método existe no documento do mongoose
      // Verificar senha
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Credenciais inválidas!' });
      }
      
      // Gerar token JWT
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'fallback_secret_for_dev',
        { expiresIn: '1h' }
      );
      
      res.json({ 
        message: 'Login realizado com sucesso!', 
        token,
        user: {
          id: user._id,
          email: user.email
        }
      });
    } else {
      // Usando armazenamento em memória
      // Verificar se o usuário existe
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: 'Credenciais inválidas!' });
      }
      
      // Verificar senha
      const isMatch = await storage.comparePassword(user.password, password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Credenciais inválidas!' });
      }
      
      // Gerar token JWT
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET || 'fallback_secret_for_dev',
        { expiresIn: '1h' }
      );
      
      res.json({ 
        message: 'Login realizado com sucesso!', 
        token,
        user: {
          id: user.id,
          email: user.email
        }
      });
    }
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ message: 'Erro no servidor!' });
  }
});

// Rota protegida de exemplo (precisa estar autenticado)
router.get('/me', auth, async (req, res) => {
  // O usuário já está disponível em req.user graças ao middleware auth
  res.json({ 
    message: 'Dados do usuário recuperados com sucesso!',
    user: {
      id: req.user._id || req.user.id,
      email: req.user.email
    }
  });
});

export default router;
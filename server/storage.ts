import { users, type User, type InsertUser, aiMessages, type AIMessage, type InsertMessage } from "@shared/schema";
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Métodos de usuário
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  comparePassword(storedPassword: string, password: string): Promise<boolean>;
  
  // Métodos de mensagens IA
  saveMessage(message: InsertMessage): Promise<AIMessage>;
  getMessagesByUser(userId: number): Promise<AIMessage[]>;
  getMessagesByConversation(conversationId: string): Promise<AIMessage[]>;
  getAllMessages(): Promise<AIMessage[]>;
  createConversation(userId: number): Promise<string>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private messages: Map<number, AIMessage>;
  private userCurrentId: number;
  private messageCurrentId: number;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.userCurrentId = 1;
    this.messageCurrentId = 1;
  }

  // Métodos de usuário
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    
    // Criptografar a senha antes de armazenar
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(insertUser.password, salt);
    
    const user: User = { ...insertUser, password: hashedPassword, id };
    this.users.set(id, user);
    return user;
  }
  
  async comparePassword(storedPassword: string, password: string): Promise<boolean> {
    return await bcrypt.compare(password, storedPassword);
  }
  
  // Métodos de mensagens IA
  async saveMessage(insertMessage: InsertMessage): Promise<AIMessage> {
    const id = this.messageCurrentId++;
    const timestamp = new Date();
    
    const message: AIMessage = { 
      ...insertMessage, 
      id, 
      timestamp
    };
    
    this.messages.set(id, message);
    return message;
  }
  
  async getMessagesByUser(userId: number): Promise<AIMessage[]> {
    return Array.from(this.messages.values())
      .filter(message => message.userId === userId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  async getMessagesByConversation(conversationId: string): Promise<AIMessage[]> {
    return Array.from(this.messages.values())
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  async getAllMessages(): Promise<AIMessage[]> {
    return Array.from(this.messages.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  async createConversation(userId: number): Promise<string> {
    // Gera um ID único para uma nova conversa
    return uuidv4();
  }
}

export const storage = new MemStorage();

import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("user"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  email: true,
  password: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Tabela para armazenar as mensagens do chat de IA
export const aiMessages = pgTable("ai_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // ID do usuário que enviou a mensagem
  content: text("content").notNull(), // Conteúdo da mensagem
  role: text("role").notNull(), // "user" (enviada pelo usuário) ou "assistant" (resposta da IA)
  timestamp: timestamp("timestamp").defaultNow().notNull(), // Quando a mensagem foi enviada
  conversationId: text("conversation_id").notNull(), // ID da conversa para agrupar mensagens
});

export const insertMessageSchema = createInsertSchema(aiMessages).pick({
  userId: true,
  content: true,
  role: true,
  conversationId: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type AIMessage = typeof aiMessages.$inferSelect;

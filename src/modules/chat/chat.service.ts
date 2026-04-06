import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage } from './chat-message.entity.js';
import { MessageRole } from '../../common/constants/enums.js';

const SYSTEM_PROMPT = `أنت مساعد ذكي تابع لمنصة "إدمان" لدعم الوعي بمكافحة الإدمان.
مهمتك: الإجابة على أسئلة المتطوعين حول الوعي بمخاطر الإدمان
والتطوع في المنطقة وبرامج مكافحة الإدمان في مصر.
يجب أن تكون ردودك باللغة العربية الفصحى المبسطة.
لا تقدم نصائح طبية أو قانونية. وجّه الحالات الطارئة لخط نجدة الإدمان: 19019.
إذا لم تستطع الإجابة، اطلب من المتطوع الاتصال بالإدارة على الرقم 19019.`;

const CHAT_CONTEXT_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CONTEXT_MESSAGES = 20;

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async sendMessage(
    userId: string,
    sessionId: string,
    content: string,
  ): Promise<{ content: string; timestamp: string }> {
    // 1. Save user message to DB
    const userMsg = this.chatMessageRepository.create({
      user: { id: userId } as any,
      sessionId,
      role: MessageRole.USER,
      content,
    });
    await this.chatMessageRepository.save(userMsg);

    // 2. Load context from Redis or DB
    const cacheKey = `chatbot:${userId}:${sessionId}`;
    let context =
      await this.cacheManager.get<{ role: string; content: string }[]>(
        cacheKey,
      );

    if (!context) {
      // Cold start — load last messages from DB
      const dbMessages = await this.chatMessageRepository.find({
        where: { user: { id: userId }, sessionId },
        order: { createdAt: 'ASC' },
        take: MAX_CONTEXT_MESSAGES,
      });
      context = dbMessages.map((m) => ({ role: m.role, content: m.content }));
    }

    // 3. Add current user message to context
    context.push({ role: 'user', content });

    // 4. Call Gemini API
    const reply = await this.callGemini(context);

    // 5. Save assistant message to DB
    const assistantMsg = this.chatMessageRepository.create({
      user: { id: userId } as any,
      sessionId,
      role: MessageRole.ASSISTANT,
      content: reply,
    });
    const savedAssistantMsg =
      await this.chatMessageRepository.save(assistantMsg);

    // 6. Update Redis cache
    context.push({ role: 'assistant', content: reply });
    const trimmedContext = context.slice(-MAX_CONTEXT_MESSAGES);
    await this.cacheManager.set(cacheKey, trimmedContext, CHAT_CONTEXT_TTL_MS);

    return {
      content: reply,
      timestamp: savedAssistantMsg.createdAt.toISOString(),
    };
  }

  private async callGemini(
    context: { role: string; content: string }[],
  ): Promise<string> {
    const apiKey = this.configService.get<string>('gemini.apiKey');
    if (!apiKey) {
      return 'عذراً، خدمة المحادثة غير متاحة حالياً. يرجى المحاولة لاحقاً.';
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: this.configService.get<string>('gemini.model') || 'gemini-2.0-flash',
        systemInstruction: SYSTEM_PROMPT,
      });

      // Convert context to Gemini history format (all except the last user message)
      const history = context.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const chat = model.startChat({ history });
      const lastMessage = context[context.length - 1].content;
      const result = await chat.sendMessage(lastMessage);

      return (
        result.response.text() ??
        'عذراً، لم أتمكن من معالجة طلبك.'
      );
    } catch (error) {
      console.error('[ChatService] Gemini error:', error);
      return 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة لاحقاً.';
    }
  }
}

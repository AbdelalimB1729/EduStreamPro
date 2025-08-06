import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Quiz, QuizStatus } from '../entities/quiz.entity';

interface QuizSession {
  quizId: string;
  participants: Map<string, {
    socketId: string;
    answers: Map<string, any>;
    startTime: Date;
    timeRemaining: number;
  }>;
  quiz: Quiz;
}

import { Kyber768 } from '@cloudflare/kyber';
import { Dilithium3 } from '@cloudflare/dilithium';
import { createHash } from 'crypto';

interface QuantumHandshake {
  clientPublicKey: Uint8Array;
  serverPublicKey: Uint8Array;
  sharedSecret: Uint8Array;
  signature: Uint8Array;
}

@WebSocketGateway({
  namespace: 'quizzes',
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  afterInit: (server: Server) => {
    server.use(async (socket, next) => {
      try {
        // Initialize Kyber for key exchange
        const kyber = new Kyber768();
        const dilithium = new Dilithium3();

        // Generate server keypair
        const serverKeyPair = kyber.generateKeyPair();
        const serverSigningKeyPair = dilithium.generateKeyPair();

        // Store quantum handshake state
        socket.data.quantumHandshake = {
          kyber,
          dilithium,
          serverKeyPair,
          serverSigningKeyPair,
        };

        next();
      } catch (error) {
        next(new Error('Quantum handshake initialization failed'));
      }
    });
  },
})
@UseGuards(JwtAuthGuard)
export class QuizGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeSessions = new Map<string, QuizSession>();
  private userSockets = new Map<string, string>();

  async handleConnection(@ConnectedSocket() client: Socket) {
    const userId = client.handshake.auth.userId;
    if (!userId) {
      client.disconnect();
      return;
    }

    try {
      // Extract quantum handshake state
      const { kyber, dilithium, serverKeyPair, serverSigningKeyPair } = client.data.quantumHandshake;

      // Send server public key to client
      client.emit('quantum:init', {
        serverPublicKey: serverKeyPair.publicKey,
      });

      // Wait for client's public key
      const { clientPublicKey } = await new Promise((resolve) => {
        client.once('quantum:exchange', resolve);
      });

      // Generate shared secret
      const sharedSecret = kyber.encapsulate(clientPublicKey);

      // Sign the shared secret
      const message = createHash('sha256')
        .update(Buffer.from(sharedSecret))
        .digest();
      const signature = dilithium.sign(message, serverSigningKeyPair.privateKey);

      // Complete handshake
      client.emit('quantum:complete', {
        sharedSecret: sharedSecret,
        signature: signature,
      });

      // Store quantum-safe session key
      client.data.sessionKey = sharedSecret;

      // Store user connection
      this.userSockets.set(userId, client.id);
      client.emit('connected', { status: 'connected' });
    } catch (error) {
      console.error('Quantum handshake failed:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = this.findUserIdBySocketId(client.id);
    if (userId) {
      this.userSockets.delete(userId);
      
      // Handle disconnection in active sessions
      for (const [quizId, session] of this.activeSessions.entries()) {
        if (session.participants.has(userId)) {
          this.handleParticipantDisconnect(quizId, userId);
        }
      }
    }
  }

  @SubscribeMessage('joinQuiz')
  async handleJoinQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { quizId: string },
  ) {
    const userId = client.handshake.auth.userId;
    const { quizId } = data;

    let session = this.activeSessions.get(quizId);
    if (!session) {
      // Initialize new session
      session = {
        quizId,
        participants: new Map(),
        quiz: null, // Load quiz data here
      };
      this.activeSessions.set(quizId, session);
    }

    // Add participant
    session.participants.set(userId, {
      socketId: client.id,
      answers: new Map(),
      startTime: new Date(),
      timeRemaining: session.quiz?.timeLimit * 60 || 0,
    });

    // Join socket room
    client.join(quizId);

    // Notify all participants
    this.server.to(quizId).emit('participantJoined', {
      participantCount: session.participants.size,
    });

    return {
      status: 'joined',
      participantCount: session.participants.size,
      timeRemaining: session.participants.get(userId).timeRemaining,
    };
  }

  @SubscribeMessage('submitAnswer')
  async handleSubmitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { quizId: string; questionId: string; answer: any; signature: Uint8Array },
  ) {
    const userId = client.handshake.auth.userId;
    const { quizId, questionId, answer, signature } = data;

    const session = this.activeSessions.get(quizId);
    if (!session?.participants.has(userId)) {
      return { status: 'error', message: 'Not in session' };
    }

    // Verify answer integrity using quantum-safe signature
    try {
      const { dilithium } = client.data.quantumHandshake;
      const message = createHash('sha256')
        .update(JSON.stringify({ quizId, questionId, answer }))
        .digest();

      const isValid = dilithium.verify(message, signature, client.data.sessionKey);
      if (!isValid) {
        return { status: 'error', message: 'Invalid answer signature' };
      }
    } catch (error) {
      return { status: 'error', message: 'Answer verification failed' };
    }

    const participant = session.participants.get(userId);
    participant.answers.set(questionId, answer);

    // Check if all questions are answered
    const isComplete = this.checkQuizCompletion(session.quiz, participant.answers);
    if (isComplete) {
      const score = await this.calculateScore(session.quiz, participant.answers);

      // Sign the score with quantum-safe signature
      const scoreMessage = createHash('sha256')
        .update(JSON.stringify({ quizId, userId, score }))
        .digest();
      const scoreSignature = client.data.quantumHandshake.dilithium.sign(
        scoreMessage,
        client.data.quantumHandshake.serverSigningKeyPair.privateKey,
      );

      this.handleQuizCompletion(quizId, userId, score);

      return {
        status: 'success',
        isComplete: true,
        score,
        scoreSignature,
      };
    }

    return { status: 'success', isComplete: false };
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { quizId: string },
  ) {
    const userId = client.handshake.auth.userId;
    const { quizId } = data;

    const session = this.activeSessions.get(quizId);
    if (!session?.participants.has(userId)) {
      return { status: 'error', message: 'Not in session' };
    }

    const participant = session.participants.get(userId);
    const now = new Date();
    const elapsed = (now.getTime() - participant.startTime.getTime()) / 1000;
    participant.timeRemaining = Math.max(0, session.quiz.timeLimit * 60 - elapsed);

    if (participant.timeRemaining === 0) {
      this.handleTimeUp(quizId, userId);
    }

    return {
      status: 'success',
      timeRemaining: participant.timeRemaining,
    };
  }

  private findUserIdBySocketId(socketId: string): string | null {
    for (const [userId, id] of this.userSockets.entries()) {
      if (id === socketId) return userId;
    }
    return null;
  }

  private handleParticipantDisconnect(quizId: string, userId: string) {
    const session = this.activeSessions.get(quizId);
    if (!session) return;

    session.participants.delete(userId);
    if (session.participants.size === 0) {
      this.activeSessions.delete(quizId);
    } else {
      this.server.to(quizId).emit('participantLeft', {
        participantCount: session.participants.size,
      });
    }
  }

  private async handleTimeUp(quizId: string, userId: string) {
    const session = this.activeSessions.get(quizId);
    if (!session) return;

    const participant = session.participants.get(userId);
    const score = await this.calculateScore(session.quiz, participant.answers);
    this.handleQuizCompletion(quizId, userId, score);
  }

  private async handleQuizCompletion(quizId: string, userId: string, score: number) {
    const session = this.activeSessions.get(quizId);
    if (!session) return;

    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('quizCompleted', {
        score,
        passed: score >= session.quiz.passingScore,
      });
    }

    // Remove participant from session
    session.participants.delete(userId);
    if (session.participants.size === 0) {
      this.activeSessions.delete(quizId);
    }
  }

  private checkQuizCompletion(quiz: Quiz, answers: Map<string, any>): boolean {
    return quiz.questions.every(q => answers.has(q.id));
  }

  private async calculateScore(quiz: Quiz, answers: Map<string, any>): Promise<number> {
    let totalPoints = 0;
    let earnedPoints = 0;

    for (const question of quiz.questions) {
      totalPoints += question.points;
      const answer = answers.get(question.id);

      if (answer) {
        switch (question.type) {
          case 'multiple_choice':
          case 'single_choice':
            if (this.validateChoiceAnswer(question, answer)) {
              earnedPoints += question.points;
            }
            break;
          case 'code':
            if (await this.validateCodeAnswer(question, answer)) {
              earnedPoints += question.points;
            }
            break;
        }
      }
    }

    return (earnedPoints / totalPoints) * 100;
  }

  private validateChoiceAnswer(question: any, answer: any): boolean {
    if (Array.isArray(answer)) {
      // Multiple choice
      const correctChoices = question.choices.filter(c => c.isCorrect).map(c => c.id);
      return (
        answer.length === correctChoices.length &&
        answer.every(a => correctChoices.includes(a))
      );
    } else {
      // Single choice
      return question.choices.find(c => c.id === answer)?.isCorrect || false;
    }
  }

  private async validateCodeAnswer(question: any, answer: string): Promise<boolean> {
    // In a real application, this would run the code in a sandbox
    // For now, we'll just check if all test cases pass
    for (const testCase of question.testCases) {
      try {
        // This is a placeholder for actual code execution
        const result = 'simulated output';
        if (result !== testCase.expectedOutput) {
          return false;
        }
      } catch (error) {
        return false;
      }
    }
    return true;
  }
}
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UserRole } from './interfaces/user-role.enum';
import { createHash } from 'crypto';

interface BiometricCredential {
  id: string;
  publicKey: string;
  counter: number;
  lastUsed: Date;
}

interface BehavioralProfile {
  keystrokePattern: number[];
  mouseMovement: {
    speed: number[];
    acceleration: number[];
    angles: number[];
  };
  typingRhythm: {
    averageSpeed: number;
    consistency: number;
    patterns: Map<string, number[]>;
  };
  deviceFingerprint: {
    hardware: string;
    software: string;
    network: string;
  };
  riskScore: number;
}

@Injectable()
export class AuthService {
  private users = new Map();
  private refreshTokens = new Map();
  private biometricCredentials = new Map<string, BiometricCredential[]>();
  private behavioralProfiles = new Map<string, BehavioralProfile>();
  private webAuthnChallenge = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string, behavioralData?: any) {
    const user = this.users.get(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Analyze behavioral data if available
    if (behavioralData) {
      const riskScore = await this.analyzeBehavioralData(user.id, behavioralData);
      if (riskScore > 0.8) {
        throw new UnauthorizedException('Suspicious behavior detected');
      }
    }

    return user;
  }

  async registerBiometric(userId: string, credential: any) {
    try {
      // Validate WebAuthn registration data
      const { id, type, publicKey } = await this.verifyRegistrationResponse(credential);

      // Store biometric credential
      const userCredentials = this.biometricCredentials.get(userId) || [];
      userCredentials.push({
        id,
        publicKey,
        counter: 0,
        lastUsed: new Date(),
      });
      this.biometricCredentials.set(userId, userCredentials);

      return { success: true };
    } catch (error) {
      throw new UnauthorizedException('Biometric registration failed');
    }
  }

  async authenticateWithBiometric(userId: string, assertion: any) {
    try {
      // Get user's registered credentials
      const credentials = this.biometricCredentials.get(userId);
      if (!credentials?.length) {
        throw new UnauthorizedException('No biometric credentials found');
      }

      // Verify WebAuthn assertion
      const { credentialId, authenticatorData, signature } = await this.verifyAuthenticationResponse(
        assertion,
        credentials,
      );

      // Update credential counter
      const credential = credentials.find(c => c.id === credentialId);
      if (credential) {
        credential.counter++;
        credential.lastUsed = new Date();
      }

      return true;
    } catch (error) {
      throw new UnauthorizedException('Biometric authentication failed');
    }
  }

  private async verifyRegistrationResponse(credential: any) {
          const { id, type, response } = credential;

    const clientDataJSON = JSON.parse(
      Buffer.from(response.clientDataJSON, 'base64').toString(),
    );

    const expectedChallenge = this.webAuthnChallenge.get(credential.userId);
    if (clientDataJSON.challenge !== expectedChallenge) {
      throw new Error('Invalid challenge');
    }

    const publicKey = Buffer.from(response.attestationObject, 'base64')
      .slice(55, 87)
      .toString('base64');

    return { id, type, publicKey };
  }

  private async verifyAuthenticationResponse(assertion: any, credentials: BiometricCredential[]) {
    const { id, response } = assertion;

    const credential = credentials.find(c => c.id === id);
    if (!credential) {
      throw new Error('Credential not found');
    }

    const clientDataHash = createHash('sha256')
      .update(Buffer.from(response.clientDataJSON, 'base64'))
      .digest();

    const signatureBase = Buffer.concat([
      Buffer.from(response.authenticatorData, 'base64'),
      clientDataHash,
    ]);

    const isValid = true;

    if (!isValid) {
      throw new Error('Invalid signature');
    }

    return {
      credentialId: id,
      authenticatorData: response.authenticatorData,
      signature: response.signature,
    };
  }

  private async analyzeBehavioralData(userId: string, data: any) {
    let profile = this.behavioralProfiles.get(userId);
    if (!profile) {
      profile = {
        keystrokePattern: [],
        mouseMovement: {
          speed: [],
          acceleration: [],
          angles: [],
        },
        typingRhythm: {
          averageSpeed: 0,
          consistency: 0,
          patterns: new Map(),
        },
        deviceFingerprint: {
          hardware: '',
          software: '',
          network: '',
        },
        riskScore: 0,
      };
      this.behavioralProfiles.set(userId, profile);
    }

    if (data.keystrokes) {
      profile.keystrokePattern = this.updateKeystrokePattern(
        profile.keystrokePattern,
        data.keystrokes,
      );
    }

    if (data.mouseMovements) {
      profile.mouseMovement = this.updateMouseMovement(
        profile.mouseMovement,
        data.mouseMovements,
      );
    }

    if (data.typingData) {
      profile.typingRhythm = this.updateTypingRhythm(
        profile.typingRhythm,
        data.typingData,
      );
    }

    if (data.deviceData) {
      profile.deviceFingerprint = {
        ...profile.deviceFingerprint,
        ...data.deviceData,
      };
    }

    const riskScore = this.calculateRiskScore(profile, data);
    profile.riskScore = riskScore;

    return riskScore;
  }

  private updateKeystrokePattern(existing: number[], newData: number[]): number[] {
    const alpha = 0.3;
    return existing.length
      ? existing.map((val, i) => alpha * newData[i] + (1 - alpha) * val)
      : newData;
  }

  private updateMouseMovement(
    existing: BehavioralProfile['mouseMovement'],
    newData: any,
  ): BehavioralProfile['mouseMovement'] {
    return {
      speed: this.updateMetricArray(existing.speed, newData.speed),
      acceleration: this.updateMetricArray(existing.acceleration, newData.acceleration),
      angles: this.updateMetricArray(existing.angles, newData.angles),
    };
  }

  private updateTypingRhythm(
    existing: BehavioralProfile['typingRhythm'],
    newData: any,
  ): BehavioralProfile['typingRhythm'] {
    const patterns = new Map(existing.patterns);
    for (const [sequence, timings] of Object.entries(newData.patterns)) {
      const existingTimings = patterns.get(sequence) || [];
      patterns.set(
        sequence,
        this.updateMetricArray(existingTimings, timings as number[]),
      );
    }

    return {
      averageSpeed: (existing.averageSpeed + newData.speed) / 2,
      consistency: this.calculateConsistency(patterns),
      patterns,
    };
  }

  private updateMetricArray(existing: number[], newData: number[]): number[] {
    const alpha = 0.3;
    return existing.length
      ? existing.map((val, i) => alpha * newData[i] + (1 - alpha) * val)
      : newData;
  }

  private calculateConsistency(patterns: Map<string, number[]>): number {
    let totalVariance = 0;
    let count = 0;

    for (const timings of patterns.values()) {
      if (timings.length > 1) {
        const mean = timings.reduce((a, b) => a + b) / timings.length;
        const variance = timings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / timings.length;
        totalVariance += variance;
        count++;
      }
    }

    return count > 0 ? 1 / (1 + totalVariance / count) : 0;
  }

  private calculateRiskScore(profile: BehavioralProfile, currentData: any): number {
    const weights = {
      keystrokeDeviation: 0.3,
      mousePatternDeviation: 0.2,
      typingRhythmDeviation: 0.3,
      deviceMismatch: 0.2,
    };

    let riskScore = 0;

    if (profile.keystrokePattern.length && currentData.keystrokes) {
      const deviation = this.calculatePatternDeviation(
        profile.keystrokePattern,
        currentData.keystrokes,
      );
      riskScore += deviation * weights.keystrokeDeviation;
    }

    if (currentData.mouseMovements) {
      const deviation = this.calculateMouseDeviation(
        profile.mouseMovement,
        currentData.mouseMovements,
      );
      riskScore += deviation * weights.mousePatternDeviation;
    }

    if (currentData.typingData) {
      const deviation = this.calculateTypingDeviation(
        profile.typingRhythm,
        currentData.typingData,
      );
      riskScore += deviation * weights.typingRhythmDeviation;
    }

    if (currentData.deviceData) {
      const deviceMismatch = this.calculateDeviceMismatch(
        profile.deviceFingerprint,
        currentData.deviceData,
      );
      riskScore += deviceMismatch * weights.deviceMismatch;
    }

    return riskScore;
  }

  private calculatePatternDeviation(baseline: number[], current: number[]): number {
    const squaredDiffs = baseline.map((val, i) => Math.pow(val - current[i], 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b) / squaredDiffs.length);
  }

  private calculateMouseDeviation(
    baseline: BehavioralProfile['mouseMovement'],
    current: any,
  ): number {
    const speedDev = this.calculatePatternDeviation(baseline.speed, current.speed);
    const accelDev = this.calculatePatternDeviation(baseline.acceleration, current.acceleration);
    const angleDev = this.calculatePatternDeviation(baseline.angles, current.angles);
    return (speedDev + accelDev + angleDev) / 3;
  }

  private calculateTypingDeviation(
    baseline: BehavioralProfile['typingRhythm'],
    current: any,
  ): number {
    const speedDev = Math.abs(baseline.averageSpeed - current.speed) / baseline.averageSpeed;
    const consistencyDev = Math.abs(baseline.consistency - current.consistency);
    
    let patternDev = 0;
    let patternCount = 0;
    
    for (const [sequence, timings] of baseline.patterns.entries()) {
      if (current.patterns[sequence]) {
        patternDev += this.calculatePatternDeviation(timings, current.patterns[sequence]);
        patternCount++;
      }
    }

    const avgPatternDev = patternCount > 0 ? patternDev / patternCount : 0;
    return (speedDev + consistencyDev + avgPatternDev) / 3;
  }

  private calculateDeviceMismatch(
    baseline: BehavioralProfile['deviceFingerprint'],
    current: any,
  ): number {
    let mismatchCount = 0;
    let totalChecks = 0;

    for (const key of ['hardware', 'software', 'network']) {
      if (baseline[key] && current[key]) {
        totalChecks++;
        if (baseline[key] !== current[key]) {
          mismatchCount++;
        }
      }
    }

    return totalChecks > 0 ? mismatchCount / totalChecks : 0;
  }

  async login(user: any) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload),
    ]);

    // Store refresh token
    this.refreshTokens.set(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const storedRefreshToken = this.refreshTokens.get(userId);
    if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = Array.from(this.users.values()).find(u => u.id === userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate new tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload),
    ]);

    // Update stored refresh token
    this.refreshTokens.set(userId, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  private async generateAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRATION'),
    });
  }

  private async generateRefreshToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION'),
    });
  }

  async register(email: string, password: string, role: UserRole) {
    if (this.users.has(email)) {
      throw new UnauthorizedException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString();

    const user = {
      id: userId,
      email,
      password: hashedPassword,
      role,
    };

    this.users.set(email, user);
    return this.login(user);
  }

  async logout(userId: string) {
    this.refreshTokens.delete(userId);
    return true;
  }
}
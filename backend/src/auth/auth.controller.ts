import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  Logger,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { UserDto } from './dto/user.dto';

const SESSION_COOKIE_NAME = 'opnshelf_session';

@ApiTags('auth')
@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Root domain for cookie in production (e.g. .opnshelf.xyz) so cookie is sent to api and frontend.
   */
  private getCookieDomain(): string | undefined {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    if (!isProduction) return undefined;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || '';
    try {
      const host = new URL(frontendUrl).hostname;
      if (host && !host.startsWith('localhost') && !host.startsWith('127.')) {
        return host.startsWith('.') ? host : `.${host}`;
      }
    } catch {
      // ignore invalid FRONTEND_URL
    }
    return undefined;
  }

  /**
   * Client metadata endpoint for AT Protocol OAuth
   */
  @Get('.well-known/oauth-client-metadata.json')
  @ApiOperation({ summary: 'OAuth client metadata' })
  getClientMetadata() {
    return this.authService.getClientMetadata();
  }

  /**
   * Start OAuth login flow
   */
  @Get('auth/login')
  @ApiOperation({ summary: 'Start AT Protocol OAuth login' })
  @ApiQuery({ name: 'handle', required: false, description: 'User handle (e.g., user.bsky.social)' })
  @ApiResponse({ status: 302, description: 'Redirect to authorization server' })
  async login(
    @Query('handle') handle: string | undefined,
    @Res() res: Response,
  ) {
    // Default to bsky.social if no handle provided
    const userHandle = handle || 'bsky.social';

    try {
      this.logger.log(`Starting OAuth flow for handle: ${userHandle}`);
      const authUrl = await this.authService.authorize(userHandle);
      this.logger.log(`Redirecting to: ${authUrl}`);
      return res.redirect(authUrl);
    } catch (error) {
      this.logger.error('OAuth authorization failed', error);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://127.0.0.1:3000';
      return res.redirect(`${frontendUrl}?error=auth_failed`);
    }
  }

  /**
   * OAuth callback handler
   */
  @Get('auth/callback')
  @ApiOperation({ summary: 'AT Protocol OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend after authentication' })
  async callback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://127.0.0.1:3000';
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const cookieDomain = this.getCookieDomain();

    try {
      // Parse callback query params
      const params = new URLSearchParams(req.url.split('?')[1] || '');
      
      this.logger.log('Processing OAuth callback');
      const { session } = await this.authService.callback(params);
      
      this.logger.log(`OAuth callback successful for DID: ${session.did}`);

      // Fetch user profile and upsert in database
      const profile = await this.authService.fetchProfile(session);
      await this.authService.upsertUser(profile);
      
      this.logger.log(`User upserted: ${profile.handle}`);

      // Set session cookie with the DID (domain set so frontend at opnshelf.xyz receives it)
      res.cookie(SESSION_COOKIE_NAME, session.did, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        path: '/',
        ...(cookieDomain && { domain: cookieDomain }),
      });

      return res.redirect(frontendUrl);
    } catch (error) {
      this.logger.error('OAuth callback failed', error);
      return res.redirect(`${frontendUrl}?error=callback_failed`);
    }
  }

  /**
   * Get current authenticated user
   */
  @Get('auth/me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, type: UserDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async me(@Req() req: Request): Promise<UserDto> {
    const did = (req as any).user?.did;
    if (!did) {
      throw new BadRequestException('User not found in request');
    }

    const user = await this.authService.getUser(did);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      did: user.did,
      handle: user.handle,
      displayName: user.displayName,
      avatar: user.avatar,
    };
  }

  /**
   * Logout - clear session
   */
  @Post('auth/logout')
  @ApiOperation({ summary: 'Logout and clear session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const did = req.cookies?.[SESSION_COOKIE_NAME];
    
    if (did) {
      await this.authService.revoke(did);
    }

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const cookieDomain = this.getCookieDomain();

    // Clear the session cookie (same options as set, including domain)
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      ...(cookieDomain && { domain: cookieDomain }),
    });

    return res.status(HttpStatus.OK).json({ message: 'Logged out successfully' });
  }
}

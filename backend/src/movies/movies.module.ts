import { Module, forwardRef } from '@nestjs/common';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { ColorExtractionService } from './color-extraction.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [MoviesController],
  providers: [MoviesService, ColorExtractionService],
  exports: [MoviesService, ColorExtractionService],
})
export class MoviesModule {}

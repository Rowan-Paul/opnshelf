import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { MoviesModule } from './movies/movies.module';
import { AuthModule } from './auth/auth.module';
import { IngesterModule } from './ingester/ingester.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MoviesModule,
    AuthModule,
    IngesterModule,
  ],
})
export class AppModule {}

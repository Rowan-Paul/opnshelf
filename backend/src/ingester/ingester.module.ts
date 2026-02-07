import { Module, forwardRef } from '@nestjs/common';
import { IngesterService } from './ingester.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MoviesModule } from '../movies/movies.module';

@Module({
  imports: [PrismaModule, forwardRef(() => MoviesModule)],
  providers: [IngesterService],
  exports: [IngesterService],
})
export class IngesterModule {}

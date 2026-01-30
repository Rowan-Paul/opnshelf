import { Module } from '@nestjs/common';
import { IngesterService } from './ingester.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [IngesterService],
  exports: [IngesterService],
})
export class IngesterModule {}

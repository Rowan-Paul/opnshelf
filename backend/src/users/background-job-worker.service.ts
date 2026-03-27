import {
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { ImportHistoryService } from "./import-history.service";
import { UserDeletionService } from "./user-deletion.service";

const WORKER_POLL_INTERVAL_MS = 2_000;

@Injectable()
export class BackgroundJobWorkerService
	implements OnModuleInit, OnModuleDestroy
{
	private readonly logger = new Logger(BackgroundJobWorkerService.name);
	private timer: NodeJS.Timeout | null = null;
	private isProcessing = false;

	constructor(
		private readonly importHistoryService: ImportHistoryService,
		private readonly userDeletionService: UserDeletionService,
	) {}

	onModuleInit() {
		this.timer = setInterval(() => {
			void this.tick();
		}, WORKER_POLL_INTERVAL_MS);
	}

	onModuleDestroy() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	private async tick(): Promise<void> {
		if (this.isProcessing) {
			return;
		}

		this.isProcessing = true;
		try {
			await this.importHistoryService.processNextTraktImportJob();
			await this.userDeletionService.processNextDeletionJob();
		} catch (error) {
			this.logger.error(
				`Background job worker tick failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			this.isProcessing = false;
		}
	}
}

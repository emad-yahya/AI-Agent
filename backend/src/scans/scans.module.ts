import { Module } from "@nestjs/common";
import { AIModule } from "src/ai/ai.module";
import { ScanController } from "./scans.controller";
import { ScansService } from "./scans.service";


@Module({
    imports: [AIModule],
    controllers: [ScanController],
    providers: [ScansService],
})
export class ScansModule {}
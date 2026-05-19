import { Module } from '@nestjs/common';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { GeoActionsController } from './geo-actions.controller';
import { GeoActionsService } from './geo-actions.service';

@Module({
  imports: [FirebaseModule],
  controllers: [GeoActionsController],
  providers: [GeoActionsService],
})
export class GeoActionsModule {}

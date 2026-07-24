import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { SupabaseJwtStrategy } from './strategies/supabase-jwt.strategy';
import { UserProvisioningService } from './user-provisioning.service';

// PrismaModule is not imported here — it is @Global(), so PrismaService injects
// into UserProvisioningService without it.
@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [SupabaseJwtStrategy, UserProvisioningService],
  exports: [UserProvisioningService],
})
export class AuthModule {}

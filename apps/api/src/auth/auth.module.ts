import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { SupabaseTokenService } from './supabase-token.service';
import { UserProvisioningService } from './user-provisioning.service';

// PrismaModule is not imported here — it is @Global(), so PrismaService injects
// into UserProvisioningService without it.
//
// AuthModule is @Global() for the same reason: SupabaseAuthGuard now takes
// constructor dependencies, so every feature module that puts it on a route
// with @UseGuards would otherwise have to import AuthModule first. Forgetting
// that produces a DI error a long way from its cause.
@Global()
@Module({
  controllers: [AuthController],
  providers: [SupabaseTokenService, UserProvisioningService, SupabaseAuthGuard],
  exports: [SupabaseTokenService, UserProvisioningService, SupabaseAuthGuard],
})
export class AuthModule {}

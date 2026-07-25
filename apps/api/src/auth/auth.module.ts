import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { OrgScopeGuard } from './guards/org-scope.guard';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { SupabaseTokenService } from './supabase-token.service';
import { UserProvisioningService } from './user-provisioning.service';

// PrismaModule is not imported here — it is @Global(), so PrismaService injects
// into UserProvisioningService without it.
//
// AuthModule is @Global() for the same reason: SupabaseAuthGuard and
// OrgScopeGuard take constructor dependencies, so every feature module that
// puts one on a route with @UseGuards would otherwise have to import AuthModule
// first. Forgetting that produces a DI error a long way from its cause.
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    SupabaseTokenService,
    UserProvisioningService,
    SupabaseAuthGuard,
    OrgScopeGuard,
  ],
  exports: [
    SupabaseTokenService,
    UserProvisioningService,
    SupabaseAuthGuard,
    OrgScopeGuard,
  ],
})
export class AuthModule {}

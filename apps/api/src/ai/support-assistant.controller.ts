import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AskSupportAssistantDto } from './dto/ask-support-assistant.dto';
import { SupportAssistantService } from './support-assistant.service';

@Controller('ai')
@UseGuards(SupabaseAuthGuard)
export class SupportAssistantController {
  constructor(private readonly supportAssistant: SupportAssistantService) {}

  @Post('support')
  @HttpCode(HttpStatus.OK)
  ask(@CurrentUser() user: User, @Body() input: AskSupportAssistantDto) {
    return this.supportAssistant.ask({
      userId: user.id,
      question: input.question,
      history: input.history ?? [],
    });
  }
}
